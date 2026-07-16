import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import { buildIngestionRunCompletion } from "@/lib/connectors/usaspending/commit";
import { getTestServiceClient } from "./test-service-client";
import { FIXTURE_EMAILS, getSignedInClient } from "./reviewer-fixtures";

/**
 * M6C `commit_usaspending_candidate` RPC integration coverage. Every write
 * here goes through the real, applied dev/CI RPC (or, for pre-existing
 * fixture rows the RPC is expected to find, a direct service-role insert)
 * -- never the live USAspending connector, never a mocked client. All ids
 * use a unique `test-m6c-`/`TEST-M6C-`/`TESTM6CUEI` prefix so cleanup is
 * safe and collision-free against real seed/demo data and other test
 * files. No real award data (recipient names, descriptions) is ever
 * written -- every fixture value below is clearly fabricated test content.
 *
 * A single `beforeAll` performs every RPC call and fixture write up front;
 * individual `it` blocks only assert against that already-established
 * state (mirrors m6a-schema-rls.test.ts's pattern) so ordering never
 * matters between describe blocks.
 *
 * RPC existence/signature/SECURITY DEFINER were verified directly via
 * read-only SQL against pg_proc/pg_namespace when this migration was
 * applied and re-verified for this phase (see this task's own report) --
 * PostgREST/supabase-js has no path to query pg_catalog, so that specific
 * check is not expressible as a vitest assertion here. The *behavioral*
 * half of "execute is service_role only" (anon/authenticated rejected,
 * service_role succeeds) is covered below as real tests.
 */

const GENERATED_INTERNAL_ID = {
  happy: "TEST-M6C-HAPPY-1",
  match: "TEST-M6C-MATCH-1",
  invalid: "TEST-M6C-INVALID-1",
} as const;

const UEI = {
  happy: "TESTM6CUEIHAPPY1",
  match: "TESTM6CUEIMATCH1",
  demoAlias: "TESTM6CUEIDEMOALIAS1",
  demoCollide: "TESTM6CUEIDEMOCOLLIDE1",
  invalid: "TESTM6CUEIINVALID1",
} as const;

function idsFor(generatedInternalId: string) {
  const sourceDocumentId = `usasp-${generatedInternalId}`;
  const signalId = `sig-usasp-${generatedInternalId}`;
  return {
    sourceDocumentId,
    signalId,
    signalEvidenceId: `${signalId}-ev-0`,
    researchItemId: `ri-sig-usasp-${generatedInternalId}`,
  };
}

const HAPPY_IDS = idsFor(GENERATED_INTERNAL_ID.happy);
const MATCH_IDS = idsFor(GENERATED_INTERNAL_ID.match);
const INVALID_IDS = idsFor(GENERATED_INTERNAL_ID.invalid);

const HAPPY_COMPANY_ID = `co-uei-${UEI.happy}`;
const MATCH_EXISTING_COMPANY_ID = "test-m6c-existing-company-1";
const MATCH_EXISTING_ALIAS_ID = "test-m6c-existing-alias-1";
const DEMO_ALIAS_COMPANY_ID = "test-m6c-demo-alias-company-1";
const DEMO_ALIAS_ALIAS_ID = "test-m6c-demo-alias-1";
const DEMO_COLLIDE_COMPANY_ID = `co-uei-${UEI.demoCollide}`;
const INGESTION_RUN_ID = "test-m6c-ingestion-run-1";

