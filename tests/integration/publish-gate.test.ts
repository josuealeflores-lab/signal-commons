import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import { getTestServiceClient } from "./test-service-client";
import { FIXTURE_EMAILS, getSignedInClient } from "./reviewer-fixtures";

/**
 * Exercises submit_review_action and derive_research_items_from_seed_signals
 * directly, using the anon/publishable client signed in as one of the
 * reviewer fixture accounts — never the service-role client for the
 * mutating calls under test (the service-role client is used only to
 * reset/inspect fixture state between tests, an explicitly documented
 * exception — docs/DECISIONS.md D-046/D-049 style).
 *
 * Each describe block uses its own dedicated draft-signal fixture (one of
 * the 7 draft signals from seed/demo-data.json) and resets it to a known
 * starting state in `beforeEach`, so repeated `npm run test:db` runs stay
 * deterministic even though the shared dev database is never wiped between
 * runs.
 */

async function resetDraftFixture(signalId: string, researchItemId: string): Promise<void> {
  const supabase = getTestServiceClient();
  await supabase
    .from("signals")
    .update({ publication_status: "draft", verification_status: "unverified" })
    .eq("id", signalId);
  await supabase
    .from("research_items")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("id", researchItemId);
}

async function resetPublishedFixture(signalId: string, researchItemId: string): Promise<void> {
  const supabase = getTestServiceClient();
  await supabase
    .from("signals")
    .update({ publication_status: "published", verification_status: "verified" })
    .eq("id", signalId);
  await supabase
    .from("research_items")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", researchItemId);
}

describe("submit_review_action: basic transitions", () => {
  const SIGNAL_ID = "demo-signal-2-3";
  const ITEM_ID = "ri-demo-signal-2-3";

  beforeEach(async () => {
    await resetDraftFixture(SIGNAL_ID, ITEM_ID);
  });

  it("approve flips a pending item's target to published/verified and appends one review_actions row", async () => {
    const serviceClient = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { count: countBefore } = await serviceClient
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", ITEM_ID);

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "approve",
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();

    const { data: signalAfter } = await serviceClient
      .from("signals")
      .select("publication_status, verification_status")
      .eq("id", SIGNAL_ID)
      .single();
    expect(signalAfter?.publication_status).toBe("published");
    expect(signalAfter?.verification_status).toBe("verified");

    const { data: itemAfter } = await serviceClient.from("research_items").select("status").eq("id", ITEM_ID).single();
    expect(itemAfter?.status).toBe("approved");

    const { count: countAfter } = await serviceClient
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", ITEM_ID);
    expect(countAfter).toBe((countBefore ?? 0) + 1);
  });

  it("reject flips a pending item's target to archived/rejected", async () => {
    const serviceClient = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "reject",
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();

    const { data: signalAfter } = await serviceClient
      .from("signals")
      .select("publication_status, verification_status")
      .eq("id", SIGNAL_ID)
      .single();
    expect(signalAfter?.publication_status).toBe("archived");
    expect(signalAfter?.verification_status).toBe("rejected");

    const { data: itemAfter } = await serviceClient.from("research_items").select("status").eq("id", ITEM_ID).single();
    expect(itemAfter?.status).toBe("rejected");
  });

  it("request_evidence moves the item to needs_more_evidence without touching the target signal", async () => {
    const serviceClient = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "request_evidence",
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();

    const { data: signalAfter } = await serviceClient
      .from("signals")
      .select("publication_status")
      .eq("id", SIGNAL_ID)
      .single();
    expect(signalAfter?.publication_status).toBe("draft");

    const { data: itemAfter } = await serviceClient.from("research_items").select("status").eq("id", ITEM_ID).single();
    expect(itemAfter?.status).toBe("needs_more_evidence");
  });

  it("calling approve again on an already-approved item fails cleanly (no double-processing)", async () => {
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { error: firstError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "approve",
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(firstError).toBeNull();

    const { error: secondError } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "approve",
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(secondError).not.toBeNull();
  });

  it("calling the RPC as anon fails with a permission error", async () => {
    const anonClient = getPublicSupabaseClient();
    const { error } = await anonClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "approve",
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
  });

  it("reopen fails from an approved item — mark_disputed is the only path from approved", async () => {
    const serviceClient = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    await serviceClient.from("research_items").update({ status: "approved" }).eq("id", ITEM_ID);

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "reopen",
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
  });

  it("reopen succeeds from rejected, resetting the item back to pending", async () => {
    const serviceClient = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    await serviceClient.from("research_items").update({ status: "rejected" }).eq("id", ITEM_ID);

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "reopen",
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).toBeNull();

    const { data } = await serviceClient.from("research_items").select("status").eq("id", ITEM_ID).single();
    expect(data?.status).toBe("pending");
  });
});

