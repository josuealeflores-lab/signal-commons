import { describe, expect, it } from "vitest";
import { copilotAnalysisOutputSchema, SUGGESTED_NEXT_STEP_VALUES, RESEARCH_ITEM_STATUS_VALUES } from "@/lib/copilot/schema";
import { reviewActionSchema } from "@/lib/review/schema";

/**
 * Hermetic -- copilotAnalysisOutputSchema validates the model's
 * structured output (docs/DECISIONS.md D-095) before it ever reaches
 * record_copilot_analysis. suggestedNextStep's vocabulary must remain
 * disjoint from both submit_review_action's real action verbs and
 * research_items.status's real values -- pinned here, not just asserted
 * in docs.
 */

const VALID_OUTPUT = {
  summary: "A summary.",
  riskFlags: ["flag one"],
  missingEvidenceQuestions: ["question one"],
  suggestedNextStep: "leans_approve",
  confidence: "medium",
  limitations: "None noted.",
};

describe("copilotAnalysisOutputSchema", () => {
  it("accepts a fully valid output", () => {
    expect(copilotAnalysisOutputSchema.safeParse(VALID_OUTPUT).success).toBe(true);
  });

  it("accepts null limitations", () => {
    expect(copilotAnalysisOutputSchema.safeParse({ ...VALID_OUTPUT, limitations: null }).success).toBe(true);
  });

  it.each(SUGGESTED_NEXT_STEP_VALUES)("accepts the approved suggestedNextStep value '%s'", (value) => {
    expect(copilotAnalysisOutputSchema.safeParse({ ...VALID_OUTPUT, suggestedNextStep: value }).success).toBe(true);
  });

  it.each(["low", "medium", "high"])("accepts the approved confidence value '%s'", (value) => {
    expect(copilotAnalysisOutputSchema.safeParse({ ...VALID_OUTPUT, confidence: value }).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const rest: Partial<typeof VALID_OUTPUT> = { ...VALID_OUTPUT };
    delete rest.summary;
    expect(copilotAnalysisOutputSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a wrong-type field", () => {
    expect(copilotAnalysisOutputSchema.safeParse({ ...VALID_OUTPUT, riskFlags: "not an array" }).success).toBe(false);
  });

  it("rejects an unknown extra field (strict schema)", () => {
    expect(copilotAnalysisOutputSchema.safeParse({ ...VALID_OUTPUT, extra: "field" }).success).toBe(false);
  });

  it.each(reviewActionSchema.options)("rejects the real review action verb '%s' as suggestedNextStep", (verb) => {
    expect(copilotAnalysisOutputSchema.safeParse({ ...VALID_OUTPUT, suggestedNextStep: verb }).success).toBe(false);
  });

  it.each(RESEARCH_ITEM_STATUS_VALUES)("rejects the research_items.status value '%s' as suggestedNextStep", (status) => {
    expect(copilotAnalysisOutputSchema.safeParse({ ...VALID_OUTPUT, suggestedNextStep: status }).success).toBe(false);
  });

  it("suggestedNextStep vocabulary shares no member with review action verbs", () => {
    const actionVerbs: readonly string[] = reviewActionSchema.options;
    const overlap = SUGGESTED_NEXT_STEP_VALUES.filter((value) => actionVerbs.includes(value));
    expect(overlap).toEqual([]);
  });

  it("suggestedNextStep vocabulary shares no member with research_items.status values", () => {
    const statusValues: readonly string[] = RESEARCH_ITEM_STATUS_VALUES;
    const overlap = SUGGESTED_NEXT_STEP_VALUES.filter((value) => statusValues.includes(value));
    expect(overlap).toEqual([]);
  });
});
