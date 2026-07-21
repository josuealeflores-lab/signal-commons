import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTestServiceClient } from "./test-service-client";
import { FIXTURE_EMAILS, getSignedInClient } from "./reviewer-fixtures";

/**
 * M11 Phase B (docs/DECISIONS.md D-100) integration coverage for the
 * idempotency-key and rate-limit guard clauses added to
 * submit_review_action and record_copilot_analysis. Every mutating call
 * under test goes through the anon/publishable client signed in as a
 * reviewer fixture (never service-role) -- the one deliberate exception is
 * the null/in-progress-replay guard test, which uses the service-role
 * client to directly construct an in-flight-looking idempotency_keys row
 * (a state that cannot otherwise be safely produced from a client, per the
 * migration's own race-condition design), and the rate-limit tests' fixture
 * setup.
 *
 * FILE NAME and describe-block ORDER both matter here, for the same
 * reason: the two rate-limit tests intentionally push the primary
 * reviewer's rolling-window usage up to the cap as part of proving it
 * works. That's destructive to any *other* file's tests that assume a
 * fresh-ish budget and run afterward -- so this file is named `zz-m11-...`
 * specifically to sort and run LAST among tests/integration/**, after
 * every other file that calls submit_review_action/record_copilot_analysis
 * as the same `primary` fixture (publish-gate.test.ts,
 * m6d-connector-review.test.ts, m7-copilot.test.ts) has already completed
 * (`fileParallelism: false` in vitest.integration.config.ts makes file
 * execution order deterministic, not just sequential). Within this file,
 * the rate-limit describe blocks are likewise placed last, after every
 * other describe block that needs a fresh, guaranteed-to-succeed
 * primaryClient call.
 *
 * idempotency_keys rows created by this file are NOT swept in afterAll --
 * consistent with docs/DEPLOYMENT.md's documented 24-hour-retention,
 * no-scheduled-cleanup-in-M11 policy. Every key used here is a fresh
 * crypto.randomUUID(), so leftover rows can never collide with a future
 * run and are harmless to leave in place (the same reasoning applies
 * project-wide, not just to this file).
 *
 * All fixture ids use a unique `test-m11-` prefix.
 */

const PREFIX = "test-m11";

let primaryClient: SupabaseClient;
let secondClient: SupabaseClient;
let primaryUserId: string;
let secondUserId: string;

beforeAll(async () => {
  primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
  secondClient = await getSignedInClient(FIXTURE_EMAILS.second());

  const {
    data: { user: primaryUser },
  } = await primaryClient.auth.getUser();
  const {
    data: { user: secondUser },
  } = await secondClient.auth.getUser();
  primaryUserId = primaryUser!.id;
  secondUserId = secondUser!.id;
});

interface CoreFixture {
  companyId: string;
  signalId: string;
  sourceDocId: string;
  evidenceId: string;
}

/** One shared company/signal/evidence set -- many research_items may point at the same signalId. */
async function buildCoreFixture(suffix: string): Promise<CoreFixture> {
  const service = getTestServiceClient();
  const companyId = `${PREFIX}-company-${suffix}`;
  const signalId = `${PREFIX}-signal-${suffix}`;
  const sourceDocId = `${PREFIX}-source-${suffix}`;
  const evidenceId = `${PREFIX}-evidence-${suffix}`;

  const { error: companyError } = await service.from("companies").insert({
    id: companyId,
    slug: companyId,
    name: `Test M11 Company (${suffix})`,
    summary: "Fixture company for M11 Phase B integration testing.",
    why_it_matters: "Fixture only.",
    company_type: "unclear",
    stage: "discovery",
    is_demo: false,
    publication_status: "draft",
  });
  if (companyError) throw companyError;

  const { error: sourceError } = await service.from("source_documents").insert({
    id: sourceDocId,
    canonical_url: `https://example.com/${sourceDocId}`,
    source_title: "Test M11 Fixture Source",
    publisher: "Test Publisher",
    source_type: "government_award",
    source_tier: "1",
    retrieved_at: new Date().toISOString(),
    is_demo: false,
  });
  if (sourceError) throw sourceError;

  const { error: signalError } = await service.from("signals").insert({
    id: signalId,
    company_id: companyId,
    signal_type: "government contract",
    headline: `Test M11 Fixture Signal (${suffix})`,
    summary: "Fixture summary for M11 Phase B integration testing.",
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
    id: evidenceId,
    signal_id: signalId,
    source_document_id: sourceDocId,
    support_type: "supports",
    claim_type: "official_record",
    supporting_passage: "Fixture supporting passage.",
  });
  if (evidenceError) throw evidenceError;

  return { companyId, signalId, sourceDocId, evidenceId };
}