describe("submit_review_action: edit_approve column allow-list (RPC-level enforcement)", () => {
  const SIGNAL_ID = "demo-signal-3-3";
  const ITEM_ID = "ri-demo-signal-3-3";

  beforeEach(async () => {
    await resetDraftFixture(SIGNAL_ID, ITEM_ID);
  });

  it("applies only allow-listed fields, publishes, and preserves pre-edit state in before_state", async () => {
    const serviceClient = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data: before } = await serviceClient.from("signals").select("headline").eq("id", SIGNAL_ID).single();

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "edit_approve",
      p_reviewer_note: "Edited during integration test.",
      p_edited_fields: { headline: "Edited headline for integration test", evidence_strength: "high" },
    });
    expect(error).toBeNull();

    const { data: signalAfter } = await serviceClient
      .from("signals")
      .select("headline, evidence_strength, publication_status, verification_status")
      .eq("id", SIGNAL_ID)
      .single();
    expect(signalAfter?.headline).toBe("Edited headline for integration test");
    expect(signalAfter?.evidence_strength).toBe("high");
    expect(signalAfter?.publication_status).toBe("published");
    expect(signalAfter?.verification_status).toBe("verified");

    const { data: latestAction } = await serviceClient
      .from("review_actions")
      .select("before_state, after_state, action")
      .eq("research_item_id", ITEM_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    expect(latestAction?.action).toBe("edit_approve");
    expect(latestAction?.before_state?.headline).toBe(before?.headline);
    expect(latestAction?.after_state?.headline).toBe("Edited headline for integration test");
  });

  it.each(["is_demo", "publication_status", "company_id", "created_by_type"])(
    "rejects a disallowed edit key (%s) without applying it, and publication_status/is_demo never change",
    async (disallowedKey) => {
      const serviceClient = getTestServiceClient();
      const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
      await resetDraftFixture(SIGNAL_ID, ITEM_ID);

      const { data: before } = await serviceClient
        .from("signals")
        .select("is_demo, publication_status")
        .eq("id", SIGNAL_ID)
        .single();

      const editedFields: Record<string, unknown> = {
        headline: "Should never be applied",
        [disallowedKey]: disallowedKey === "is_demo" ? false : "smuggled-value",
      };

      const { error } = await primaryClient.rpc("submit_review_action", {
        p_research_item_id: ITEM_ID,
        p_action: "edit_approve",
        p_reviewer_note: null,
        p_edited_fields: editedFields,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/does not permit editing column/i);

      const { data: after } = await serviceClient
        .from("signals")
        .select("is_demo, publication_status, headline")
        .eq("id", SIGNAL_ID)
        .single();
      expect(after?.is_demo).toBe(before?.is_demo);
      expect(after?.publication_status).toBe(before?.publication_status);
      expect(after?.headline).not.toBe("Should never be applied");
    },
  );
});

