import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import { getTestServiceClient } from "./test-service-client";
import { FIXTURE_EMAILS, getSignedInClient } from "./reviewer-fixtures";

/**
 * M7 (docs/DECISIONS.md D-095) integration coverage for
 * record_copilot_analysis. Every mutating call under test goes through the
 * anon/publishable client signed in as a reviewer fixture (never
 * service-role) -- the reviewer UI is never used; reviewer identity is
 * controlled entirely via getSignedInClient, the same mechanism
 * publish-gate.test.ts and m6d-connector-review.test.ts already rely on.
 * The one deliberate exception is the "service-role call is rejected"
 * test, which uses getTestServiceClient() as the CALLER under test (to
 * prove the internal reviewer gate rejects it too), never for setup there.
 *
 * Sign-in volume: the dev/CI project's Supabase Auth sign-in rate limit
 * (30 requests / 5 minutes / IP) is shared across the whole `test:db` run.
 * Each reviewer identity is therefore signed in ONCE, in the file-level
 * beforeAll below, and every test in this file reuses that same signed-in
 * client -- never a fresh getSignedInClient call per test. Reusing one
 * client object across many independent queries is safe (each call is
 * independent; the auth session itself isn't mutated by unrelated
 * queries), and this is the same identity for the whole file either way,
 * so nothing about reviewer-control/role-boundary coverage is weakened by
 * sharing the client instance.
 *
 * All fixture ids use a unique `test-m7-` prefix. Each describe block owns
 * its own fixture (created in beforeAll, deleted in afterAll); a final
 * top-level afterAll sweeps every table by prefix as a defense-in-depth
 * cleanup net.
 */

const PREFIX = "test-m7";

let primaryClient: SupabaseClient;
let nonreviewerClient: SupabaseClient;
let inactiveClient: SupabaseClient;
let primaryUserId: string | undefined;

beforeAll(async () => {
  primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
  nonreviewerClient = await getSignedInClient(FIXTURE_EMAILS.nonreviewer());
  inactiveClient = await getSignedInClient(FIXTURE_EMAILS.inactive());

  const {
    data: { user },
  } = await primaryClient.auth.getUser();
  primaryUserId = user?.id;
});

interface FixtureIds {
  companyId: string;
  signalId: string;
  sourceDocId: string;
  evidenceId: string;
  itemId: string;
}

function idsFor(suffix: string): FixtureIds {
  return {
    companyId: `${PREFIX}-company-${suffix}`,
    signalId: `${PREFIX}-signal-${suffix}`,
    sourceDocId: `${PREFIX}-source-${suffix}`,
    evidenceId: `${PREFIX}-evidence-${suffix}`,
    itemId: `${PREFIX}-item-${suffix}`,
  };
}

interface FixtureOptions {
  itemType?: string;
}

async function buildFixture(suffix: string, opts: FixtureOptions = {}): Promise<FixtureIds> {
  const service = getTestServiceClient();
  const ids = idsFor(suffix);

  const { error: companyError } = await service.from("companies").insert({
    id: ids.companyId,
    slug: ids.companyId,
    name: `Test M7 Company (${suffix})`,
    summary: "Fixture company for M7 integration testing.",
    why_it_matters: "Fixture only.",
    company_type: "unclear",
    stage: "discovery",
    is_demo: false,
    publication_status: "draft",
  });
  if (companyError) throw companyError;

  const { error: sourceError } = await service.from("source_documents").insert({
    id: ids.sourceDocId,
    canonical_url: `https://example.com/${ids.sourceDocId}`,
    source_title: "Test M7 Fixture Source",
    publisher: "Test Publisher",
    source_type: "government_award",
    source_tier: "1",
    retrieved_at: new Date().toISOString(),
    is_demo: false,
  });
  if (sourceError) throw sourceError;

  const { error: signalError } = await service.from("signals").insert({
    id: ids.signalId,
    company_id: ids.companyId,
    signal_type: "government contract",
    headline: `Test M7 Fixture Signal (${suffix})`,
    summary: "Fixture summary for M7 integration testing.",
    why_it_matters: "Fixture only.",
    detected_at: new Date().toISOString(),
    evidence_strength: "high",
    verification_status: "unverified",
    publication_status: "draft",
    is_demo: false,
    created_by_type: "import",
  });
  if (signalError) throw signalError;

  const { error: evidenceError } = await service.from("signal_evidence").insert({
    id: ids.evidenceId,
    signal_id: ids.signalId,
    source_document_id: ids.sourceDocId,
    support_type: "supports",
    claim_type: "official_record",
    supporting_passage: "Fixture supporting passage.",
  });
  if (evidenceError) throw evidenceError;

  const { error: itemError } = await service.from("research_items").insert({
    id: ids.itemId,
    item_type: opts.itemType ?? "new_signal",
    payload: { target_table: "signals", target_id: ids.signalId },
    status: "pending",
    priority: "medium",
    is_demo: false,
  });
  if (itemError) throw itemError;

  return ids;
}