async function insertResearchItem(id: string, signalId: string, status = "pending"): Promise<void> {
  const service = getTestServiceClient();
  const { error } = await service.from("research_items").insert({
    id,
    item_type: "new_signal",
    payload: { target_table: "signals", target_id: signalId },
    status,
    priority: "medium",
    is_demo: false,
  });
  if (error) throw error;
}

async function deleteCoreFixture(ids: CoreFixture): Promise<void> {
  const service = getTestServiceClient();
  await service.from("copilot_analyses").delete().like("research_item_id", `${PREFIX}-%`);
  await service.from("review_actions").delete().like("research_item_id", `${PREFIX}-%`);
  await service.from("research_items").delete().like("id", `${PREFIX}-%`);
  await service.from("signal_evidence").delete().eq("id", ids.evidenceId);
  await service.from("signals").delete().eq("id", ids.signalId);
  await service.from("source_documents").delete().eq("id", ids.sourceDocId);
  await service.from("companies").delete().eq("id", ids.companyId);
}

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

const COPILOT_PAYLOAD_DEFAULTS = {
  p_model: "claude-test-model",
  p_prompt_version: "m11-test-v1",
  p_summary: "Test summary.",
  p_risk_flags: ["Test risk flag."],
  p_missing_evidence: ["Test missing evidence question?"],
  p_suggested_next_step: "unclear",
  p_confidence: "medium",
  p_limitations: "Test limitation note.",
};

// ============================================================
// 1. Safe replay
// ============================================================

describe("M11 safe replay: submit_review_action", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-replay-sra`;

  beforeAll(async () => {
    core = await buildCoreFixture("replay-sra");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("returns the stored response and creates exactly one review_actions row across two identical calls", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const first = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(first.error).toBeNull();

    const second = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(second.error).toBeNull();
    expect(second.data).toEqual(first.data);

    const { count } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", itemId);
    expect(count).toBe(1);
  });
});

describe("M11 safe replay: record_copilot_analysis", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-replay-rca`;

  beforeAll(async () => {
    core = await buildCoreFixture("replay-rca");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("returns the stored response and creates exactly one copilot_analyses row across two identical calls", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const first = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(first.error).toBeNull();

    const second = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(second.error).toBeNull();
    expect(second.data).toEqual(first.data);

    const { count } = await service
      .from("copilot_analyses")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", itemId);
    expect(count).toBe(1);
  });
});

// ============================================================
// 2. Genuine concurrent race
// ============================================================

describe("M11 concurrent race: submit_review_action", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-race-sra`;

  beforeAll(async () => {
    core = await buildCoreFixture("race-sra");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("two truly concurrent calls with the identical key create exactly one review_actions row and return equivalent responses", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const call = () =>
      primaryClient.rpc("submit_review_action", {
        p_research_item_id: itemId,
        p_action: "request_evidence",
        p_idempotency_key: key,
        p_reviewer_note: null,
        p_edited_fields: null,
      });

    const [a, b] = await Promise.all([call(), call()]);

    // Postgres serializes the unique-index insert conflict: the loser
    // blocks until the winner's transaction commits, then observes the
    // fully-populated response row -- both calls should succeed here
    // (this is the safe, expected outcome of the race design), never a
    // duplicate mutation.
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data).toEqual(b.data);

    const { count } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", itemId);
    expect(count).toBe(1);
  });
});

describe("M11 concurrent race: record_copilot_analysis", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-race-rca`;

  beforeAll(async () => {
    core = await buildCoreFixture("race-rca");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("two truly concurrent calls with the identical key create exactly one copilot_analyses row and return equivalent responses", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const call = () =>
      primaryClient.rpc("record_copilot_analysis", {
        p_research_item_id: itemId,
        p_idempotency_key: key,
        ...COPILOT_PAYLOAD_DEFAULTS,
      });

    const [a, b] = await Promise.all([call(), call()]);

    expect(a.error).toBeNull();
    expect(b.error).toBeNull();
    expect(a.data).toEqual(b.data);

    const { count } = await service
      .from("copilot_analyses")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", itemId);
    expect(count).toBe(1);
  });
});

