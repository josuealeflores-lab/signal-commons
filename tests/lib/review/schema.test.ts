import { describe, expect, it } from "vitest";
import { editApproveFieldsSchema } from "@/lib/review/schema";

/**
 * Hermetic (no live DB) — this Zod schema is UI-layer defense-in-depth only
 * (docs/DECISIONS.md D-058); the RPC's own hardcoded column list is the
 * authoritative enforcement (see tests/integration/publish-gate.test.ts for
 * that side). This just confirms the mirror stays in sync with the
 * documented 4-field allow-list.
 */

describe("editApproveFieldsSchema", () => {
  it("accepts a partial object with only allow-listed fields", () => {
    const result = editApproveFieldsSchema.safeParse({ headline: "New headline" });
    expect(result.success).toBe(true);
  });

  it("accepts all four allow-listed fields together", () => {
    const result = editApproveFieldsSchema.safeParse({
      headline: "New headline",
      summary: "New summary",
      why_it_matters: "New why it matters",
      evidence_strength: "high",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty object (no edits)", () => {
    const result = editApproveFieldsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects an invalid evidence_strength value", () => {
    const result = editApproveFieldsSchema.safeParse({ evidence_strength: "extreme" });
    expect(result.success).toBe(false);
  });

  it("rejects a disallowed key (e.g. publication_status, is_demo, company_id)", () => {
    for (const disallowedField of [
      { publication_status: "published" },
      { is_demo: false },
      { company_id: "demo-company-1-1" },
      { id: "should-not-be-editable" },
    ]) {
      const result = editApproveFieldsSchema.safeParse(disallowedField);
      expect(result.success).toBe(false);
    }
  });

  it("rejects an empty-string value for an allow-listed field", () => {
    const result = editApproveFieldsSchema.safeParse({ headline: "" });
    expect(result.success).toBe(false);
  });
});
