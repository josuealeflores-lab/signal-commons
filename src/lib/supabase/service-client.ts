import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role Supabase client — bypasses RLS entirely by Supabase
 * design. `import "server-only"` above makes this module throw a
 * build/runtime error if it's ever imported into client-bundled code
 * (docs/DECISIONS.md D-044).
 *
 * Used exclusively by:
 * - supabase/seed.ts (the reseed_demo_data RPC caller)
 * - supabase/connector-usaspending.ts's --commit mode (M6C's
 *   commit_usaspending_candidate RPC caller and ingestion_runs
 *   read/write) -- imported dynamically there, only inside the --commit
 *   branch, never at that file's top level (see its header comment)
 * - controlled tests/integration/ setup code, where unavoidable
 *
 * Never imported by src/app/**, any component, or
 * repository.ts/dashboard.ts/browse.ts — those use only
 * src/lib/supabase/public-client.ts.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. This is a server-only credential — populate it in your local .env.local, never commit it.`,
    );
  }
  return value;
}

let cachedClient: SupabaseClient | undefined;

export function getServiceSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    cachedClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}
