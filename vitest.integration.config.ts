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
  },
});
