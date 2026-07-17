import { describe, expect, it } from "vitest";
import robots from "@/app/robots";

/**
 * Demo-only default is noindex (docs/DECISIONS.md D-099): while every
 * public record is fictional, nothing should be presented to crawlers as
 * real, indexable content, and reviewer/auth routes must never be
 * crawlable regardless.
 */
describe("robots", () => {
  it("disallows the entire site by default while demo-only", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.disallow).toContain("/");
  });

  it("explicitly disallows reviewer, research-queue, and auth routes", () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
    expect(rules?.disallow).toContain("/reviewer");
    expect(rules?.disallow).toContain("/research-queue");
    expect(rules?.disallow).toContain("/auth");
  });

  it("references the sitemap on the confirmed custom domain", () => {
    const result = robots();
    expect(result.sitemap).toBe("https://signal-commons.org/sitemap.xml");
  });
});
