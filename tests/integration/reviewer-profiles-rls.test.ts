import { describe, expect, it } from "vitest";
import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import { FIXTURE_EMAILS, getSignedInClient } from "./reviewer-fixtures";

/**
 * Directly answers the reviewer_profiles RLS gap: anon has no visibility
 * into reviewer identities at all; an active reviewer can read only their
 * own row, never another reviewer's; a merely-authenticated non-reviewer
 * and a deactivated reviewer both get zero draft/reviewer-only visibility
 * and are both rejected by submit_review_action's own in-function gate —
 * not just by whatever an M3 policy happens to allow for `authenticated`.
 */

const DRAFT_SIGNAL_ID = "demo-signal-1-3";
const A_RESEARCH_ITEM_ID = "ri-demo-signal-1-3";

describe("reviewer_profiles RLS", () => {
  it("anon cannot read reviewer_profiles", async () => {
    const supabase = getPublicSupabaseClient();
    const { data, error } = await supabase.from("reviewer_profiles").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an active reviewer can read only their own reviewer profile", async () => {
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
    const {
      data: { user },
    } = await primaryClient.auth.getUser();

    const { data, error } = await primaryClient.from("reviewer_profiles").select("id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe(user?.id);
  });

  it("an active reviewer cannot read another reviewer's profile row", async () => {
    const primaryClient = await getSignedInClient(FIXTURE_EMAILS.primary());
    const secondClient = await getSignedInClient(FIXTURE_EMAILS.second());

    const {
      data: { user: secondUser },
    } = await secondClient.auth.getUser();
    expect(secondUser).not.toBeNull();

    const { data, error } = await primaryClient.from("reviewer_profiles").select("id").eq("id", secondUser?.id ?? "");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a non-reviewer authenticated user cannot read reviewer-only (draft) content", async () => {
    const nonreviewerClient = await getSignedInClient(FIXTURE_EMAILS.nonreviewer());
    const { data, error } = await nonreviewerClient.from("signals").select("id").eq("id", DRAFT_SIGNAL_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("an inactive reviewer cannot read reviewer-only (draft) content", async () => {
    const inactiveClient = await getSignedInClient(FIXTURE_EMAILS.inactive());
    const { data, error } = await inactiveClient.from("signals").select("id").eq("id", DRAFT_SIGNAL_ID);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("a non-reviewer authenticated user cannot call submit_review_action successfully", async () => {
    const nonreviewerClient = await getSignedInClient(FIXTURE_EMAILS.nonreviewer());
    const { error } = await nonreviewerClient.rpc("submit_review_action", {
      p_research_item_id: A_RESEARCH_ITEM_ID,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not an active reviewer/i);
  });

  it("an inactive reviewer cannot call submit_review_action successfully", async () => {
    const inactiveClient = await getSignedInClient(FIXTURE_EMAILS.inactive());
    const { error } = await inactiveClient.rpc("submit_review_action", {
      p_research_item_id: A_RESEARCH_ITEM_ID,
      p_action: "approve",
      p_idempotency_key: crypto.randomUUID(),
      p_reviewer_note: null,
      p_edited_fields: null,
    });
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/not an active reviewer/i);
  });
});
