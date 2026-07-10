import { expect, test } from "@playwright/test";
import { getTestServiceClient } from "../tests/integration/test-service-client";

/**
 * End-to-end reviewer publish-gate smoke test (docs/DECISIONS.md D-064).
 * Reuses the existing `tests/integration/test-service-client.ts` as-is (a
 * plain module with no vitest-specific dependency) rather than duplicating
 * a service-role client wrapper here — used only in this Node test-runner
 * process for setup, never inside the deployed app or a browser.
 *
 * The reset below touches only `signals`/`research_items` status columns
 * for one known fixture — never `seed/demo-data.json`, and never a
 * `DELETE` against `review_actions` (append-only holds even in test
 * setup, per D-066).
 */

const FIXTURE_SIGNAL_ID = "demo-signal-1-3";
const FIXTURE_ITEM_ID = "ri-demo-signal-1-3";

async function resetFixture(): Promise<void> {
  const supabase = getTestServiceClient();
  await supabase
    .from("signals")
    .update({ publication_status: "draft", verification_status: "unverified" })
    .eq("id", FIXTURE_SIGNAL_ID);
  await supabase
    .from("research_items")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("id", FIXTURE_ITEM_ID);
}

test.beforeAll(resetFixture);

// The test below deliberately ends with the fixture disputed (in_review),
// not draft — `npm run test:db`'s seeded-counts.test.ts hardcodes "7 draft
// signals" globally, so leaving this fixture at anything but draft after
// the run breaks that count for the next `test:db` invocation. Restore it
// after this file's tests finish too, not only before.
test.afterAll(resetFixture);

test("reviewer logs in, approves a draft signal (making it public), then disputes it (making it private again)", async ({
  page,
}) => {
  const email = process.env.TEST_REVIEWER_EMAIL;
  const password = process.env.TEST_REVIEWER_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_REVIEWER_EMAIL/TEST_REVIEWER_PASSWORD must be set for npm run test:e2e's reviewer spec.");
  }

  // Log in with the primary test reviewer account.
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/research-queue$/);

  // The draft signal is not yet public.
  const beforeApprove = await page.goto(`/signals/${FIXTURE_SIGNAL_ID}`);
  expect(beforeApprove?.status()).toBe(404);

  // Open the fixture research item and approve it.
  await page.goto(`/research-queue/${FIXTURE_ITEM_ID}`);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText(/queue status: approved/i)).toBeVisible();

  // The signal is now visible on the public /signals route.
  await page.goto(`/signals/${FIXTURE_SIGNAL_ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Dispute it via the queue's dispute action.
  await page.goto(`/research-queue/${FIXTURE_ITEM_ID}`);
  await page.getByRole("button", { name: "Mark disputed" }).click();
  await expect(page.getByText(/queue status: disputed/i)).toBeVisible();

  // The signal has disappeared from public view again, immediately.
  const afterDispute = await page.goto(`/signals/${FIXTURE_SIGNAL_ID}`);
  expect(afterDispute?.status()).toBe(404);
});