async function deleteFixture(ids: FixtureIds): Promise<void> {
  const service = getTestServiceClient();
  await service.from("copilot_analyses").delete().eq("research_item_id", ids.itemId);
  await service.from("review_actions").delete().eq("research_item_id", ids.itemId);
  await service.from("research_items").delete().eq("id", ids.itemId);
  await service.from("signal_evidence").delete().eq("id", ids.evidenceId);
  await service.from("signals").delete().eq("id", ids.signalId);
  await service.from("source_documents").delete().eq("id", ids.sourceDocId);
  await service.from("companies").delete().eq("id", ids.companyId);
}

const VALID_PAYLOAD_DEFAULTS = {
  p_model: "claude-test-model",
  p_prompt_version: "m7-copilot-v1-test",
  p_summary: "Test summary.",
  p_risk_flags: ["Test risk flag."],
  p_missing_evidence: ["Test missing evidence question?"],
  p_suggested_next_step: "unclear",
  p_confidence: "medium",
  p_limitations: "Test limitation note.",
};

async function callRecordCopilotAnalysis(
  client: SupabaseClient,
  researchItemId: string,
  overrides: Record<string, unknown> = {},
) {
  return client.rpc("record_copilot_analysis", {
    p_research_item_id: researchItemId,
    ...VALID_PAYLOAD_DEFAULTS,
    ...overrides,
  });
}

const EXPECTED_RETURN_KEYS = ["id", "research_item_id", "created_at"].sort();

afterAll(async () => {
  const service = getTestServiceClient();
  // Defense-in-depth sweep, in FK-safe order, in case an individual
  // describe block's own afterAll didn't run.
  await service.from("copilot_analyses").delete().like("research_item_id", `${PREFIX}-%`);
  await service.from("review_actions").delete().like("research_item_id", `${PREFIX}-%`);
  await service.from("research_items").delete().like("id", `${PREFIX}-%`);
  await service.from("signal_evidence").delete().like("id", `${PREFIX}-%`);
  await service.from("signals").delete().like("id", `${PREFIX}-%`);
  await service.from("source_documents").delete().like("id", `${PREFIX}-%`);
  await service.from("companies").delete().like("id", `${PREFIX}-%`);
});

