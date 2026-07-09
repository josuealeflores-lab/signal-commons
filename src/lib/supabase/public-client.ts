import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The anon/publishable Supabase client — the ONLY client every public-app
 * read (repository.ts/dashboard.ts/browse.ts, and every Server Component
 * that calls them) is allowed to use. It is RLS-gated by design, so it's
 * safe even if it were ever shipped to the browser, though nothing in this
 * app currently does that — all data access stays server-side.
 *
 * Never import the service-role client (service-client.ts) from anywhere
 * in the public request path — see that file's own guard.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and populate it.`,
    );
  }
  return value;
}

let cachedClient: SupabaseClient | undefined;

export function getPublicSupabaseClient(): SupabaseClient {
  if (!cachedClient) {
    const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    cachedClient = createClient(url, publishableKey);
  }
  return cachedClient;
}
