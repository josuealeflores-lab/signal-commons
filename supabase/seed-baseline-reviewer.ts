import { randomUUID } from "node:crypto";
import { getServiceSupabaseClient } from "../src/lib/supabase/service-client.ts";

/**
 * Provisions exactly one production-safe "Demo Baseline Reviewer" system
 * identity (docs/DECISIONS.md D-075), used solely so
 * derive_research_items_from_seed_signals can attribute the baseline
 * "approve" review_actions anchors for already-published seed signals to a
 * real reviewer_profiles row. This identity is never meant to log in.
 *
 * Deliberately separate from supabase/seed-reviewer.ts's five-account,
 * shared-password dev/CI fixture set — that script must never run against
 * production. This script creates only one auth.users row plus one
 * reviewer_profiles row with is_active = false, so it structurally cannot
 * pass submit_review_action's reviewer gate or the reviewer_profiles RLS
 * self-select policy (both require is_active = true). The
 * review_actions.reviewer_id foreign key only requires the reviewer_profiles
 * row to exist, not is_active — so the baseline-anchor inserts still work.
 *
 * The account's password is generated locally at creation time, used once,
 * and never logged, stored, or reused — this identity has no legitimate
 * login path, so the password is discarded immediately after creation.
 * Idempotent (create-if-missing): safe to re-run any number of times.
 */

const DEFAULT_BASELINE_REVIEWER_EMAIL = "baseline@signal-commons.invalid";
const DISPLAY_NAME = "Demo Baseline Reviewer (system identity — not a real reviewer, never used for login)";

async function main() {
  const email = process.env.BASELINE_REVIEWER_EMAIL || DEFAULT_BASELINE_REVIEWER_EMAIL;
  const supabase = getServiceSupabaseClient();

  console.log(`Ensuring Demo Baseline Reviewer identity exists (${email})...`);

  const generatedPassword = randomUUID() + randomUUID();

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: generatedPassword,
    email_confirm: true,
  });

  let userId: string | undefined = created?.user?.id;

  if (createError) {
    const alreadyExists = createError.message.toLowerCase().includes("already") || createError.code === "email_exists";
    if (!alreadyExists) {
      console.error(`Failed to provision the Demo Baseline Reviewer: ${createError.message}`);
      process.exitCode = 1;
      return;
    }

    const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      console.error(`Failed to look up the existing Demo Baseline Reviewer: ${listError.message}`);
      process.exitCode = 1;
      return;
    }
    const match = existing.users.find((candidate) => candidate.email === email);
    if (!match) {
      console.error("Demo Baseline Reviewer reported as already existing but could not be found.");
      process.exitCode = 1;
      return;
    }
    userId = match.id;
  }

  if (!userId) {
    console.error("Could not resolve a user id for the Demo Baseline Reviewer.");
    process.exitCode = 1;
    return;
  }

  const { error: upsertError } = await supabase
    .from("reviewer_profiles")
    .upsert({ id: userId, display_name: DISPLAY_NAME, is_active: false }, { onConflict: "id" });
  if (upsertError) {
    console.error(`Failed to upsert reviewer_profiles for the Demo Baseline Reviewer: ${upsertError.message}`);
    process.exitCode = 1;
    return;
  }

  console.log("Demo Baseline Reviewer identity is ready (is_active = false, not a usable reviewer login).");
}

main();
