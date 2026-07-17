import { describe, expect, it } from "vitest";
import { SECTOR_CONTEXT, getSectorContext } from "@/lib/content/sector-context";
import { sectorSlugSchema } from "@/lib/data/schema";

/**
 * Structural proxy for the equal-treatment guardrail (docs/DECISIONS.md
 * D-099, Required plan change 3) -- a parity check that all seven canonical
 * sectors have context and that no entry is disproportionately longer or
 * shorter than another. This is not a substitute for human tone review, but
 * catches an accidental length imbalance automatically.
 */
describe("sector context parity", () => {
  it("has context for every one of the seven canonical sector slugs", () => {
    for (const slug of sectorSlugSchema.options) {
      expect(SECTOR_CONTEXT[slug]).toBeTruthy();
      expect(getSectorContext(slug).length).toBeGreaterThan(0);
    }
  });

  it("keeps every sector's context length within a comparable range of the shortest entry", () => {
    const lengths = sectorSlugSchema.options.map((slug) => SECTOR_CONTEXT[slug].length);
    const shortest = Math.min(...lengths);
    const longest = Math.max(...lengths);
    expect(longest / shortest).toBeLessThanOrEqual(1.5);
  });

  it("does not describe a fictional company or event as a real sector achievement", () => {
    for (const slug of sectorSlugSchema.options) {
      expect(SECTOR_CONTEXT[slug]).not.toMatch(/demo/i);
      expect(SECTOR_CONTEXT[slug]).not.toMatch(/fictional/i);
    }
  });
});