function buildValidDto(generatedInternalId: string) {
  const ids = idsFor(generatedInternalId);
  return {
    recipientName: "Test M6C Fixture Recipient LLC",
    researchItemId: ids.researchItemId,
    generatedInternalId,
    requestKind: "contracts",
    entityDecision: { decision: "NEW", reason: null, isPossibleIndividual: false },
    sourceDocument: {
      id: ids.sourceDocumentId,
      canonical_url: `https://www.usaspending.gov/award/${generatedInternalId}/`,
      source_title: "Test M6C Fixture Award (integration test only)",
      publisher: "USAspending.gov (U.S. Department of the Treasury)",
      source_type: "government_award",
      event_date: "2026-01-01",
      published_at: "2026-01-02",
      excerpt: "Fixture excerpt for M6C integration testing only -- not a real award description.",
    },
    signal: {
      id: ids.signalId,
      signal_type: "government contract",
      headline: "Test M6C Fixture Award Headline (integration test only)",
      summary: "Fixture summary for M6C integration testing only.",
      why_it_matters: "Reviewer to assess -- fixture only, not a real impact claim.",
      occurred_at: "2026-01-01",
    },
    signalEvidence: {
      id: ids.signalEvidenceId,
      supporting_passage: "Fixture supporting passage for M6C integration testing only.",
    },
    researchItemPayload: {
      target_table: "signals",
      target_id: ids.signalId,
      connector_key: "usaspending_award_search",
      stage1: { matched_terms: ["fixture term"], matched_codes: [], agency_flag: null, rule_branch: "strong_term" },
      suggested_ai_relevance_class: "ai_adjacent_plausible",
      suggested_award_relevance_case: 1,
      confidence: "low",
    },
  };
}

let happyResult: { data: unknown; error: { message: string } | null };
let happyRepeatResult: { data: unknown; error: { message: string } | null };
let matchResult: { data: unknown; error: { message: string } | null };
let demoAliasResult: { data: unknown; error: { message: string } | null };
let demoCollideResult: { data: unknown; error: { message: string } | null };
let invalidPayloadResult: { data: unknown; error: { message: string } | null };

beforeAll(async () => {
  const service = getTestServiceClient();

  // Fixture: an existing NON-DEMO company + UEI alias, for the reuse test.
  await service.from("companies").insert({
    id: MATCH_EXISTING_COMPANY_ID,
    slug: MATCH_EXISTING_COMPANY_ID,
    name: "Test M6C Existing Non-Demo Company",
    summary: "Fixture non-demo company for M6C non-demo UEI reuse testing.",
    why_it_matters: "Fixture only.",
    company_type: "unclear",
    stage: "discovery",
    is_demo: false,
    publication_status: "draft",
  });
  await service.from("company_aliases").insert({
    id: MATCH_EXISTING_ALIAS_ID,
    company_id: MATCH_EXISTING_COMPANY_ID,
    alias: UEI.match,
    alias_type: "uei",
    normalized_alias: UEI.match,
  });

  // Fixture: a DEMO company + UEI alias, for the demo-collision-via-alias test.
  await service.from("companies").insert({
    id: DEMO_ALIAS_COMPANY_ID,
    slug: DEMO_ALIAS_COMPANY_ID,
    name: "Test M6C Demo Alias Company",
    summary: "Fixture demo company for M6C demo-isolation testing.",
    why_it_matters: "Fixture only.",
    company_type: "unclear",
    stage: "discovery",
    is_demo: true,
    publication_status: "draft",
  });
  await service.from("company_aliases").insert({
    id: DEMO_ALIAS_ALIAS_ID,
    company_id: DEMO_ALIAS_COMPANY_ID,
    alias: UEI.demoAlias,
    alias_type: "uei",
    normalized_alias: UEI.demoAlias,
  });

  // Fixture: a DEMO company sitting at the exact deterministic id
  // co-uei-{normalizedUei} would compute, but with NO alias row yet --
  // simulates an id collision the RPC must catch before ever inserting an
  // alias (see the migration's "Open design questions" #4 note).
  await service.from("companies").insert({
    id: DEMO_COLLIDE_COMPANY_ID,
    slug: DEMO_COLLIDE_COMPANY_ID,
    name: "Test M6C Demo Collide Company",
    summary: "Fixture demo company for M6C deterministic-id-collision testing.",
    why_it_matters: "Fixture only.",
    company_type: "unclear",
    stage: "discovery",
    is_demo: true,
    publication_status: "draft",
  });

  // 1. Happy path: brand-new UEI, no prior alias -- NEW branch.
  happyResult = await service.rpc("commit_usaspending_candidate", {
    p_ingestion_run_id: INGESTION_RUN_ID,
    p_normalized_uei: UEI.happy,
    p_candidate: buildValidDto(GENERATED_INTERNAL_ID.happy),
  });

  // 2. Idempotency: call again with the identical DTO/UEI.
  happyRepeatResult = await service.rpc("commit_usaspending_candidate", {
    p_ingestion_run_id: INGESTION_RUN_ID,
    p_normalized_uei: UEI.happy,
    p_candidate: buildValidDto(GENERATED_INTERNAL_ID.happy),
  });

  // 3. Non-demo UEI reuse: matches the pre-created non-demo company's alias.
  matchResult = await service.rpc("commit_usaspending_candidate", {
    p_ingestion_run_id: INGESTION_RUN_ID,
    p_normalized_uei: UEI.match,
    p_candidate: buildValidDto(GENERATED_INTERNAL_ID.match),
  });

  // 4. Demo isolation via existing alias.
  demoAliasResult = await service.rpc("commit_usaspending_candidate", {
    p_ingestion_run_id: INGESTION_RUN_ID,
    p_normalized_uei: UEI.demoAlias,
    p_candidate: buildValidDto("TEST-M6C-DEMOALIAS-1"),
  });

  // 5. Demo isolation via deterministic-id collision (no alias existed beforehand).
  demoCollideResult = await service.rpc("commit_usaspending_candidate", {
    p_ingestion_run_id: INGESTION_RUN_ID,
    p_normalized_uei: UEI.demoCollide,
    p_candidate: buildValidDto("TEST-M6C-DEMOCOLLIDE-1"),
  });

  // 6. Invalid payload: a required field (signal.id) is missing.
  const invalidDto = buildValidDto(GENERATED_INTERNAL_ID.invalid) as Record<string, unknown>;
  const invalidSignal = { ...(invalidDto.signal as Record<string, unknown>) };
  delete invalidSignal.id;
  invalidDto.signal = invalidSignal;
  invalidPayloadResult = await service.rpc("commit_usaspending_candidate", {
    p_ingestion_run_id: INGESTION_RUN_ID,
    p_normalized_uei: UEI.invalid,
    p_candidate: invalidDto,
  });
});

