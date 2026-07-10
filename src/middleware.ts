import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the reviewer's session cookie and redirects unauthenticated
 * requests to /auth/login. Scoped by `config.matcher` below to only
 * /research-queue/* and /reviewer/* — explicitly not /, /sectors,
 * /companies, /signals, /methodology, or /auth/* (no code-exchange
 * callback exists this milestone — see docs/DECISIONS.md D-068) — so the
 * public app's request path is untouched by this middleware at all.
 *
 * This is one of three independent layers protecting reviewer routes (the
 * other two: (reviewer)/layout.tsx's server-side session + is_active
 * re-check, and RLS/the RPC's own reviewer gate) — see
 * docs/DECISIONS.md for the reasoning behind not trusting any one layer
 * alone.
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

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/auth/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/research-queue/:path*", "/reviewer/:path*"],
};
