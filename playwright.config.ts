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
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
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