// ============================================================
// 3. Conflicting replay (same key, different payload) -> SC001
// ============================================================

describe("M11 conflicting replay: submit_review_action", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-conflict-sra`;

  beforeAll(async () => {
    core = await buildCoreFixture("conflict-sra");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("raises SC001 when the same key is reused with a different reviewer_note, and no second mutation occurs", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const first = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: "first note",
      p_edited_fields: null,
    });
    expect(first.error).toBeNull();

    const second = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: "a genuinely different note",
      p_edited_fields: null,
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("SC001");

    const { count } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", itemId);
    expect(count).toBe(1);
  });
});

describe("M11 conflicting replay: record_copilot_analysis", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-conflict-rca`;

  beforeAll(async () => {
    core = await buildCoreFixture("conflict-rca");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("raises SC001 when the same key is reused with a different summary, and no second row is inserted", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const first = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(first.error).toBeNull();

    const second = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
      p_summary: "A genuinely different summary.",
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("SC001");

    const { count } = await service
      .from("copilot_analyses")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", itemId);
    expect(count).toBe(1);
  });
});

// ============================================================
// 4. Cross-reviewer replay -> SC003, no leakage
// ============================================================

describe("M11 cross-reviewer replay: submit_review_action", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-crossreviewer-sra`;

  beforeAll(async () => {
    core = await buildCoreFixture("crossreviewer-sra");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("rejects reviewer B reusing reviewer A's key with SC003, never returns A's response, and makes no mutation for B", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const fromPrimary = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(fromPrimary.error).toBeNull();

    const fromSecond = await secondClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(fromSecond.error).not.toBeNull();
    expect(fromSecond.error?.code).toBe("SC003");
    expect(fromSecond.data).toBeNull();

    const { data: rows } = await service
      .from("review_actions")
      .select("reviewer_id")
      .eq("research_item_id", itemId);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.reviewer_id).toBe(primaryUserId);
    expect(rows?.[0]?.reviewer_id).not.toBe(secondUserId);
  });
});

describe("M11 cross-reviewer replay: record_copilot_analysis", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-crossreviewer-rca`;

  beforeAll(async () => {
    core = await buildCoreFixture("crossreviewer-rca");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("rejects reviewer B reusing reviewer A's key with SC003, never returns A's response, and inserts no row for B", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const fromPrimary = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(fromPrimary.error).toBeNull();

    const fromSecond = await secondClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(fromSecond.error).not.toBeNull();
    expect(fromSecond.error?.code).toBe("SC003");
    expect(fromSecond.data).toBeNull();

    const { data: rows } = await service
      .from("copilot_analyses")
      .select("reviewer_id")
      .eq("research_item_id", itemId);
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.reviewer_id).toBe(primaryUserId);
  });
});

// ============================================================
// 5. Endpoint mismatch -> SC002
// ============================================================

describe("M11 endpoint mismatch", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-endpoint-mismatch`;

  beforeAll(async () => {
    core = await buildCoreFixture("endpoint-mismatch");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("rejects with SC002 when a key first used on submit_review_action is reused on record_copilot_analysis", async () => {
    const key = crypto.randomUUID();

    const first = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(first.error).toBeNull();

    const second = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("SC002");
  });
});

// ============================================================
// 6. Null/in-progress guard -> SC005 (service-role-constructed state)
// ============================================================

describe("M11 in-progress replay guard", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-inprogress`;

  beforeAll(async () => {
    core = await buildCoreFixture("inprogress");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("raises SC005 when a committed idempotency_keys row is found with a null response", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();
    const request = {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: null,
      p_edited_fields: null,
    };

    // The migration checks reviewer/endpoint/payload_hash BEFORE the
    // null-response guard (Required invariant E, then C) -- so exercising
    // the guard in isolation requires a row whose payload_hash is the
    // EXACT one the RPC will itself compute for `request` below, not an
    // arbitrary placeholder (an arbitrary hash would instead hit SC001
    // first). The real hash is captured by letting the very first call
    // complete normally (a real, matching row), then resetting its
    // response back to null via the service-role client -- the migration's
    // own design makes this state unreachable through the RPC itself (the
    // insert and the response-update happen in one transaction), so
    // constructing it this way, directly, is the only safe way to isolate
    // the defensive guard, per this test's own brief ("can be tested by
    // service/test setup if safe and isolated").
    const first = await primaryClient.rpc("submit_review_action", request);
    expect(first.error).toBeNull();

    const { error: resetError } = await service
      .from("idempotency_keys")
      .update({ response: null })
      .eq("key", key);
    expect(resetError).toBeNull();

    const { error } = await primaryClient.rpc("submit_review_action", request);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("SC005");

    await service.from("idempotency_keys").delete().eq("key", key);
  });
});

