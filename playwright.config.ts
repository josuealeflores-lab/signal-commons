import { defineConfig } from "@playwright/test";

const PORT = 3100;

/**
 * Runs against the real production build (next build && next start), not
 * next dev, on a dedicated port distinct from the default 3000 — a
 * developer's own `next dev` may already be using 3000 (this exact
 * conflict happened earlier in this project). The server command
 * explicitly binds to PORT via `next start -- -p 3100` rather than relying
 * on next start's default (docs/DECISIONS.md D-035).
 */
export default defineConfig({
  testDir: "./e2e",
  // After Milestone 3, every route this suite drives performs a live
  // Supabase read against the same single hosted dev project (not an
  // in-memory JSON lookup), so `npm run test:e2e` is no longer hermetic
  // (docs/DECISIONS.md D-049/D-033). The N+1 query pattern that made this
  // severe was fixed first (D-050) — measured single-request render times
  // dropped from ~9-10s to a 0.7-4.6s range. Remaining variance is ordinary
  // remote dev-database network latency, not a query-count bug, and was
  // still occasionally amplified by several Playwright workers hammering
  // that one dev project concurrently. `workers: 1` removes that
  // concurrency variable entirely (`fullyParallel` disabled to match); the
  // `expect`/navigation timeouts below are raised modestly (not "huge") to
  // comfortably clear the observed single-request range. No assertion was
  // weakened, removed, or skipped (docs/DECISIONS.md D-051).
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    navigationTimeout: 30_000,
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
