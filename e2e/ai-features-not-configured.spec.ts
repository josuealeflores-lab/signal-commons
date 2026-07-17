import { expect, test } from "@playwright/test";

/**
 * Read-only, zero-write e2e coverage for the M9 "not configured" AI
 * messaging (docs/DECISIONS.md D-097). Both flows below fail before any
 * database write or live provider call occurs: the missing-key check in
 * src/lib/copilot/client.ts and src/lib/digest/client.ts throws
 * ModelNotConfiguredError before any fetch to Anthropic, and (for
 * Copilot) before record_copilot_analysis is ever called. No fixture
 * reset is needed -- nothing is mutated by either flow, and neither test
 * depends on the fixture item's review status.
 *
 * This spec assumes ANTHROPIC_API_KEY is NOT set in the environment that
 * runs `npm run test:e2e` (confirmed absent from .env.local at
 * implementation time, which is what the npm script's --env-file loads).
 * If a key is ever added to that environment, these two tests would need
 * to inject a mock provider instead of relying on the key's absence.
 */

const FIXTURE_ITEM_ID = "ri-demo-signal-1-3";

async function loginAsFixtureReviewer(page: import("@playwright/test").Page): Promise<void> {
  const email = process.env.TEST_REVIEWER_EMAIL;
  const password = process.env.TEST_REVIEWER_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_REVIEWER_EMAIL/TEST_REVIEWER_PASSWORD must be set for npm run test:e2e's AI-features spec.");
  }

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/research-queue$/);
}

test("Copilot 'Run analysis' shows an honest not-configured message when no provider key is present", async ({ page }) => {
  await loginAsFixtureReviewer(page);

  await page.goto(`/research-queue/${FIXTURE_ITEM_ID}`);
  await page.getByRole("button", { name: "Run Copilot analysis" }).click();
  await expect(page.getByText("AI features are not configured in this environment.")).toBeVisible();

  // No unhandled error / broken page state -- the page still renders normally.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("Digest 'Generate queue digest' shows an honest not-configured message when no provider key is present", async ({ page }) => {
  await loginAsFixtureReviewer(page);

  await page.goto("/reviewer");
  await page.getByRole("button", { name: "Generate queue digest" }).click();
  await expect(page.getByText("AI features are not configured in this environment.")).toBeVisible();

  // No unhandled error / broken page state -- the trigger button is still present and enabled.
  await expect(page.getByRole("button", { name: "Generate queue digest" })).toBeEnabled();
});