// ============================================================
// 10. Failed mutation rolls back key
// ============================================================

describe("M11 failed-mutation key rollback: submit_review_action", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-failedmutation-sra`;

  beforeAll(async () => {
    core = await buildCoreFixture("failedmutation-sra");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("a genuine business-logic failure (unknown action) does not memoize the key, and a corrected retry with the same key succeeds", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const { error: badActionError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "not-a-real-action",
      p_idempotency_key: key,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(badActionError).not.toBeNull();
    expect(badActionError?.message).toMatch(/unknown action/i);

    const { data: keyRow } = await service.from("idempotency_keys").select("key").eq("key", key);
    expect(keyRow).toEqual([]);

    // Corrected retry with the SAME key -- succeeds as a genuinely new
    // attempt, not blocked by the earlier failed one.
    const { error: retryError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemId,
      p_action: "request_evidence",
      p_idempotency_key: key,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(retryError).toBeNull();

    const { count } = await service
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", itemId);
    expect(count).toBe(1);
  });
});

describe("M11 failed-mutation key rollback: record_copilot_analysis", () => {
  let core: CoreFixture;
  const itemId = `${PREFIX}-item-failedmutation-rca`;

  beforeAll(async () => {
    core = await buildCoreFixture("failedmutation-rca");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("a genuine business-logic failure (invalid confidence) does not memoize the key, and a corrected retry with the same key succeeds", async () => {
    const service = getTestServiceClient();
    const key = crypto.randomUUID();

    const { error: badConfidenceError } = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
      p_confidence: "not-a-real-confidence",
    });
    expect(badConfidenceError).not.toBeNull();

    const { data: keyRow } = await service.from("idempotency_keys").select("key").eq("key", key);
    expect(keyRow).toEqual([]);

    const { error: retryError } = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: key,
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(retryError).toBeNull();

    const { count } = await service
      .from("copilot_analyses")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", itemId);
    expect(count).toBe(1);
  });
});

// ============================================================
// 11. Normal usage does not false-positive
// ============================================================

describe("M11 normal usage: well below either rate cap", () => {
  let core: CoreFixture;
  const sraItemId = `${PREFIX}-item-normal-sra`;
  const rcaItemId = `${PREFIX}-item-normal-rca`;

  beforeAll(async () => {
    core = await buildCoreFixture("normal-usage");
    await insertResearchItem(sraItemId, core.signalId);
    await insertResearchItem(rcaItemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("a single normal-pace submit_review_action call and a single normal-pace record_copilot_analysis call both succeed", async () => {
    const { error: sraError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: sraItemId,
      p_action: "request_evidence",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(sraError).toBeNull();

    const { error: rcaError } = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: rcaItemId,
      p_idempotency_key: crypto.randomUUID(),
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(rcaError).toBeNull();
  });
});

// ============================================================
// 7-9, 12. Rate limits: over-cap, rollback, replay-bypass, counter
// excludes replays -- deliberately LAST in this file (see header comment).
// ============================================================

/**
 * Both rate-limit tests below query the reviewer's CURRENT rolling-window
 * count first, rather than assuming a clean slate -- other test:db files
 * (publish-gate.test.ts, m6d-connector-review.test.ts, m7-copilot.test.ts)
 * also call these two RPCs as the same `primary` reviewer fixture, and
 * `fileParallelism: false` only guarantees sequential execution, not that
 * a full minute has elapsed between files. Computing "how many more calls
 * until the cap" from the live count makes these tests correct regardless
 * of what ran moments before, instead of a brittle "starts at zero"
 * assumption that real suite-ordering/timing could silently invalidate.
 */
async function currentWindowCount(table: "review_actions" | "copilot_analyses", reviewerId: string): Promise<number> {
  const service = getTestServiceClient();
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await service
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("reviewer_id", reviewerId)
    .gt("created_at", oneMinuteAgo);
  return count ?? 0;
}

describe("M11 rate limit: submit_review_action (20/minute)", () => {
  let core: CoreFixture;
  const CAP = 20;
  const itemIds = Array.from({ length: CAP + 2 }, (_, i) => `${PREFIX}-item-ratelimit-sra-${i}`);

  beforeAll(async () => {
    core = await buildCoreFixture("ratelimit-sra");
    for (const id of itemIds) {
      await insertResearchItem(id, core.signalId);
    }
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("fills the remaining budget up to the cap, rejects the next call with SC004, rolls back its key, and a replay of an already-successful key still succeeds", async () => {
    const service = getTestServiceClient();
    const already = await currentWindowCount("review_actions", primaryUserId);
    const remaining = Math.max(CAP - already, 0);

    let firstKey: string | null = null;
    for (let i = 0; i < remaining; i++) {
      const key = crypto.randomUUID();
      if (i === 0) firstKey = key;
      const { error } = await primaryClient.rpc("submit_review_action", {
        p_research_item_id: itemIds[i],
        p_action: "request_evidence",
        p_idempotency_key: key,
        p_reviewer_note: null,
        p_edited_fields: null,
      });
      expect(error).toBeNull();
    }

    // Now at (or already past, if `already` alone exceeded the cap) the
    // cap -- the next genuinely new mutation must be rejected.
    const rejectedKey = crypto.randomUUID();
    const { error: overCapError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: itemIds[remaining],
      p_action: "request_evidence",
      p_idempotency_key: rejectedKey,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(overCapError).not.toBeNull();
    expect(overCapError?.code).toBe("SC004");

    // Rollback proof: the rejected attempt's key was never persisted.
    const { data: rejectedKeyRow } = await service.from("idempotency_keys").select("key").eq("key", rejectedKey);
    expect(rejectedKeyRow).toEqual([]);

    // Replay-bypasses-rate-limit / counter-excludes-replays proof: even
    // while at/over the cap, replaying an already-successful key still
    // returns the stored response instead of a fresh SC004 rejection.
    if (firstKey) {
      const { error: replayError, data: replayData } = await primaryClient.rpc("submit_review_action", {
        p_research_item_id: itemIds[0],
        p_action: "request_evidence",
        p_idempotency_key: firstKey,
        p_reviewer_note: null,
        p_edited_fields: null,
      });
      expect(replayError).toBeNull();
      expect(replayData).toBeTruthy();
    }
  }, 45000);
});

describe("M11 rate limit: record_copilot_analysis (10/minute)", () => {
  let core: CoreFixture;
  const CAP = 10;
  const itemId = `${PREFIX}-item-ratelimit-rca`;

  beforeAll(async () => {
    core = await buildCoreFixture("ratelimit-rca");
    await insertResearchItem(itemId, core.signalId);
  });

  afterAll(async () => {
    await deleteCoreFixture(core);
  });

  it("fills the remaining budget up to the cap, rejects the next call with SC004, rolls back its key, and a replay of an already-successful key still succeeds", async () => {
    const service = getTestServiceClient();
    const already = await currentWindowCount("copilot_analyses", primaryUserId);
    const remaining = Math.max(CAP - already, 0);

    let firstKey: string | null = null;
    for (let i = 0; i < remaining; i++) {
      const key = crypto.randomUUID();
      if (i === 0) firstKey = key;
      const { error } = await primaryClient.rpc("record_copilot_analysis", {
        p_research_item_id: itemId,
        p_idempotency_key: key,
        ...COPILOT_PAYLOAD_DEFAULTS,
      });
      expect(error).toBeNull();
    }

    const rejectedKey = crypto.randomUUID();
    const { error: overCapError } = await primaryClient.rpc("record_copilot_analysis", {
      p_research_item_id: itemId,
      p_idempotency_key: rejectedKey,
      ...COPILOT_PAYLOAD_DEFAULTS,
    });
    expect(overCapError).not.toBeNull();
    expect(overCapError?.code).toBe("SC004");

    const { data: rejectedKeyRow } = await service.from("idempotency_keys").select("key").eq("key", rejectedKey);
    expect(rejectedKeyRow).toEqual([]);

    if (firstKey) {
      const { error: replayError, data: replayData } = await primaryClient.rpc("record_copilot_analysis", {
        p_research_item_id: itemId,
        p_idempotency_key: firstKey,
        ...COPILOT_PAYLOAD_DEFAULTS,
      });
      expect(replayError).toBeNull();
      expect(replayData).toBeTruthy();
    }
  }, 45000);
});