afterAll(async () => {
  const service = getTestServiceClient();

  const signalEvidenceIds = [HAPPY_IDS.signalEvidenceId, MATCH_IDS.signalEvidenceId, INVALID_IDS.signalEvidenceId];
  const signalIds = [HAPPY_IDS.signalId, MATCH_IDS.signalId, INVALID_IDS.signalId];
  const sourceDocumentIds = [HAPPY_IDS.sourceDocumentId, MATCH_IDS.sourceDocumentId, INVALID_IDS.sourceDocumentId];
  const researchItemIds = [HAPPY_IDS.researchItemId, MATCH_IDS.researchItemId, INVALID_IDS.researchItemId];
  const aliasIds = [MATCH_EXISTING_ALIAS_ID, DEMO_ALIAS_ALIAS_ID, `alias-uei-${UEI.happy}`, `alias-uei-${UEI.demoCollide}`];
  const companyIds = [HAPPY_COMPANY_ID, MATCH_EXISTING_COMPANY_ID, DEMO_ALIAS_COMPANY_ID, DEMO_COLLIDE_COMPANY_ID];

  for (const id of signalEvidenceIds) await service.from("signal_evidence").delete().eq("id", id);
  for (const id of signalIds) await service.from("signals").delete().eq("id", id);
  for (const id of sourceDocumentIds) await service.from("source_documents").delete().eq("id", id);
  for (const id of researchItemIds) await service.from("research_items").delete().eq("id", id);
  for (const id of aliasIds) await service.from("company_aliases").delete().eq("id", id);
  for (const id of companyIds) await service.from("companies").delete().eq("id", id);
  await service.from("ingestion_runs").delete().eq("id", INGESTION_RUN_ID);
});

