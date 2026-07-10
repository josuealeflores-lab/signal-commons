import { getTestServiceClient } from "./test-service-client.ts";

/**
 * Vitest `globalSetup` for `npm run test:db` — runs once before any
 * integration test file, before a live Supabase connection is attempted.
 * Fails fast with a clear, actionable message naming the missing
 * variable(s)/setup step instead of letting each test fail with a cryptic
 * network/auth/"no rows found" error. Never prints the value of any
 * environment variable.
 */
export default async function setup(): Promise<void> {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TEST_REVIEWER_EMAIL",
    "TEST_REVIEWER_PASSWORD",
  ];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `npm run test:db requires credentials that are not set: ${missing.join(", ")}. ` +
        "Copy .env.example to .env.local and populate it, then re-run. (Values are never printed by this check.)",
    );
  }

  const supabase = getTestServiceClient();

  const { count: reviewerProfileCount, error: reviewerProfileError } = await supabase
    .from("reviewer_profiles")
    .select("*", { count: "exact", head: true });
  if (reviewerProfileError) {
    throw new Error(`npm run test:db could not verify reviewer fixture accounts: ${reviewerProfileError.message}`);
  }
  if (!reviewerProfileCount || reviewerProfileCount < 4) {
    throw new Error(
      "npm run test:db requires reviewer fixture accounts that have not been provisioned yet. " +
        "Run `npm run db:seed:reviewer` first.",
    );
  }

  const { count: pendingCount, error: pendingError } = await supabase
    .from("research_items")
    .select("*", { count: "exact", head: true })
    .eq("item_type", "new_signal")
    .eq("status", "pending");
  const { count: approvedCount, error: approvedError } = await supabase
    .from("research_items")
    .select("*", { count: "exact", head: true })
    .eq("item_type", "new_signal")
    .eq("status", "approved");
  if (pendingError || approvedError) {
    throw new Error(
      `npm run test:db could not verify research queue seed data: ${(pendingError ?? approvedError)?.message}`,
    );
  }
  if (!pendingCount || !approvedCount) {
    throw new Error(
      "npm run test:db requires research_items seed data that has not been derived yet. " +
        "Run `npm run db:seed:reviewer` then `npm run db:seed:queue` first.",
    );
  }

  const { count: anchorCount, error: anchorError } = await supabase
    .from("review_actions")
    .select("*", { count: "exact", head: true })
    .eq("action", "approve");
  if (anchorError) {
    throw new Error(`npm run test:db could not verify baseline review_actions anchors: ${anchorError.message}`);
  }
  if (!anchorCount) {
    throw new Error(
      "npm run test:db requires baseline review_actions anchors that have not been created yet. " +
        "Run `npm run db:seed:reviewer` then `npm run db:seed:queue` first.",
    );
  }
}
