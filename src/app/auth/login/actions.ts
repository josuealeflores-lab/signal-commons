"use server";

import { redirect } from "next/navigation";
import { getSessionSupabaseClient } from "@/lib/supabase/session-client";

/**
 * Email/password sign-in only (docs/DECISIONS.md D-068) — no magic-link or
 * OAuth code exchange, so there's no callback route involved. Sets the
 * session cookie directly via session-client.ts's cookie adapter, then
 * redirects.
 */
export async function login(formData: FormData): Promise<void> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    redirect(`/auth/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  const supabase = await getSessionSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent("Invalid email or password.")}`);
  }

  redirect("/research-queue");
}
