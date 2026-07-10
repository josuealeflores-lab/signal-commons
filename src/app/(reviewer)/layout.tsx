import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionSupabaseClient } from "@/lib/supabase/session-client";

/**
 * Layer 2 of 3 protecting reviewer routes (docs/DECISIONS.md): middleware.ts
 * redirects unauthenticated requests before rendering; this layout re-checks
 * the session server-side and additionally checks reviewer_profiles.is_active
 * (a DB join middleware can't cheaply do on every matched request); RLS and
 * submit_review_action's own reviewer gate are the third, ultimately
 * authoritative layer.
 */
export default async function ReviewerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("reviewer_profiles")
    .select("id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
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
