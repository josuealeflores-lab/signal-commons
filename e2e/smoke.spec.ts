import { expect, test } from "@playwright/test";

/**
 * Minimal smoke suite regression-protecting the public route chain and the
 * draft/unknown-signal 404 boundary before Milestone 3 swaps the
 * JSON-repository data layer for Supabase (docs/DECISIONS.md D-031, D-033).
 *
 * These fixtures (company slugs, signal ids, sector names) are coupled to
 * the current seed/demo-data.json — expect to revisit this file during the
 * Milestone 3 data-layer swap (docs/DECISIONS.md D-033).
 */

test("dashboard route loads", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /emerging ai impact radar/i, level: 1 }),
  ).toBeVisible();
});

test("demo-data banner appears", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/demo data:/i)).toBeVisible();
});

test("dashboard -> Sectors -> Healthcare sector -> healthcare company path works", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sectors", exact: true }).click();
  await expect(page).toHaveURL(/\/sectors$/);

  await page.getByText("Healthcare", { exact: true }).click();
  await expect(page).toHaveURL(/\/sectors\/healthcare$/);

  await page.getByText("MedScribe Demo").click();
  await expect(page).toHaveURL(/\/companies\/medscribe-demo$/);
  await expect(page.getByRole("heading", { name: "MedScribe Demo", level: 1 })).toBeVisible();
});

test("dashboard -> Signals -> signal detail path works", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Signals", exact: true }).click();
  await expect(page).toHaveURL(/\/signals$/);

  const firstSignalLink = page.locator('a[href^="/signals/demo-signal-"]').first();
  await firstSignalLink.click();
  await expect(page).toHaveURL(/\/signals\/demo-signal-[\w-]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("signal detail page displays evidence strength and verification status separately", async ({ page }) => {
  await page.goto("/signals/demo-signal-1-1");
  // StatusPill renders a screen-reader-only prefix ("Evidence strength: ")
  // as sibling text within the same element, so the badge's full text is
  // "Evidence strength: High" / "Verification status: Verified" — matching
  // without `exact` confirms both distinct badges are present and visible.
  await expect(page.getByText("Evidence strength: High")).toBeVisible();
  await expect(page.getByText("Verification status: Verified")).toBeVisible();
});

test("signal source link is present with safe attributes and is never navigated to", async ({ page }) => {
  await page.goto("/signals/demo-signal-1-1");

  const sourceLink = page.getByRole("link", { name: "Fictional evidence packet for CivicLens Demo" });
  await expect(sourceLink).toBeVisible();

  const href = await sourceLink.getAttribute("href");
  expect(href).toMatch(/^https:\/\/example\.com\//);
  await expect(sourceLink).toHaveAttribute("target", "_blank");
  await expect(sourceLink).toHaveAttribute("rel", "noopener noreferrer");
  // Deliberately never .click()'d or navigated to — attribute-only verification.
});

test("unknown signal id returns the branded 404", async ({ page }) => {
  const response = await page.goto("/signals/demo-signal-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to dashboard/i })).toBeVisible();
});

test("draft signal id behaves identically to an unknown id and never leaks its content", async ({ page }) => {
  const response = await page.goto("/signals/demo-signal-1-3");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /back to dashboard/i })).toBeVisible();

  await expect(page.getByText(/demo partnership signal recorded/i)).toHaveCount(0);
  await expect(
    page.getByText(/a fictional partnership is included to exercise the research and evidence interface/i),
  ).toHaveCount(0);
});
