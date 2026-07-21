import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import { getTestServiceClient } from "./test-service-client";
import { FIXTURE_EMAILS, getSignedInClient } from "./reviewer-fixtures";

/**
 * M6D (docs/DECISIONS.md D-094) integration coverage for
 * submit_review_action's connector-record reconciliation. Every mutating
 * call under test goes through the anon/publishable client signed in as
 * the primary reviewer fixture (never service-role) -- the reviewer UI is
 * never used; reviewer identity is controlled entirely via
 * getSignedInClient, the same mechanism publish-gate.test.ts already
 * relies on.
 *
 * Existing publish-gate.test.ts regressions (seed/demo approve/edit_approve,
 * reviewer gate, item_type gate, status/action validity, evidence
 * requirement) are NOT duplicated here -- running `npm run test:db` already
 * re-exercises that whole file unchanged, which is the actual regression
 * proof (the company-published branch is structurally a no-op for every
 * existing seed row, since the signals_require_published_company trigger
 * has guaranteed a published signal's company is always published too).
 *
 * All fixture ids use a unique `test-m6d-` prefix. Each describe block owns
 * its own fixture (created in beforeAll, deleted in afterAll); a final
 * top-level afterAll sweeps every table by prefix as a defense-in-depth
 * cleanup net in case any individual describe's afterAll didn't run.
 */

const PREFIX = "test-m6d";

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
  companyPublicationStatus: "draft" | "published";
  companyIsDemo?: boolean;
  signalPublicationStatus?: "draft" | "published";
  signalVerificationStatus?: string;
  signalIsDemo?: boolean;
  itemStatus?: string;
  itemIsDemo?: boolean;
  withEvidence?: boolean;
}

async function buildFixture(suffix: string, opts: FixtureOptions): Promise<FixtureIds> {
  const service = getTestServiceClient();
  const ids = idsFor(suffix);

  const { error: companyError } = await service.from("companies").insert({
    id: ids.companyId,
    slug: ids.companyId,
    name: `Test M6D Company (${suffix})`,
    summary: "Fixture company for M6D integration testing.",
    why_it_matters: "Fixture only.",
    company_type: "unclear",
    stage: "discovery",
    is_demo: opts.companyIsDemo ?? false,
    publication_status: opts.companyPublicationStatus,
  });
  if (companyError) throw companyError;

  const { error: sourceError } = await service.from("source_documents").insert({
    id: ids.sourceDocId,
    canonical_url: `https://example.com/${ids.sourceDocId}`,
    source_title: "Test M6D Fixture Source",
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
    headline: `Test M6D Fixture Signal (${suffix})`,
    summary: "Fixture summary for M6D integration testing.",
    why_it_matters: "Fixture only.",
    detected_at: new Date().toISOString(),
    evidence_strength: "high",
    verification_status: opts.signalVerificationStatus ?? "unverified",
    publication_status: opts.signalPublicationStatus ?? "draft",
    is_demo: opts.signalIsDemo ?? false,
    created_by_type: "import",
  });
  if (signalError) throw signalError;

  if (opts.withEvidence !== false) {
    const { error: evidenceError } = await service.from("signal_evidence").insert({
      id: ids.evidenceId,
      signal_id: ids.signalId,
      source_document_id: ids.sourceDocId,
      support_type: "supports",
      claim_type: "official_record",
      supporting_passage: "Fixture supporting passage.",
    });
    if (evidenceError) throw evidenceError;
  }

  const { error: itemError } = await service.from("research_items").insert({
    id: ids.itemId,
    item_type: "new_signal",
    payload: { target_table: "signals", target_id: ids.signalId },
    status: opts.itemStatus ?? "pending",
    priority: "medium",
    is_demo: opts.itemIsDemo ?? false,
  });
  if (itemError) throw itemError;

  return ids;
}