describe("M6C happy path: NEW candidate commit", () => {
  it("returns decision=committed with the expected ids", () => {
    expect(happyResult.error).toBeNull();
    const data = happyResult.data as { decision: string; companyId: string; companyCreated: boolean; signalId: string; researchItemId: string };
    expect(data.decision).toBe("committed");
    expect(data.companyId).toBe(HAPPY_COMPANY_ID);
    expect(data.companyCreated).toBe(true);
    expect(data.signalId).toBe(HAPPY_IDS.signalId);
    expect(data.researchItemId).toBe(HAPPY_IDS.researchItemId);
  });

  it("creates exactly one non-demo draft company", async () => {
    const service = getTestServiceClient();
    const { data } = await service.from("companies").select("*").eq("id", HAPPY_COMPANY_ID);
    expect(data).toHaveLength(1);
    expect(data?.[0].is_demo).toBe(false);
    expect(data?.[0].publication_status).toBe("draft");
  });

  it("creates exactly one non-demo source_document", async () => {
    const service = getTestServiceClient();
    const { data } = await service.from("source_documents").select("*").eq("id", HAPPY_IDS.sourceDocumentId);
    expect(data).toHaveLength(1);
    expect(data?.[0].is_demo).toBe(false);
    expect(data?.[0].source_tier).toBe("1");
  });

  it("creates exactly one non-demo draft signal with the correct hardcoded fields", async () => {
    const service = getTestServiceClient();
    const { data } = await service.from("signals").select("*").eq("id", HAPPY_IDS.signalId);
    expect(data).toHaveLength(1);
    const signal = data?.[0];
    expect(signal.is_demo).toBe(false);
    expect(signal.publication_status).toBe("draft");
    expect(signal.verification_status).toBe("unverified");
    expect(signal.created_by_type).toBe("import");
    expect(signal.company_id).toBe(HAPPY_COMPANY_ID);
  });

  it("creates exactly one signal_evidence row", async () => {
    const service = getTestServiceClient();
    const { data } = await service.from("signal_evidence").select("*").eq("id", HAPPY_IDS.signalEvidenceId);
    expect(data).toHaveLength(1);
    expect(data?.[0].signal_id).toBe(HAPPY_IDS.signalId);
    expect(data?.[0].source_document_id).toBe(HAPPY_IDS.sourceDocumentId);
  });

  it("creates exactly one non-demo pending research_item", async () => {
    const service = getTestServiceClient();
    const { data } = await service.from("research_items").select("*").eq("id", HAPPY_IDS.researchItemId);
    expect(data).toHaveLength(1);
    expect(data?.[0].is_demo).toBe(false);
    expect(data?.[0].status).toBe("pending");
  });

  it("never creates a review_actions row", async () => {
    const service = getTestServiceClient();
    const { data } = await service.from("review_actions").select("id").eq("research_item_id", HAPPY_IDS.researchItemId);
    expect(data).toEqual([]);
  });
});

describe("M6C idempotency", () => {
  it("the second call with identical ids returns skipped_already_exists", () => {
    expect(happyRepeatResult.error).toBeNull();
    const data = happyRepeatResult.data as { decision: string; researchItemId: string };
    expect(data.decision).toBe("skipped_already_exists");
    expect(data.researchItemId).toBe(HAPPY_IDS.researchItemId);
  });

  it("creates zero duplicate rows across all five tables", async () => {
    const service = getTestServiceClient();
    const [companies, sourceDocs, signals, evidence, items] = await Promise.all([
      service.from("companies").select("id").eq("id", HAPPY_COMPANY_ID),
      service.from("source_documents").select("id").eq("id", HAPPY_IDS.sourceDocumentId),
      service.from("signals").select("id").eq("id", HAPPY_IDS.signalId),
      service.from("signal_evidence").select("id").eq("id", HAPPY_IDS.signalEvidenceId),
      service.from("research_items").select("id").eq("id", HAPPY_IDS.researchItemId),
    ]);
    expect(companies.data).toHaveLength(1);
    expect(sourceDocs.data).toHaveLength(1);
    expect(signals.data).toHaveLength(1);
    expect(evidence.data).toHaveLength(1);
    expect(items.data).toHaveLength(1);
  });
});

