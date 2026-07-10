import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Separate config for tests/integration/** — real network calls against the
 * live seeded Supabase project, using the anon/publishable client (RLS is
 * genuinely exercised, not bypassed) except where a test explicitly needs
 * the service-role client for setup/verification. Kept out of
 * vitest.config.ts's scope entirely (see its own exclude list) so `npm test`
 * stays hermetic and `npm run test:db` is the only command that requires
 * live Supabase credentials (docs/DECISIONS.md D-049).
 *
 * `fileParallelism: false` (Milestone 4): once publish-gate.test.ts started
 * doing real mutations against shared signal rows (even transiently reset
 * before/after each test), Vitest's default parallel-file execution raced
 * against other files' exact-count assertions (rls.test.ts,
 * public-data-reads.test.ts, seeded-counts.test.ts) reading those same rows
 * mid-mutation — the exact same class of concurrent-worker-vs-shared-live-DB
 * problem D-051 already fixed for Playwright (`workers: 1`). Test files now
 * run sequentially against the one shared dev project.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    globalSetup: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.{test,spec}.ts"],
    testTimeout: 45000,
    hookTimeout: 45000,
    fileParallelism: false,
  },
});
