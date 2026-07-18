import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionSupabaseClient } from "@/lib/supabase/session-client";
import { getReviewerAccessDecision, type ReviewerAccessClient } from "@/lib/review/access";

/**
 * Layer 2 of 3 protecting reviewer routes (docs/DECISIONS.md): middleware.ts
 * redirects unauthenticated requests before rendering; this layout re-checks
 * the session server-side and additionally checks reviewer_profiles.is_active
 * (a DB join middleware can't cheaply do on every matched request); RLS and
 * submit_review_action's/record_copilot_analysis's own reviewer gate are the
 * third, ultimately authoritative layer. The decision itself now lives in
 * src/lib/review/access.ts (docs/DECISIONS.md D-100 Phase A) -- an app-layer
 * UX/routing helper only, re-evaluated fresh on every render, never the
 * security boundary.
 */
export default async function ReviewerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSessionSupabaseClient();
  // Narrowing cast, not a behavior change: the real SupabaseClient's
  // Postgrest query builder is too deeply generic/overloaded for TS to
  // structurally compare against ReviewerAccessClient's minimal interface
  // without hitting its instantiation-depth limit (the same category of
  // cast already used in src/lib/data/repository.ts for this reason).
  const decision = await getReviewerAccessDecision(supabase as unknown as ReviewerAccessClient);

  if (!decision.allowed) {
    if (decision.reason === "no_session") {
      redirect("/auth/login");
    }
    redirect(`/auth/login?error=${encodeURIComponent("Your reviewer access is not active.")}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <nav className="mb-6 flex items-center justify-between border-b border-border-subtle pb-4">
        <div className="flex gap-4 text-sm font-semibold text-ink">
          <Link href="/research-queue">Research queue</Link>
          <Link href="/reviewer">Reviewer dashboard</Link>
        </div>
        <form action="/auth/logout" method="post">
          <button type="submit" className="text-sm text-slate-gray underline underline-offset-2">
            Sign out
          </button>
        </form>
      </nav>
      {children}
    </div>
  );
}