async function deleteFixture(ids: FixtureIds): Promise<void> {
  const service = getTestServiceClient();
  await service.from("review_actions").delete().eq("research_item_id", ids.itemId);
  await service.from("research_items").delete().eq("id", ids.itemId);
  await service.from("signal_evidence").delete().eq("id", ids.evidenceId);
  await service.from("signals").delete().eq("id", ids.signalId);
  await service.from("source_documents").delete().eq("id", ids.sourceDocId);
  await service.from("companies").delete().eq("id", ids.companyId);
}

const EXPECTED_RESULT_KEYS = [
  "action",
  "company_id",
  "company_publication_status",
  "private_approval",
  "published",
  "research_item_id",
  "research_item_status",
  "signal_id",
  "signal_publication_status",
  "signal_verification_status",
].sort();

/** Asserts the exact non-sensitive jsonb contract -- no excerpt/recipient/payload leakage, only these ten fields. */
function assertJsonbContract(data: unknown, expectedAction: string): void {
  expect(data).toBeTruthy();
  const result = data as Record<string, unknown>;
  expect(Object.keys(result).sort()).toEqual(EXPECTED_RESULT_KEYS);
  expect(result.action).toBe(expectedAction);
  expect(typeof result.research_item_id).toBe("string");
  expect(typeof result.research_item_status).toBe("string");
  expect(typeof result.signal_id).toBe("string");
  expect(typeof result.signal_publication_status).toBe("string");
  expect(typeof result.signal_verification_status).toBe("string");
  expect(typeof result.company_id).toBe("string");
  expect(typeof result.company_publication_status).toBe("string");
  expect(typeof result.published).toBe("boolean");
  expect(typeof result.private_approval).toBe("boolean");
}

afterAll(async () => {
  const service = getTestServiceClient();
  // Defense-in-depth sweep, in FK-safe order, in case an individual
  // describe block's own afterAll didn't run (e.g. a failed assertion
  // aborted the suite before cleanup).
  await service.from("review_actions").delete().like("research_item_id", `${PREFIX}-%`);
  await service.from("research_items").delete().like("id", `${PREFIX}-%`);
  await service.from("signal_evidence").delete().like("id", `${PREFIX}-%`);
  await service.from("signals").delete().like("id", `${PREFIX}-%`);
  await service.from("source_documents").delete().like("id", `${PREFIX}-%`);
  await service.from("companies").delete().like("id", `${PREFIX}-%`);
});

describe("M6D approve: private branch (draft company)", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("approve-private", { companyPublicationStatus: "draft" });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("approves privately without publishing, and stays invisible to anon", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "approve");
    expect(data.published).toBe(false);
    expect(data.private_approval).toBe(true);

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(itemAfter?.status).toBe("approved");

    const { data: signalAfter } = await service
      .from("signals")
      .select("publication_status, verification_status")
      .eq("id", ids.signalId)
      .single();
    expect(signalAfter?.verification_status).toBe("verified");
    expect(signalAfter?.publication_status).toBe("draft");

    const { data: actionRow } = await service
      .from("review_actions")
      .select("before_state, after_state")
      .eq("research_item_id", ids.itemId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(actionRow).toBeTruthy();
    // Audit enrichment: before/after both carry company status alongside the signal snapshot.
    expect(actionRow?.before_state?.company_publication_status).toBe("draft");
    expect(actionRow?.before_state?.company_is_demo).toBe(false);
    expect(actionRow?.after_state?.company_publication_status).toBe("draft");
    expect(actionRow?.after_state?.publication_status).toBe("draft");

    const anon = getPublicSupabaseClient();
    const { data: anonCompany } = await anon.from("companies").select("id").eq("id", ids.companyId);
    const { data: anonSignal } = await anon.from("signals").select("id").eq("id", ids.signalId);
    const { data: anonSource } = await anon.from("source_documents").select("id").eq("id", ids.sourceDocId);
    expect(anonCompany).toEqual([]);
    expect(anonSignal).toEqual([]);
    expect(anonSource).toEqual([]);
  });
});