describe("M7 record_copilot_analysis: happy path, attribution, non-mutation, data minimization", () => {
  let ids: FixtureIds;
  let insertedId: string;

  beforeAll(async () => {
    ids = await buildFixture("happy-path");
    const { data, error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId);
    if (error) throw error;
    insertedId = (data as { id: string }).id;
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("succeeds and returns exactly {id, research_item_id, created_at}", async () => {
    const { data, error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_summary: "Second call." });
    expect(error).toBeNull();
    const result = data as Record<string, unknown>;
    expect(Object.keys(result).sort()).toEqual(EXPECTED_RETURN_KEYS);
    expect(result.research_item_id).toBe(ids.itemId);
    expect(typeof result.id).toBe("string");
    expect(typeof result.created_at).toBe("string");
  });

  it("inserts exactly one row with the expected column values", async () => {
    const service = getTestServiceClient();
    const { data: row, error } = await service.from("copilot_analyses").select("*").eq("id", insertedId).single();
    expect(error).toBeNull();
    expect(row).toMatchObject({
      research_item_id: ids.itemId,
      model: VALID_PAYLOAD_DEFAULTS.p_model,
      prompt_version: VALID_PAYLOAD_DEFAULTS.p_prompt_version,
      summary: VALID_PAYLOAD_DEFAULTS.p_summary,
      risk_flags: VALID_PAYLOAD_DEFAULTS.p_risk_flags,
      missing_evidence: VALID_PAYLOAD_DEFAULTS.p_missing_evidence,
      suggested_next_step: VALID_PAYLOAD_DEFAULTS.p_suggested_next_step,
      confidence: VALID_PAYLOAD_DEFAULTS.p_confidence,
      limitations: VALID_PAYLOAD_DEFAULTS.p_limitations,
    });
    expect(row?.created_at).toBeTruthy();
  });

  it("attributes reviewer_id to the calling reviewer's own auth.uid(), never a caller-supplied value", async () => {
    const service = getTestServiceClient();
    const { data: row } = await service.from("copilot_analyses").select("reviewer_id").eq("id", insertedId).single();
    expect(row?.reviewer_id).toBe(primaryUserId);
  });

  it("does not mutate research_items, signals, companies, source_documents, signal_evidence, or review_actions", async () => {
    const service = getTestServiceClient();

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(itemAfter?.status).toBe("pending");

    const { data: signalAfter } = await service
      .from("signals")
      .select("headline, publication_status, verification_status")
      .eq("id", ids.signalId)
      .single();
    expect(signalAfter?.headline).toBe(`Test M7 Fixture Signal (happy-path)`);
    expect(signalAfter?.publication_status).toBe("draft");
    expect(signalAfter?.verification_status).toBe("unverified");

    const { data: companyAfter } = await service
      .from("companies")
      .select("publication_status")
      .eq("id", ids.companyId)
      .single();
    expect(companyAfter?.publication_status).toBe("draft");

    const { count: sourceCount } = await service
      .from("source_documents")
      .select("*", { count: "exact", head: true })
      .eq("id", ids.sourceDocId);
    expect(sourceCount).toBe(1);

    const { count: evidenceCount } = await service
      .from("signal_evidence")
      .select("*", { count: "exact", head: true })
      .eq("id", ids.evidenceId);
    expect(evidenceCount).toBe(1);

    const { count: reviewActionsCount } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", ids.itemId);
    expect(reviewActionsCount).toBe(0);
  });

  it("stores only the minimized structured fields -- no prompt, raw output, excerpts, history, notes, or state snapshots", async () => {
    const service = getTestServiceClient();
    const { data: row } = await service.from("copilot_analyses").select("*").eq("id", insertedId).single();
    const keys = Object.keys(row as Record<string, unknown>).sort();
    expect(keys).toEqual(
      [
        "id",
        "research_item_id",
        "reviewer_id",
        "model",
        "prompt_version",
        "summary",
        "risk_flags",
        "missing_evidence",
        "suggested_next_step",
        "confidence",
        "limitations",
        "created_at",
      ].sort(),
    );
    // None of the forbidden fields exist as columns at all -- confirmed empirically
    // against the live row, not just against the migration SQL.
    for (const forbidden of ["prompt", "raw_output", "source_excerpt", "review_actions_history", "reviewer_note", "before_state", "after_state", "full_payload"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("M7 record_copilot_analysis: reviewer_id cannot be spoofed", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("spoof-attempt");
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("ignores/rejects an attempted extra p_reviewer_id parameter, and never attributes the row to the spoofed identity", async () => {
    const service = getTestServiceClient();
    const spoofedReviewerId = "00000000-0000-0000-0000-000000000099";

    const { data, error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, {
      p_reviewer_id: spoofedReviewerId,
    });

    if (error) {
      // Expected: record_copilot_analysis's signature has no p_reviewer_id
      // parameter, so PostgREST cannot resolve a matching function overload
      // with this extra, unrecognized key.
      const { count } = await service
        .from("copilot_analyses")
        .select("*", { count: "exact", head: true })
        .eq("research_item_id", ids.itemId);
      expect(count).toBe(0);
    } else {
      // Defense in depth: even if some Supabase/PostgREST version instead
      // silently drops the unknown key and succeeds, the inserted row must
      // still be attributed to the real caller, never the spoofed id.
      const insertedId = (data as { id: string }).id;
      const { data: row } = await service.from("copilot_analyses").select("reviewer_id").eq("id", insertedId).single();
      expect(row?.reviewer_id).toBe(primaryUserId);
      expect(row?.reviewer_id).not.toBe(spoofedReviewerId);
    }
  });
});

describe("M7 record_copilot_analysis: reviewer gate", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("reviewer-gate");
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("an active reviewer can execute the RPC", async () => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId);
    expect(error).toBeNull();
  });

  it("anon is rejected", async () => {
    const anon = getPublicSupabaseClient();
    const { error } = await callRecordCopilotAnalysis(anon, ids.itemId);
    expect(error).not.toBeNull();
  });

  it("an authenticated non-reviewer is rejected", async () => {
    const { error } = await callRecordCopilotAnalysis(nonreviewerClient, ids.itemId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not an active reviewer/i);
  });

  it("an inactive reviewer is rejected", async () => {
    const { error } = await callRecordCopilotAnalysis(inactiveClient, ids.itemId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not an active reviewer/i);
  });

  it("a service-role call (no auth.uid()) is rejected by the internal reviewer gate", async () => {
    const service = getTestServiceClient();
    const { error } = await callRecordCopilotAnalysis(service, ids.itemId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not an active reviewer/i);
  });
});

describe("M7 record_copilot_analysis: item_type gate", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("bad-type", { itemType: "entity_match" });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("rejects an item_type other than new_signal, and inserts no copilot_analyses row", async () => {
    const service = getTestServiceClient();

    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/unsupported item_type/i);

    const { count } = await service
      .from("copilot_analyses")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", ids.itemId);
    expect(count).toBe(0);
  });
});

describe("M7 record_copilot_analysis: research item not found", () => {
  const missingItemId = `${PREFIX}-item-does-not-exist`;

  it("rejects cleanly and inserts no row", async () => {
    const service = getTestServiceClient();

    const { error } = await callRecordCopilotAnalysis(primaryClient, missingItemId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/research item not found/i);

    const { count } = await service
      .from("copilot_analyses")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", missingItemId);
    expect(count).toBe(0);
  });
});

describe("M7 record_copilot_analysis: suggested_next_step validation", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("next-step-validation");
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it.each(["approve", "needs_more_evidence", "totally-invalid-value"])(
    "rejects the invalid suggestedNextStep value '%s'",
    async (invalidValue) => {
      const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_suggested_next_step: invalidValue });
      expect(error).not.toBeNull();
    },
  );

  it.each(["leans_approve", "leans_reject", "suggests_evidence_review", "unclear"])(
    "accepts the approved suggestedNextStep value '%s'",
    async (validValue) => {
      const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_suggested_next_step: validValue });
      expect(error).toBeNull();
    },
  );
});

