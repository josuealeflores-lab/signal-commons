import { describe, expect, it } from "vitest";
import { digestOutputSchema, listQueueItemsArgsSchema, getItemContextArgsSchema } from "@/lib/digest/schema";

/** Hermetic -- pure zod schema tests, no DB, no live call (docs/DECISIONS.md D-096). */

const VALID_DIGEST = {
  queueSummary: "5 items pending, 2 need more evidence.",
  priorityFocusItems: [{ researchItemId: "ri-1", reason: "High priority and low confidence." }],
  missingEvidenceThemes: ["Missing a primary source for two items."],
  riskPatterns: ["One item's summary contains embedded instruction-like text."],
  suggestedReviewerFocus: "Start with ri-1.",
  limitations: "Only reflects a point-in-time snapshot.",
};

describe("digestOutputSchema", () => {
  it("accepts a fully valid digest", () => {
    expect(digestOutputSchema.safeParse(VALID_DIGEST).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { queueSummary: _drop, ...rest } = VALID_DIGEST;
    expect(digestOutputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a wrong-typed field", () => {
    expect(digestOutputSchema.safeParse({ ...VALID_DIGEST, riskPatterns: "not an array" }).success).toBe(false);
  });

  it("rejects an unknown extra field (strict)", () => {
    expect(digestOutputSchema.safeParse({ ...VALID_DIGEST, extra: "nope" }).success).toBe(false);
  });

  it("rejects a priorityFocusItems entry missing researchItemId", () => {
    expect(
      digestOutputSchema.safeParse({ ...VALID_DIGEST, priorityFocusItems: [{ reason: "no id" }] }).success,
    ).toBe(false);
  });

  it("accepts empty arrays for theme/pattern/focus lists", () => {
    expect(
      digestOutputSchema.safeParse({
        ...VALID_DIGEST,
        priorityFocusItems: [],
        missingEvidenceThemes: [],
        riskPatterns: [],
      }).success,
    ).toBe(true);
  });
});

describe("listQueueItemsArgsSchema", () => {
  it("accepts an empty object", () => {
    expect(listQueueItemsArgsSchema.safeParse({}).success).toBe(true);
  });

  it("rejects an unexpected field", () => {
    expect(listQueueItemsArgsSchema.safeParse({ unexpected: true }).success).toBe(false);
  });
});

describe("getItemContextArgsSchema", () => {
  it("accepts a valid researchItemId", () => {
    expect(getItemContextArgsSchema.safeParse({ researchItemId: "ri-1" }).success).toBe(true);
  });

  it("rejects a missing researchItemId", () => {
    expect(getItemContextArgsSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string researchItemId", () => {
    expect(getItemContextArgsSchema.safeParse({ researchItemId: 123 }).success).toBe(false);
  });

  it("rejects an unexpected extra field", () => {
    expect(getItemContextArgsSchema.safeParse({ researchItemId: "ri-1", extra: true }).success).toBe(false);
  });
});