describe("M6D edit_approve: private branch (draft company)", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("editapprove-private", { companyPublicationStatus: "draft" });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("applies allowed edits, verifies, approves the item, but never publishes", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "edit_approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: { headline: "Edited private headline", evidence_strength: "medium" },
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "edit_approve");
    expect(data.published).toBe(false);
    expect(data.private_approval).toBe(true);

    const { data: signalAfter } = await service
      .from("signals")
      .select("headline, evidence_strength, verification_status, publication_status")
      .eq("id", ids.signalId)
      .single();
    expect(signalAfter?.headline).toBe("Edited private headline");
    expect(signalAfter?.evidence_strength).toBe("medium");
    expect(signalAfter?.verification_status).toBe("verified");
    expect(signalAfter?.publication_status).toBe("draft");

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(itemAfter?.status).toBe("approved");
  });
});

describe("M6D evidence requirement: enforced on the private branch too", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("no-evidence", { companyPublicationStatus: "draft", withEvidence: false });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("rejects approve on a draft-company item with no linked evidence", async () => {
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/no linked evidence/i);
  });

  it("rejects edit_approve on the same draft-company item with no linked evidence, and no approval/publish occurred", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { count: actionsBefore } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", ids.itemId);

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "edit_approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: { headline: "Should never apply" },
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/no linked evidence/i);

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(itemAfter?.status).toBe("pending");

    const { data: signalAfter } = await service.from("signals").select("publication_status").eq("id", ids.signalId).single();
    expect(signalAfter?.publication_status).toBe("draft");

    const { count: actionsAfter } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", ids.itemId);
    expect(actionsAfter).toBe(actionsBefore ?? 0);
  });
});

describe("M6D edit_approve allow-list: still enforced on the private branch", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("allow-list-private", { companyPublicationStatus: "draft" });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("rejects a disallowed edit key, applies nothing, and never approves/publishes", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "edit_approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: { headline: "Should never apply", publication_status: "published" },
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/does not permit editing column/i);

    const { data: signalAfter } = await service
      .from("signals")
      .select("headline, publication_status")
      .eq("id", ids.signalId)
      .single();
    expect(signalAfter?.headline).not.toBe("Should never apply");
    expect(signalAfter?.publication_status).toBe("draft");

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(itemAfter?.status).toBe("pending");
  });
});

describe("M6D approve/edit_approve: published-company branch (regression, no behavior change)", () => {
  let approveIds: FixtureIds;
  let editApproveIds: FixtureIds;

  beforeAll(async () => {
    approveIds = await buildFixture("published-approve", { companyPublicationStatus: "published" });
    editApproveIds = await buildFixture("published-editapprove", { companyPublicationStatus: "published" });
  });

  afterAll(async () => {
    await deleteFixture(approveIds);
    await deleteFixture(editApproveIds);
  });

  it("approve publishes the signal when the company is already published", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: approveIds.itemId,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "approve");
    expect(data.published).toBe(true);
    expect(data.private_approval).toBe(false);

    const { data: signalAfter } = await service
      .from("signals")
      .select("publication_status, verification_status")
      .eq("id", approveIds.signalId)
      .single();
    expect(signalAfter?.publication_status).toBe("published");
    expect(signalAfter?.verification_status).toBe("verified");

    const { data: actionRow } = await service
      .from("review_actions")
      .select("after_state")
      .eq("research_item_id", approveIds.itemId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(actionRow?.after_state?.company_publication_status).toBe("published");
  });

  it("edit_approve publishes the signal when the company is already published", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: editApproveIds.itemId,
      p_action: "edit_approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: { headline: "Published-branch edited headline" },
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "edit_approve");
    expect(data.published).toBe(true);
    expect(data.private_approval).toBe(false);

    const { data: signalAfter } = await service
      .from("signals")
      .select("headline, publication_status")
      .eq("id", editApproveIds.signalId)
      .single();
    expect(signalAfter?.headline).toBe("Published-branch edited headline");
    expect(signalAfter?.publication_status).toBe("published");
  });
});

