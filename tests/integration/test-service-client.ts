import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * A service-role Supabase client for integration-test setup/verification
 * only (bypasses RLS by Supabase design) — used exclusively by
 * seeded-counts.test.ts, the one place a full draft+published row count
 * requires bypassing RLS (the anon client can never see draft rows at all).
 *
 * Deliberately NOT a re-export of src/lib/supabase/service-client.ts: that
 * module's `import "server-only"` guard throws unconditionally unless the
 * "react-server" export condition is active, which Next.js's own bundler
 * sets but Vitest does not (verified directly: setting
 * `resolve.conditions: ["react-server"]` in vitest.integration.config.ts
 * does not change this — the guard still throws under Vitest). Building a
 * separate, tiny client here avoids depending on that bundler-specific
 * behavior in the test runner.
 *
 * Never imported by any public app/data path — test-only.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} for npm run test:db.`);
  }
  return value;
}

let cachedClient: SupabaseClient | undefined;

export function getTestServiceClient(): SupabaseClient {
  if (!cachedClient) {
    const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    cachedClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}