describe("M6C non-demo UEI reuse only", () => {
  it("reuses the existing non-demo company -- companyCreated is false", () => {
    expect(matchResult.error).toBeNull();
    const data = matchResult.data as { decision: string; companyId: string; companyCreated: boolean };
    expect(data.decision).toBe("committed");
    expect(data.companyId).toBe(MATCH_EXISTING_COMPANY_ID);
    expect(data.companyCreated).toBe(false);
  });

  it("does not create a second company for the reused UEI", async () => {
    const service = getTestServiceClient();
    const { count } = await service
      .from("companies")
      .select("id", { count: "exact", head: true })
      .in("id", [MATCH_EXISTING_COMPANY_ID, `co-uei-${UEI.match}`]);
    expect(count).toBe(1);
  });

  it("the new signal attaches to the existing non-demo company", async () => {
    const service = getTestServiceClient();
    const { data } = await service.from("signals").select("company_id").eq("id", MATCH_IDS.signalId).single();
    expect(data?.company_id).toBe(MATCH_EXISTING_COMPANY_ID);
  });
});

describe("M6C demo isolation", () => {
  it("a UEI alias matching a demo company returns skipped_demo_company_collision and writes nothing", async () => {
    expect(demoAliasResult.error).toBeNull();
    expect((demoAliasResult.data as { decision: string }).decision).toBe("skipped_demo_company_collision");

    const service = getTestServiceClient();
    const ids = idsFor("TEST-M6C-DEMOALIAS-1");
    const { data: signalData } = await service.from("signals").select("id").eq("id", ids.signalId);
    const { data: sourceDocData } = await service.from("source_documents").select("id").eq("id", ids.sourceDocumentId);
    const { data: itemData } = await service.from("research_items").select("id").eq("id", ids.researchItemId);
    expect(signalData).toEqual([]);
    expect(sourceDocData).toEqual([]);
    expect(itemData).toEqual([]);
  });

  it("a deterministic co-uei-{normalizedUei} id collision with a demo company also returns skipped_demo_company_collision, before any alias or signal is written", async () => {
    expect(demoCollideResult.error).toBeNull();
    expect((demoCollideResult.data as { decision: string }).decision).toBe("skipped_demo_company_collision");

    const service = getTestServiceClient();
    const { data: aliasData } = await service.from("company_aliases").select("id").eq("normalized_alias", UEI.demoCollide);
    expect(aliasData).toEqual([]);

    const ids = idsFor("TEST-M6C-DEMOCOLLIDE-1");
    const { data: signalData } = await service.from("signals").select("id").eq("id", ids.signalId);
    expect(signalData).toEqual([]);
  });

  it("the real connector signal is never attached to a demo company (no signal exists for either demo-collision candidate)", async () => {
    const service = getTestServiceClient();
    const { data } = await service
      .from("signals")
      .select("id, company_id")
      .in("company_id", [DEMO_ALIAS_COMPANY_ID, DEMO_COLLIDE_COMPANY_ID]);
    expect(data).toEqual([]);
  });
});

describe("M6C invalid payload", () => {
  it("returns skipped_invalid_payload naming the missing field path, with no raw content", () => {
    expect(invalidPayloadResult.error).toBeNull();
    const data = invalidPayloadResult.data as { decision: string; missingFields: string[] };
    expect(data.decision).toBe("skipped_invalid_payload");
    expect(data.missingFields).toContain("signal.id");

    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("Test M6C Fixture Recipient LLC");
    expect(serialized).not.toContain("Fixture supporting passage");
  });

  it("writes no rows at all for the invalid candidate", async () => {
    const service = getTestServiceClient();
    const [sourceDocs, items] = await Promise.all([
      service.from("source_documents").select("id").eq("id", INVALID_IDS.sourceDocumentId),
      service.from("research_items").select("id").eq("id", INVALID_IDS.researchItemId),
    ]);
    expect(sourceDocs.data).toEqual([]);
    expect(items.data).toEqual([]);
  });
});