describe("submit_review_action: publish-time evidence requirement", () => {
  const SIGNAL_ID = "demo-signal-4-3";
  const ITEM_ID = "ri-demo-signal-4-3";

  beforeEach(async () => {
    await resetDraftFixture(SIGNAL_ID, ITEM_ID);
  });

  it("cannot publish a signal with no linked evidence", async () => {
    const serviceClient = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { data: evidenceRows } = await serviceClient
      .from("signal_evidence")
      .select("id, signal_id, source_document_id, support_type, supporting_passage, claim_type")
      .eq("signal_id", SIGNAL_ID);
    expect(evidenceRows?.length ?? 0).toBeGreaterThan(0);

    await serviceClient.from("signal_evidence").delete().eq("signal_id", SIGNAL_ID);

    try {
      const { error } = await primaryClient.rpc("submit_review_action", {
        p_research_item_id: ITEM_ID,
        p_action: "approve",
        p_reviewer_note: null,
        p_edited_fields: null,
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/no linked evidence/i);

      const { data: signalAfter } = await serviceClient
        .from("signals")
        .select("publication_status")
        .eq("id", SIGNAL_ID)
        .single();
      expect(signalAfter?.publication_status).toBe("draft");
    } finally {
      if (evidenceRows && evidenceRows.length > 0) {
        await serviceClient.from("signal_evidence").insert(evidenceRows);
      }
    }
  });
});

describe("submit_review_action: reviewer-gate-first ordering", () => {
  const combos: { label: string; researchItemId: string; action: string }[] = [
    { label: "a real, valid, actionable id/action", researchItemId: "ri-demo-signal-5-3", action: "approve" },
    { label: "a real id with an action invalid for its current status", researchItemId: "ri-demo-signal-1-1", action: "approve" },
    { label: "a syntactically plausible but nonexistent id", researchItemId: "ri-demo-signal-does-not-exist", action: "approve" },
    { label: "a garbage/malformed id", researchItemId: "!!!not-a-real-id!!!", action: "approve" },
  ];

  it.each(combos)("nonreviewer gets the identical 'not an active reviewer' error for $label", async ({ researchItemId, action }) => {
    const nonreviewerClient = await getSignedInClient(FIXTURE_EMAILS.nonreviewer());
    const { error } = await nonreviewerClient.rpc("submit_review_action", {
      p_research_item_id: researchItemId,
      p_action: action,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not an active reviewer/i);
  });

  it.each(combos)("inactive reviewer gets the identical 'not an active reviewer' error for $label", async ({ researchItemId, action }) => {
    const inactiveClient = await getSignedInClient(FIXTURE_EMAILS.inactive());
    const { error } = await inactiveClient.rpc("submit_review_action", {
      p_research_item_id: researchItemId,
      p_action: action,
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not an active reviewer/i);
  });
});

describe("derive_research_items_from_seed_signals: published-seed audit anchors", () => {
  it("every published signal has an approved research_item with a baseline approve anchor", async () => {
    const serviceClient = getTestServiceClient();

    const { count: publishedSignalsCount } = await serviceClient
      .from("signals")
      .select("*", { count: "exact", head: true })
      .eq("publication_status", "published");

    const { count: approvedItemsCount } = await serviceClient
      .from("research_items")
      .select("*", { count: "exact", head: true })
      .eq("item_type", "new_signal")
      .eq("status", "approved");

    expect(approvedItemsCount).toBe(publishedSignalsCount);

    const { data: baselineUsers } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const baselineUser = baselineUsers?.users.find((candidate: { email?: string }) => candidate.email === FIXTURE_EMAILS.baseline());
    expect(baselineUser).toBeDefined();

    const { count: anchorCount } = await serviceClient
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("action", "approve")
      .eq("reviewer_id", baselineUser?.id ?? "");
    expect(anchorCount).toBeGreaterThanOrEqual(publishedSignalsCount ?? 0);
  });

  it("re-running the derivation RPC does not duplicate baseline anchors", async () => {
    const serviceClient = getTestServiceClient();

    const { count: before } = await serviceClient
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("action", "approve");

    const { error } = await serviceClient.rpc("derive_research_items_from_seed_signals", {
      p_baseline_reviewer_email: FIXTURE_EMAILS.baseline(),
    });
    expect(error).toBeNull();

    const { count: after } = await serviceClient
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("action", "approve");

    expect(after).toBe(before);
  });
});

describe("submit_review_action: dispute on an originally-published seed signal", () => {
  const SIGNAL_ID = "demo-signal-1-1";
  const ITEM_ID = "ri-demo-signal-1-1";

  beforeEach(async () => {
    await resetPublishedFixture(SIGNAL_ID, ITEM_ID);
  });

  // `demo-signal-1-1` is hardcoded elsewhere (tests/integration/rls.test.ts,
  // public-data-reads.test.ts) as a stable "known always-published" fixture,
  // and this describe block's own test deliberately disputes/unpublishes
  // it — so it must be restored afterward too, not only reset before, or
  // every other file's "14 published signals" assumption breaks once this
  // file has run.
  afterEach(async () => {
    await resetPublishedFixture(SIGNAL_ID, ITEM_ID);
  });

  it("mark_disputed auto-unpublishes an originally-published seed signal and appends an audit row, invisible to anon immediately", async () => {
    const serviceClient = getTestServiceClient();
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());

    const { count: countBefore } = await serviceClient
      .from("review_actions")
      .select("*", { count: "exact", head: true })
      .eq("research_item_id", ITEM_ID);

    const { error } = await primaryClient.rpc("submit_review_action", {
      p_research_item_id: ITEM_ID,
      p_action: "mark_disputed",
      p_reviewer_note: "Integration test dispute.",
      p_edited_fields: null,
    });
    expect(error).toBeNull();

    const { data: signalAfter } = await serviceClient
      .from("signals")
      .select("publication_status, verification_status")
      .eq("id", SIGNAL_ID)
      .single();
    expect(signalAfter?.publication_status).toBe("in_review");
    expect(signalAfter?.verification_status).toBe("disputed");

    const { data: itemAfter } = await serviceClient.from("research_items").select("status").eq("id", ITEM_ID).single();
    expect(itemAfter?.status).toBe("disputed");

    const { count: countAfter, data: actionsAfter } = await serviceClient
      .from("review_actions")
      .select("*", { count: "exact" })
      .eq("research_item_id", ITEM_ID)
      .order("created_at", { ascending: false });
    expect(countAfter).toBe((countBefore ?? 0) + 1);
    expect(actionsAfter?.[0]?.action).toBe("mark_disputed");

    const anonClient = getPublicSupabaseClient();
    const { data: anonRead } = await anonClient.from("signals").select("id").eq("id", SIGNAL_ID);
    expect(anonRead).toEqual([]);
  });
});