describe("M6D mark_disputed: published branch (regression, no behavior change)", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("disputed-published", {
      companyPublicationStatus: "published",
      signalPublicationStatus: "published",
      signalVerificationStatus: "verified",
      itemStatus: "approved",
    });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("moves an already-published signal to in_review/disputed", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "mark_disputed",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "mark_disputed");
    expect(data.signal_publication_status).toBe("in_review");
    expect(data.signal_verification_status).toBe("disputed");

    const { data: signalAfter } = await service
      .from("signals")
      .select("publication_status, verification_status")
      .eq("id", ids.signalId)
      .single();
    expect(signalAfter?.publication_status).toBe("in_review");
    expect(signalAfter?.verification_status).toBe("disputed");

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(itemAfter?.status).toBe("disputed");

    const { data: actionRow } = await service
      .from("review_actions")
      .select("before_state, after_state")
      .eq("research_item_id", ids.itemId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    // Audit distinguishes "disputed while already public": before_state shows a published signal.
    expect(actionRow?.before_state?.publication_status).toBe("published");
    expect(actionRow?.after_state?.publication_status).toBe("in_review");
  });
});

describe("M6D mark_disputed: draft branch (never published, new M6D behavior)", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("disputed-draft", {
      companyPublicationStatus: "draft",
      signalPublicationStatus: "draft",
      signalVerificationStatus: "verified",
      itemStatus: "approved",
    });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("disputes a never-published signal without moving it to in_review", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "mark_disputed",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "mark_disputed");
    expect(data.signal_publication_status).toBe("draft");
    expect(data.published).toBe(false);
    expect(data.private_approval).toBe(false);

    const { data: signalAfter } = await service
      .from("signals")
      .select("publication_status, verification_status")
      .eq("id", ids.signalId)
      .single();
    // The key M6D assertion: never 'in_review' for a signal that was never public.
    expect(signalAfter?.publication_status).toBe("draft");
    expect(signalAfter?.verification_status).toBe("disputed");

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(itemAfter?.status).toBe("disputed");

    const { data: actionRow } = await service
      .from("review_actions")
      .select("before_state, after_state")
      .eq("research_item_id", ids.itemId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    // Audit distinguishes "disputed while never public": both snapshots show draft.
    expect(actionRow?.before_state?.publication_status).toBe("draft");
    expect(actionRow?.after_state?.publication_status).toBe("draft");
    expect(actionRow?.before_state?.company_publication_status).toBe("draft");
  });
});

describe("M6D reject: connector draft item", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("reject-draft", { companyPublicationStatus: "draft" });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("rejects safely -- archived, no publish, no trigger error", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "reject",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "reject");
    expect(data.published).toBe(false);

    const { data: signalAfter } = await service
      .from("signals")
      .select("publication_status, verification_status")
      .eq("id", ids.signalId)
      .single();
    expect(signalAfter?.publication_status).toBe("archived");
    expect(signalAfter?.verification_status).toBe("rejected");

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(itemAfter?.status).toBe("rejected");

    const { count } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", ids.itemId);
    expect(count).toBe(1);
  });
});

describe("M6D request_evidence / reopen: functionally unchanged, jsonb contract present", () => {
  let requestEvidenceIds: FixtureIds;
  let reopenIds: FixtureIds;

  beforeAll(async () => {
    requestEvidenceIds = await buildFixture("reqevidence", { companyPublicationStatus: "draft" });
    reopenIds = await buildFixture("reopen", { companyPublicationStatus: "draft", itemStatus: "rejected" });
  });

  afterAll(async () => {
    await deleteFixture(requestEvidenceIds);
    await deleteFixture(reopenIds);
  });

  it("request_evidence moves the item without touching the signal", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: requestEvidenceIds.itemId,
      p_action: "request_evidence",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "request_evidence");
    expect(data.published).toBe(false);

    const { data: itemAfter } = await service
      .from("research_items")
      .select("status")
      .eq("id", requestEvidenceIds.itemId)
      .single();
    expect(itemAfter?.status).toBe("needs_more_evidence");

    const { data: signalAfter } = await service
      .from("signals")
      .select("publication_status")
      .eq("id", requestEvidenceIds.signalId)
      .single();
    expect(signalAfter?.publication_status).toBe("draft");
  });

  it("reopen resets a rejected item to pending without touching the signal", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data, error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: reopenIds.itemId,
      p_action: "reopen",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();
    assertJsonbContract(data, "reopen");
    expect(data.published).toBe(false);

    const { data: itemAfter } = await service.from("research_items").select("status").eq("id", reopenIds.itemId).single();
    expect(itemAfter?.status).toBe("pending");
  });
});

