import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

/**
 * Stable public structural routes only (docs/DECISIONS.md D-099) -- no
 * per-sector/per-company/per-signal detail route, and never a reviewer,
 * auth, or draft/private route. sitemap.ts fetches nothing, so there is no
 * data-derived route to accidentally leak here.
 */
describe("sitemap", () => {
  it("includes only the approved stable public structural routes", () => {
    const entries = sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths.sort()).toEqual(
      ["/", "/about", "/companies", "/methodology", "/sectors", "/signals"].sort(),
    );
  });

  it("never includes a reviewer, research-queue, or auth route", () => {
    const entries = sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths.some((p) => p.startsWith("/reviewer"))).toBe(false);
    expect(paths.some((p) => p.startsWith("/research-queue"))).toBe(false);
    expect(paths.some((p) => p.startsWith("/auth"))).toBe(false);
  });

  it("never includes an individual signal detail URL (UUID ids, no slug strategy yet)", () => {
    const entries = sitemap();
    const paths = entries.map((entry) => new URL(entry.url).pathname);
    expect(paths.some((p) => /^\/signals\/.+/.test(p))).toBe(false);
  });

  it("uses the confirmed custom domain for every entry", () => {
    const entries = sitemap();
    expect(entries.every((entry) => entry.url.startsWith("https://signal-commons.org"))).toBe(true);
  });
});