describe("M7 record_copilot_analysis: confidence validation", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("confidence-validation");
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("rejects an invalid confidence value", async () => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_confidence: "extreme" });
    expect(error).not.toBeNull();
  });

  it.each(["low", "medium", "high"])("accepts the approved confidence value '%s'", async (validValue) => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_confidence: validValue });
    expect(error).toBeNull();
  });
});

describe("M7 record_copilot_analysis: risk_flags/missing_evidence must be JSON arrays", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("array-validation");
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("accepts an empty array for risk_flags and missing_evidence", async () => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_risk_flags: [], p_missing_evidence: [] });
    expect(error).toBeNull();
  });

  it("accepts a non-empty array for risk_flags and missing_evidence", async () => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, {
      p_risk_flags: ["one flag"],
      p_missing_evidence: ["one question"],
    });
    expect(error).toBeNull();
  });

  it("rejects an object for risk_flags", async () => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_risk_flags: { not: "an array" } });
    expect(error).not.toBeNull();
  });

  it("rejects a string for missing_evidence", async () => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_missing_evidence: "not an array" });
    expect(error).not.toBeNull();
  });

  it("rejects a number for risk_flags", async () => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_risk_flags: 5 });
    expect(error).not.toBeNull();
  });

  it("rejects a JSON null for missing_evidence", async () => {
    const { error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId, { p_missing_evidence: null });
    expect(error).not.toBeNull();
  });
});

