import { describe, expect, it } from "vitest";
import { decideReviewerAccess, getReviewerAccessDecision, type ReviewerAccessClient } from "@/lib/review/access";

/**
 * Hermetic -- every test here uses a plain object or a hand-built fake
 * client, never a live Supabase project (docs/DECISIONS.md D-100 Phase A:
 * this helper is app-layer UX/routing only, not the security boundary --
 * RLS and each RPC's own is_active re-check remain authoritative
 * regardless of what these tests prove about this module).
 */

const ACTIVE_USER = { id: "reviewer-1" };

function fakeClient(
  user: { id: string } | null,
  profile: { is_active: boolean } | null,
): ReviewerAccessClient {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile }),
        }),
      }),
    }),
  };
}

describe("decideReviewerAccess (pure decision logic)", () => {
  it("allows an active reviewer", () => {
    expect(decideReviewerAccess(ACTIVE_USER, { is_active: true })).toEqual({ allowed: true });
  });

  it("denies an inactive reviewer", () => {
    expect(decideReviewerAccess(ACTIVE_USER, { is_active: false })).toEqual({
      allowed: false,
      reason: "not_active_reviewer",
    });
  });

  it("denies a non-reviewer (authenticated user with no reviewer_profiles row)", () => {
    expect(decideReviewerAccess(ACTIVE_USER, null)).toEqual({
      allowed: false,
      reason: "not_active_reviewer",
    });
  });

  it("denies a missing session/user", () => {
    expect(decideReviewerAccess(null, undefined)).toEqual({ allowed: false, reason: "no_session" });
  });

  it("returns the exact decision shape the (reviewer) layout expects (a discriminated union keyed on `allowed`)", () => {
    const allowed = decideReviewerAccess(ACTIVE_USER, { is_active: true });
    expect(Object.keys(allowed).sort()).toEqual(["allowed"]);

    const denied = decideReviewerAccess(null, undefined);
    expect(Object.keys(denied).sort()).toEqual(["allowed", "reason"]);
  });
});

describe("getReviewerAccessDecision (fresh-per-call orchestration)", () => {
  it("allows an active reviewer via a fake client", async () => {
    const decision = await getReviewerAccessDecision(fakeClient(ACTIVE_USER, { is_active: true }));
    expect(decision).toEqual({ allowed: true });
  });

  it("denies an inactive reviewer via a fake client", async () => {
    const decision = await getReviewerAccessDecision(fakeClient(ACTIVE_USER, { is_active: false }));
    expect(decision).toEqual({ allowed: false, reason: "not_active_reviewer" });
  });

  it("denies a non-reviewer via a fake client", async () => {
    const decision = await getReviewerAccessDecision(fakeClient(ACTIVE_USER, null));
    expect(decision).toEqual({ allowed: false, reason: "not_active_reviewer" });
  });

  it("denies a missing session via a fake client", async () => {
    const decision = await getReviewerAccessDecision(fakeClient(null, null));
    expect(decision).toEqual({ allowed: false, reason: "no_session" });
  });

  it("never calls .rpc() on the client -- structurally proves this helper only performs an RLS-governed select, never an RPC/security-boundary call", async () => {
    const base = fakeClient(ACTIVE_USER, { is_active: true });
    const guarded = new Proxy(base as object, {
      get(target, prop, receiver) {
        if (prop === "rpc") {
          throw new Error(
            "getReviewerAccessDecision must never call .rpc() -- it is app-layer UX/routing only, not the security boundary (docs/DECISIONS.md D-100)",
          );
        }
        return Reflect.get(target, prop, receiver);
      },
    }) as ReviewerAccessClient;

    await expect(getReviewerAccessDecision(guarded)).resolves.toEqual({ allowed: true });
  });

  it("re-reads fresh on every call -- never caches is_active across invocations", async () => {
    let currentProfile: { is_active: boolean } | null = { is_active: true };
    const client: ReviewerAccessClient = {
      auth: { getUser: async () => ({ data: { user: ACTIVE_USER } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: currentProfile }),
          }),
        }),
      }),
    };

    const first = await getReviewerAccessDecision(client);
    expect(first).toEqual({ allowed: true });

    // Simulate an admin deactivating the reviewer mid-session, between
    // requests -- a second call against the same client object must
    // reflect this immediately, proving no internal caching/memoization.
    currentProfile = { is_active: false };
    const second = await getReviewerAccessDecision(client);
    expect(second).toEqual({ allowed: false, reason: "not_active_reviewer" });
  });
});
