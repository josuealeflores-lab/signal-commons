import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The cookie/session-aware Supabase client — a THIRD client, distinct from
 * both the anon/publishable client (public-client.ts, stateless, no
 * session) and the service-role client (service-client.ts, bypasses RLS).
 * Uses only the publishable key plus the signed-in reviewer's own JWT (read
 * from request cookies via @supabase/ssr) — never the service-role key, so
 * RLS applies exactly as it does for any other authenticated caller.
 *
 * Used only under reviewer routes (auth/*, (reviewer)/*) — never imported
 * by repository.ts/dashboard.ts/browse.ts or any public-app code path.
 *
 * Deliberately NOT memoized across requests (unlike the other two clients):
 * it wraps request-specific cookies, so a fresh client is required per
 * request/Server Action/Route Handler call.
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

export async function getSessionSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render, which can't set cookies.
          // middleware.ts refreshes the session on the next request instead.
        }
      },
    },
  });
}