describe("M7 copilot_analyses RLS: SELECT / direct-write denial", () => {
  let ids: FixtureIds;
  let insertedId: string;

  beforeAll(async () => {
    ids = await buildFixture("rls");
    const { data, error } = await callRecordCopilotAnalysis(primaryClient, ids.itemId);
    if (error) throw error;
    insertedId = (data as { id: string }).id;
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("an active reviewer can SELECT copilot_analyses", async () => {
    const { data, error } = await primaryClient.from("copilot_analyses").select("id").eq("id", insertedId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("anon cannot SELECT copilot_analyses", async () => {
    const anon = getPublicSupabaseClient();
    const { data, error } = await anon.from("copilot_analyses").select("id").eq("id", insertedId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an authenticated non-reviewer cannot SELECT copilot_analyses", async () => {
    const { data, error } = await nonreviewerClient.from("copilot_analyses").select("id").eq("id", insertedId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an authenticated active reviewer cannot directly INSERT into copilot_analyses (write path is the RPC only)", async () => {
    const service = getTestServiceClient();

    const { error } = await primaryClient.from("copilot_analyses").insert({
      research_item_id: ids.itemId,
      reviewer_id: primaryUserId,
      model: "should-never-be-inserted",
      prompt_version: "should-never-be-inserted",
      summary: "should-never-be-inserted",
      suggested_next_step: "unclear",
      confidence: "low",
    });
    expect(error).not.toBeNull();

    const { count } = await service
      .from("copilot_analyses")
      .select("*", { count: "exact", head: true })
      .eq("model", "should-never-be-inserted");
    expect(count).toBe(0);
  });

  it("an authenticated active reviewer cannot directly UPDATE copilot_analyses (either a permission error, or RLS filters the row out of the visible set with 0 rows affected -- both are valid; the state check below is the real proof)", async () => {
    const service = getTestServiceClient();
    const { data: before } = await service.from("copilot_analyses").select("summary").eq("id", insertedId).single();

    await primaryClient.from("copilot_analyses").update({ summary: "tampered" }).eq("id", insertedId);

    const { data: after } = await service.from("copilot_analyses").select("summary").eq("id", insertedId).single();
    expect(after).toBeTruthy();
    expect(after?.summary).toBe(before?.summary);
    expect(after?.summary).not.toBe("tampered");
  });

  it("an authenticated active reviewer cannot directly DELETE copilot_analyses (either a permission error, or RLS filters the row out of the visible set with 0 rows affected -- both are valid; the state check below is the real proof)", async () => {
    const service = getTestServiceClient();

    await primaryClient.from("copilot_analyses").delete().eq("id", insertedId);

    const { data: row, count } = await service
      .from("copilot_analyses")
      .select("*", { count: "exact" })
      .eq("id", insertedId);
    expect(count).toBe(1);
    expect(row).toHaveLength(1);
  });
});
