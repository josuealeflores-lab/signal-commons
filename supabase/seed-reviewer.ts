import { getServiceSupabaseClient } from "../src/lib/supabase/service-client.ts";

/**
 * Provisions the five deterministic test fixture reviewer accounts
 * (docs/DECISIONS.md D-066/D-069) via the Supabase Auth Admin API — plain
 * SQL can't create auth.users rows directly. Idempotent (create-if-missing,
 * never delete-and-recreate) so repeated test:db/test:e2e/CI runs don't
 * invalidate existing sessions or fail on a second run.
 *
 * Requires only TEST_REVIEWER_EMAIL and TEST_REVIEWER_PASSWORD. All five
 * fixture accounts are derived from those two values via plus-addressing —
 * no other env var names needed:
 *   - <email>              -> primary active reviewer
 *   - <email>+second       -> second active reviewer (row-isolation proof)
 *   - <email>+nonreviewer  -> authenticated, no reviewer_profiles row
 *   - <email>+inactive     -> reviewer_profiles row with is_active = false
 *   - <email>+baseline     -> Demo Baseline Reviewer (seed-research-queue.ts's anchor attribution)
 *
 * Never prints the password or any other secret value — only generic
 * progress messages.
 */

interface FixtureSpec {
  suffix?: string;
  displayName: string;
  isActive: boolean;
  createReviewerProfile: boolean;
}

const FIXTURES: FixtureSpec[] = [
  { displayName: "Primary Test Reviewer", isActive: true, createReviewerProfile: true },
  { suffix: "second", displayName: "Second Test Reviewer", isActive: true, createReviewerProfile: true },
  { suffix: "nonreviewer", displayName: "Non-Reviewer Test Account", isActive: false, createReviewerProfile: false },
  { suffix: "inactive", displayName: "Inactive Test Reviewer", isActive: false, createReviewerProfile: true },
  { suffix: "baseline", displayName: "Demo Baseline Reviewer", isActive: true, createReviewerProfile: true },
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}.`);
  }
  return value;
}

function deriveFixtureEmail(baseEmail: string, suffix?: string): string {
  if (!suffix) return baseEmail;
  const atIndex = baseEmail.indexOf("@");
  if (atIndex === -1) {
    throw new Error("TEST_REVIEWER_EMAIL is not a valid email address.");
  }
  return `${baseEmail.slice(0, atIndex)}+${suffix}@${baseEmail.slice(atIndex + 1)}`;
}

async function main() {
  const baseEmail = requireEnv("TEST_REVIEWER_EMAIL");
  const password = requireEnv("TEST_REVIEWER_PASSWORD");
  const supabase = getServiceSupabaseClient();

  for (const fixture of FIXTURES) {
    const email = deriveFixtureEmail(baseEmail, fixture.suffix);
    console.log(`Ensuring fixture account exists: ${fixture.displayName}...`);

    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    let userId: string | undefined = created?.user?.id;

    if (createError) {
      const alreadyExists =
        createError.message.toLowerCase().includes("already") || createError.code === "email_exists";
      if (!alreadyExists) {
        console.error(`Failed to provision ${fixture.displayName}: ${createError.message}`);
        process.exitCode = 1;
        return;
      }

      const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) {
        console.error(`Failed to look up existing user for ${fixture.displayName}: ${listError.message}`);
        process.exitCode = 1;
        return;
      }
      const match = existing.users.find((candidate) => candidate.email === email);
      if (!match) {
        console.error(`${fixture.displayName} reported as already existing but could not be found.`);
        process.exitCode = 1;
        return;
      }
      userId = match.id;
    }

    if (!userId) {
      console.error(`Could not resolve a user id for ${fixture.displayName}.`);
      process.exitCode = 1;
      return;
    }

    if (fixture.createReviewerProfile) {
      const { error: upsertError } = await supabase
        .from("reviewer_profiles")
        .upsert({ id: userId, display_name: fixture.displayName, is_active: fixture.isActive }, { onConflict: "id" });
      if (upsertError) {
        console.error(`Failed to upsert reviewer_profiles for ${fixture.displayName}: ${upsertError.message}`);
        process.exitCode = 1;
        return;
      }
    }

    console.log("  done.");
  }

  console.log("All reviewer fixture accounts are ready.");
}

main();
