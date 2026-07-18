/**
 * App-layer reviewer access-gate decision (docs/DECISIONS.md D-100, M11
 * Phase A).
 *
 * This module decides what the `(reviewer)` route group's layout should do
 * -- render its children, or redirect somewhere -- based on the current
 * request's session and `reviewer_profiles` row. It exists purely to
 * support reviewer routing/UX and to close a real gap: until now, this
 * check lived inline in a server component with zero hermetic (`npm test`)
 * coverage, only ever exercised end-to-end via a live login in
 * `e2e/reviewer-workflow.spec.ts`.
 *
 * This module is NOT the security boundary and must never be described as
 * one. RLS policies on every content table, and each mutation RPC's own
 * first-statement `is_active` re-check (`submit_review_action`,
 * `record_copilot_analysis`), remain authoritative regardless of what this
 * module decides -- if this module were deleted entirely, no unauthorized
 * read or write would become possible, because RLS and the RPCs would still
 * deny it. This module only controls what a signed-in browser is shown; it
 * grants no trust of its own.
 *
 * Always evaluated fresh, per request: nothing here is cached across
 * requests or invocations. `getReviewerAccessDecision` re-reads the session
 * and `reviewer_profiles` row on every single call, via whatever
 * session-scoped Supabase client the caller passes in -- mirroring
 * `session-client.ts`'s own documented "deliberately not memoized across
 * requests" stance, since a reviewer's `is_active` flag can change between
 * one request and the next (e.g. an admin deactivating the account
 * mid-session) and this check must reflect that immediately, never a stale
 * snapshot.
 */

export type ReviewerAccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "no_session" | "not_active_reviewer" };

interface ReviewerProfileRow {
  is_active: boolean;
}

/**
 * Pure decision logic -- no I/O, no Supabase client, no framework
 * dependency. Hermetically testable with plain objects, and the one place
 * this module's actual allow/deny rule lives.
 */
export function decideReviewerAccess(
  user: { id: string } | null,
  profile: ReviewerProfileRow | null | undefined,
): ReviewerAccessDecision {
  if (!user) {
    return { allowed: false, reason: "no_session" };
  }
  if (!profile || !profile.is_active) {
    return { allowed: false, reason: "not_active_reviewer" };
  }
  return { allowed: true };
}

/**
 * The minimal client surface this module needs -- deliberately narrower
 * than the full Supabase `SupabaseClient` type (which structurally
 * satisfies this interface), so a hermetic test can supply a small fake
 * without implementing the real client's entire surface. Notably, this
 * interface has no `.rpc(...)` method: this module only ever performs a
 * single RLS-governed `select` against `reviewer_profiles`, and must never
 * call an RPC -- doing so would blur this UX helper with the actual
 * security-boundary RPCs it explicitly defers to.
 */
export interface ReviewerAccessClient {
  auth: {
    getUser(): Promise<{ data: { user: { id: string } | null } }>;
  };
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        // PromiseLike, not Promise: the real Supabase client's Postgrest
        // query builder is thenable but not nominally a Promise instance --
        // this keeps the real SupabaseClient structurally assignable here
        // without widening this interface any further than necessary.
        maybeSingle(): PromiseLike<{ data: ReviewerProfileRow | null }>;
      };
    };
  };
}

/**
 * Orchestrates one fresh read of the current request's session and
 * reviewer profile, then applies the pure decision above. Takes the
 * Supabase client as a parameter (dependency injection) rather than
 * constructing one itself, so: (a) it holds no state of its own and caches
 * nothing across calls -- every invocation re-reads via whatever client the
 * caller passes in; and (b) it stays hermetically testable with a fake
 * client, no live Supabase project required.
 */
export async function getReviewerAccessDecision(
  supabase: ReviewerAccessClient,
): Promise<ReviewerAccessDecision> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return decideReviewerAccess(null, undefined);
  }

  const { data: profile } = await supabase
    .from("reviewer_profiles")
    .select("id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  return decideReviewerAccess(user, profile);
}