describe("M6C actionability", () => {
  it("the committed research_item is item_type=new_signal with a resolvable payload target", async () => {
    const service = getTestServiceClient();
    const { data } = await service.from("research_items").select("*").eq("id", HAPPY_IDS.researchItemId).single();

    expect(data.item_type).toBe("new_signal");
    expect(data.payload.target_table).toBe("signals");
    expect(data.payload.target_id).toBe(HAPPY_IDS.signalId);

    const { data: signalRow } = await service.from("signals").select("id").eq("id", data.payload.target_id);
    expect(signalRow).toHaveLength(1);
  });

  it("never creates an entity_match research_item anywhere in this test's fixture ids", async () => {
    const service = getTestServiceClient();
    const { data } = await service
      .from("research_items")
      .select("id, item_type")
      .in("id", [HAPPY_IDS.researchItemId, MATCH_IDS.researchItemId]);
    for (const row of data ?? []) {
      expect(row.item_type).toBe("new_signal");
    }
  });
});

describe("M6C public invisibility", () => {
  it("the committed draft company is not visible via the public client", async () => {
    const anon = getPublicSupabaseClient();
    const { data, error } = await anon.from("companies").select("id").eq("id", HAPPY_COMPANY_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("the committed draft signal is not visible via the public client", async () => {
    const anon = getPublicSupabaseClient();
    const { data, error } = await anon.from("signals").select("id").eq("id", HAPPY_IDS.signalId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("the linked source_document/evidence are not visible via the public client", async () => {
    const anon = getPublicSupabaseClient();
    const { data: sourceDocData } = await anon.from("source_documents").select("id").eq("id", HAPPY_IDS.sourceDocumentId);
    const { data: evidenceData } = await anon.from("signal_evidence").select("id").eq("id", HAPPY_IDS.signalEvidenceId);
    expect(sourceDocData).toEqual([]);
    expect(evidenceData).toEqual([]);
  });
});

describe("M6C / M6A trigger invariant", () => {
  it("attempting to publish the connector signal directly is blocked while its company remains draft", async () => {
    // Deliberately the service-role client, not the reviewer UI/submit_review_action --
    // proves the M6A trigger itself blocks this, independent of any reviewer action path.
    const service = getTestServiceClient();
    const { error } = await service.from("signals").update({ publication_status: "published" }).eq("id", HAPPY_IDS.signalId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/cannot publish signal/i);

    const { data } = await service.from("signals").select("publication_status").eq("id", HAPPY_IDS.signalId).single();
    expect(data?.publication_status).toBe("draft");
  });
});

describe("M6C RLS / direct-write denial", () => {
  it("anon cannot directly insert into companies/signals/source_documents/signal_evidence/research_items", async () => {
    const anon = getPublicSupabaseClient();
    const attempts = await Promise.all([
      anon.from("companies").insert({
        id: "test-m6c-should-never-be-inserted-company",
        slug: "test-m6c-should-never-be-inserted-company",
        name: "Should never be inserted",
        summary: "x",
        why_it_matters: "x",
        company_type: "unclear",
        stage: "discovery",
        publication_status: "draft",
      }),
      anon.from("signals").insert({
        id: "test-m6c-should-never-be-inserted-signal",
        company_id: HAPPY_COMPANY_ID,
        signal_type: "government contract",
        headline: "x",
        summary: "x",
        why_it_matters: "x",
        detected_at: new Date().toISOString(),
        evidence_strength: "high",
        verification_status: "unverified",
        publication_status: "draft",
        created_by_type: "import",
      }),
      anon.from("source_documents").insert({
        id: "test-m6c-should-never-be-inserted-source",
        canonical_url: "https://example.com",
        source_title: "x",
        publisher: "x",
        source_type: "government_award",
        source_tier: "1",
        retrieved_at: new Date().toISOString(),
      }),
      anon.from("signal_evidence").insert({
        id: "test-m6c-should-never-be-inserted-evidence",
        signal_id: HAPPY_IDS.signalId,
        source_document_id: HAPPY_IDS.sourceDocumentId,
        support_type: "supports",
        claim_type: "official_record",
      }),
      anon.from("research_items").insert({
        id: "test-m6c-should-never-be-inserted-item",
        item_type: "new_signal",
        payload: { target_table: "signals", target_id: HAPPY_IDS.signalId },
        status: "pending",
        priority: "medium",
      }),
    ]);
    for (const { error } of attempts) {
      expect(error).not.toBeNull();
    }
  });

  it("an authenticated non-reviewer user cannot directly insert into companies either", async () => {
    const nonreviewer = await getSignedInClient(FIXTURE_EMAILS.nonreviewer());
    const { error } = await nonreviewer.from("companies").insert({
      id: "test-m6c-should-never-be-inserted-company-2",
      slug: "test-m6c-should-never-be-inserted-company-2",
      name: "Should never be inserted",
      summary: "x",
      why_it_matters: "x",
      company_type: "unclear",
      stage: "discovery",
      publication_status: "draft",
    });
    expect(error).not.toBeNull();
  });

  it("anon cannot execute commit_usaspending_candidate", async () => {
    const anon = getPublicSupabaseClient();
    const { error } = await anon.rpc("commit_usaspending_candidate", {
      p_ingestion_run_id: "test-m6c-should-never-run",
      p_normalized_uei: "SHOULDNEVERRUN",
      p_candidate: buildValidDto("TEST-M6C-SHOULD-NEVER-RUN"),
    });
    expect(error).not.toBeNull();
  });

  it("an authenticated active reviewer's own session cannot execute commit_usaspending_candidate either -- the boundary is role-based (service_role only), not reviewer-identity-based", async () => {
    const primary = await getSignedInClient(FIXTURE_EMAILS.primary());
    const { error } = await primary.rpc("commit_usaspending_candidate", {
      p_ingestion_run_id: "test-m6c-should-never-run-2",
      p_normalized_uei: "SHOULDNEVERRUN2",
      p_candidate: buildValidDto("TEST-M6C-SHOULD-NEVER-RUN-2"),
    });
    expect(error).not.toBeNull();
  });

  it("the service_role path can execute the RPC (already proven by the happy-path result above)", () => {
    expect(happyResult.error).toBeNull();
  });
});

describe("M6C ingestion_runs -- schema/shape coverage (orchestration itself deferred to the live --commit smoke)", () => {
  /**
   * buildIngestionRunCompletion (src/lib/connectors/usaspending/commit.ts)
   * is hermetic and already unit-tested for its own logic; this test
   * proves its *output* writes cleanly into the real ingestion_runs schema
   * and stays non-sensitive end to end. The full fetch -> commit ->
   * ingestion_runs flow driven by supabase/connector-usaspending.ts's CLI
   * is NOT exercised here -- that file has a side-effecting top-level
   * main() and must never be imported by a test; it remains deferred to
   * the separately-approved live --commit smoke test.
   */

  it("a completion built from a mixed summary (one rpc_call_failed) writes partially_succeeded with non-sensitive metadata", async () => {
    const service = getTestServiceClient();

    await service.from("ingestion_runs").insert({
      id: INGESTION_RUN_ID,
      connector_key: "usaspending_award_search",
      status: "running",
      records_discovered: 0,
      records_created: 0,
      records_skipped: 0,
    });

    const completion = buildIngestionRunCompletion(
      3,
      {
        committedCount: 1,
        skippedByReason: { rpc_call_failed: 1, ambiguous_no_uei: 1 },
        committedResearchItemIds: [HAPPY_IDS.researchItemId],
      },
      true,
    );

    const { error } = await service.from("ingestion_runs").update(completion).eq("id", INGESTION_RUN_ID);
    expect(error).toBeNull();

    const { data } = await service.from("ingestion_runs").select("*").eq("id", INGESTION_RUN_ID).single();
    expect(data.status).toBe("partially_succeeded");
    expect(data.records_created).toBe(1);
    expect(data.records_skipped).toBe(2);
    expect(data.metadata.skippedByReason).toEqual({ rpc_call_failed: 1, ambiguous_no_uei: 1 });
    expect(data.metadata.researchItemIds).toEqual([HAPPY_IDS.researchItemId]);
    expect(JSON.stringify(data)).not.toMatch(/Test M6C Fixture Recipient|Fixture supporting passage/);
  });
});
