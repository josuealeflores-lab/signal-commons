import { getServiceSupabaseClient } from "../src/lib/supabase/service-client.ts";

/**
 * Derives research_items (and, for already-published seed signals,
 * baseline review_actions anchors) from the current seed signals, via the
 * derive_research_items_from_seed_signals RPC (docs/DECISIONS.md
 * D-059/D-069). Kept isolated from supabase/seed.ts and the Milestone 3
 * reseed_demo_data migration — neither needs any changes for this.
 *
 * Requires the baseline reviewer account to already be provisioned before
 * this runs: this script passes that account's email to the RPC, which
 * fails loudly (not silently) if the account doesn't exist yet, making the
 * "reviewer seed before queue seed" order an enforced dependency, not just
 * documentation.
 *
 * Baseline reviewer email resolution (docs/DECISIONS.md D-075): prefers
 * BASELINE_REVIEWER_EMAIL if set (the production path, provisioned by
 * supabase/seed-baseline-reviewer.ts's inactive Demo Baseline Reviewer
 * identity); otherwise falls back to the existing plus-addressing
 * derivation from TEST_REVIEWER_EMAIL (the dev/CI path, unchanged,
 * provisioned by supabase/seed-reviewer.ts's five-account fixture set).
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function deriveBaselineReviewerEmail(baseEmail: string): string {
  const atIndex = baseEmail.indexOf("@");
  if (atIndex === -1) {
    throw new Error("TEST_REVIEWER_EMAIL is not a valid email address.");
  }
  return `${baseEmail.slice(0, atIndex)}+baseline@${baseEmail.slice(atIndex + 1)}`;
}

function resolveBaselineReviewerEmail(): string {
  const override = process.env.BASELINE_REVIEWER_EMAIL;
  if (override) return override;
  return deriveBaselineReviewerEmail(requireEnv("TEST_REVIEWER_EMAIL"));
}

async function main() {
  const baselineReviewerEmail = resolveBaselineReviewerEmail();
  const supabase = getServiceSupabaseClient();

  console.log("Deriving research_items and baseline review_actions anchors from seed signals...");
  const { error } = await supabase.rpc("derive_research_items_from_seed_signals", {
    p_baseline_reviewer_email: baselineReviewerEmail,
  });

  if (error) {
    console.error("derive_research_items_from_seed_signals RPC failed:");
    console.error(`  message: ${error.message}`);
    if (error.details) console.error(`  details: ${error.details}`);
    if (error.hint) console.error(`  hint: ${error.hint}`);
    process.exitCode = 1;
    return;
  }

  console.log("Queue seeding complete.");
}

main();
