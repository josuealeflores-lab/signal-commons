/**
 * Vitest `globalSetup` for `npm run test:db` — runs once before any
 * integration test file, before a live Supabase connection is attempted.
 * Fails fast with a clear, actionable message naming the missing
 * variable(s) instead of letting each test fail with a cryptic network/auth
 * error. Never prints the value of any environment variable.
 */
export default function setup(): void {
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `npm run test:db requires Supabase credentials that are not set: ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and populate it, then re-run. (Values are never printed by this check.)",
    );
  }
}
