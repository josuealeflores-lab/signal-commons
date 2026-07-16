import { describe, expect, it } from "vitest";
import { mapSignalRow, isSupportedResearchItem } from "@/lib/review/queue";

/**
 * Hermetic (no live DB, no session client) — mapSignalRow and
 * isSupportedResearchItem are pure row-shape helpers pulled out of
 * getResearchItemById specifically so this regression is directly
 * testable. mapSignalRow pins the exact M6D bug fix (docs/DECISIONS.md
 * D-094): the reviewer queue previously hardcoded `is_demo: true` on every
 * signal regardless of the row's real value.
 */

const BASE_ROW = {
  id: "sig-1",
  company_id: "co-1",
  signal_type: "government contract",
  headline: "Headline",
  summary: "Summary",
  why_it_matters: "Why",
  occurred_at: "2026-01-01",
  detected_at: "2026-01-02T00:00:00Z",
  evidence_strength: "high" as const,
  verification_status: "unverified" as const,
  publication_status: "draft" as const,
  created_by_type: "import" as const,
  signal_evidence: [],
};

describe("mapSignalRow", () => {
  it("preserves is_demo=false for a real connector-created row", () => {
    const mapped = mapSignalRow({ ...BASE_ROW, is_demo: false });
    expect(mapped.is_demo).toBe(false);
  });

  it("preserves is_demo=true for a demo row", () => {
    const mapped = mapSignalRow({ ...BASE_ROW, is_demo: true });
    expect(mapped.is_demo).toBe(true);
  });

  it("does not otherwise alter the row's fields", () => {
    const mapped = mapSignalRow({ ...BASE_ROW, is_demo: false });
    expect(mapped.id).toBe("sig-1");
    expect(mapped.company_id).toBe("co-1");
    expect(mapped.publication_status).toBe("draft");
  });
});

describe("isSupportedResearchItem", () => {
  it("accepts item_type=new_signal with payload.target_table=signals", () => {
    expect(
      isSupportedResearchItem({
        item_type: "new_signal",
        payload: { target_table: "signals", target_id: "sig-1" },
      }),
    ).toBe(true);
  });

  it("rejects any other item_type", () => {
    expect(
      isSupportedResearchItem({
        item_type: "entity_match",
        payload: { target_table: "signals", target_id: "sig-1" },
      }),
    ).toBe(false);
  });

  it("rejects a mismatched payload.target_table even if item_type is new_signal", () => {
    expect(
      isSupportedResearchItem({
        item_type: "new_signal",
        payload: { target_table: "companies", target_id: "co-1" },
      }),
    ).toBe(false);
  });

  it("does not throw on a null or missing payload, and reports unsupported", () => {
    expect(
      isSupportedResearchItem({
        item_type: "new_signal",
        payload: null as unknown as { target_table: string; target_id: string },
      }),
    ).toBe(false);
    expect(
      isSupportedResearchItem({
        item_type: "new_signal",
        payload: undefined as unknown as { target_table: string; target_id: string },
      }),
    ).toBe(false);
  });
});
