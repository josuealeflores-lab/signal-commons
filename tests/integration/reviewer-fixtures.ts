import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Test-only helpers for signing in as one of the five reviewer fixture
 * accounts (docs/DECISIONS.md D-066/D-069), provisioned by
 * `supabase/seed-reviewer.ts` via the same plus-addressing derivation used
 * there. Each call to `getSignedInClient` creates a fresh, independent
 * anon/publishable-key client and signs it in — never memoized/shared —
 * so tests can hold multiple simultaneous reviewer sessions side by side
 * (needed to prove one reviewer can't see another's `reviewer_profiles`
 * row). Uses only the publishable key + the signed-in user's own session,
 * never the service-role key.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} for npm run test:db.`);
  }
  return value;
}

function deriveFixtureEmail(baseEmail: string, suffix?: string): string {
  if (!suffix) return baseEmail;
  const atIndex = baseEmail.indexOf("@");
  if (atIndex === -1) {
    throw new Error("TEST_REVIEWER_EMAIL is not a valid email address.");
  }
  return `${baseEmail.slice(0, atIndex)}+${suffix}@${baseEmail.slice(atIndex + 1)}`;
}

export const FIXTURE_EMAILS = {
  primary: () => requireEnv("TEST_REVIEWER_EMAIL"),
  second: () => deriveFixtureEmail(requireEnv("TEST_REVIEWER_EMAIL"), "second"),
  nonreviewer: () => deriveFixtureEmail(requireEnv("TEST_REVIEWER_EMAIL"), "nonreviewer"),
  inactive: () => deriveFixtureEmail(requireEnv("TEST_REVIEWER_EMAIL"), "inactive"),
  baseline: () => deriveFixtureEmail(requireEnv("TEST_REVIEWER_EMAIL"), "baseline"),
};

export async function getSignedInClient(email: string): Promise<SupabaseClient> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  const password = requireEnv("TEST_REVIEWER_PASSWORD");

  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as a test reviewer fixture for npm run test:db: ${error.message}`);
  }
  return client;
}
