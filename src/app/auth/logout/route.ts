import { NextResponse } from "next/server";
import { getSessionSupabaseClient } from "@/lib/supabase/session-client";

export async function POST(request: Request) {
  const supabase = await getSessionSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth/login", request.url));
}
