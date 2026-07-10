import type { Metadata } from "next";
import { login } from "./actions";

export const metadata: Metadata = {
  title: "Reviewer sign in — Signal Commons",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

/**
 * Not linked from the public site (docs/DECISIONS.md D-022) — a reviewer
 * navigates here directly. No self-serve signup route exists; accounts are
 * provisioned only via the Supabase Auth Admin API.
 */
export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-24">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Reviewer sign in</h1>
        <p className="mt-2 text-sm text-slate-gray">
          Sign in to review the research queue. This area is not linked from the public site.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-border-subtle bg-surface px-4 py-3 text-sm text-ink">
          {error}
        </p>
      ) : null}

      <form action={login} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-border-subtle px-3 py-2 text-sm text-ink"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-border-subtle px-3 py-2 text-sm text-ink"
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-deep-teal px-4 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