describe("M6D lifecycle: approve-private -> mark_disputed -> reopen never publishes", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("lifecycle", { companyPublicationStatus: "draft" });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("keeps publication_status='draft' at every step", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    async function currentPublicationStatus(): Promise<string | undefined> {
      const { data } = await service.from("signals").select("publication_status").eq("id", ids.signalId).single();
      return data?.publication_status;
    }

    const { error: approveError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(approveError).toBeNull();
    expect(await currentPublicationStatus()).toBe("draft");

    const { data: afterApprove } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(afterApprove?.status).toBe("approved");

    const { error: disputeError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "mark_disputed",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(disputeError).toBeNull();
    expect(await currentPublicationStatus()).toBe("draft");

    const { data: afterDispute } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(afterDispute?.status).toBe("disputed");

    const { error: reopenError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "reopen",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(reopenError).toBeNull();
    expect(await currentPublicationStatus()).toBe("draft");

    const { data: afterReopen } = await service.from("research_items").select("status").eq("id", ids.itemId).single();
    expect(afterReopen?.status).toBe("pending");

    const { data: history } = await service
      .from("review_actions")
      .select("action")
      .eq("research_item_id", ids.itemId)
      .order("created_at", { ascending: true });
    expect(history?.map((row) => row.action)).toEqual(["approve", "mark_disputed", "reopen"]);
  });
});

describe("M6D grant survival after DROP/CREATE", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await buildFixture("grant-check", { companyPublicationStatus: "draft" });
  });

  afterAll(async () => {
    await deleteFixture(ids);
  });

  it("an active reviewer can still execute submit_review_action", async () => {
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "request_evidence",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();
  });

  it("anon cannot execute submit_review_action", async () => {
    const anon = getPublicSupabaseClient();
    const { error } = await anon.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
  });

  it("an authenticated non-reviewer cannot execute submit_review_action", async () => {
    const nonreviewer = await getSignedInClient(FIXTURE_EMAILS.nonreviewer());
    const { error } = await nonreviewer.rpc("submit_review_action", {
      p_research_item_id: ids.itemId,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not an active reviewer/i);
  });
});

describe("M6D item_type gate: unsupported item_type is still hard-rejected", () => {
  const badTypeItemId = `${PREFIX}-item-badtype`;

  beforeAll(async () => {
    const service = getTestServiceClient();
    const { error } = await service.from("research_items").insert({
      id: badTypeItemId,
      item_type: "entity_match",
      payload: { target_table: "signals", target_id: "does-not-matter" },
      status: "pending",
      priority: "medium",
      is_demo: false,
    });
    if (error) throw error;
  });

  afterAll(async () => {
    const service = getTestServiceClient();
    await service.from("review_actions").delete().eq("research_item_id", badTypeItemId);
    await service.from("research_items").delete().eq("id", badTypeItemId);
  });

  it("rejects with 'unsupported item_type' and writes no review_actions row", async () => {
    const service = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: badTypeItemId,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/unsupported item_type/i);

    const { count } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", badTypeItemId);
    expect(count).toBe(0);
  });
});

/**
 * Not directly testable: submit_review_action's defensive
 * "linked company not found" guard cannot be exercised via a live insert,
 * because signals.company_id is `not null references public.companies (id)`
 * -- Postgres's own FK constraint makes "a signal whose company_id doesn't
 * resolve" a structurally impossible state to construct (and deleting a
 * referenced company would itself fail the FK, since there is no ON DELETE
 * CASCADE). This guard is defense-in-depth for a state the schema itself
 * already prevents; verified by reading the applied migration's SQL
 * (`if not found then raise exception 'linked company not found: %' ...`)
 * rather than by a live test.
 */
