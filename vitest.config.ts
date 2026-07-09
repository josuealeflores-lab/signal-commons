import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Scoped to tests/** (Vitest's own suite) and explicitly excludes
    // e2e/** (Playwright's suite) so the two test runners never collide —
    // e.g. Vitest picking up e2e/smoke.spec.ts, or `npm test` accidentally
    // running Playwright specs (docs/DECISIONS.md D-034).
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
