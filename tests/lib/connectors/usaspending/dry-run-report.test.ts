import { describe, expect, it } from "vitest";
import {
  extractAwardFields,
  buildCandidatePreview,
  computeFieldPresenceStats,
  type TaggedRawAward,
} from "@/lib/connectors/usaspending/field-mapping";
import { applyStage1Filter } from "@/lib/connectors/usaspending/stage1-filter";
import { buildDryRunReport, formatSummary } from "@/lib/connectors/usaspending/dry-run-report";
import type { AwardRequestKind, CandidatePreview } from "@/lib/connectors/usaspending/types";

/**
 * Hermetic -- covers buildDryRunReport's assistance-code bucket counting
 * (including the untestedLoan07to08 bucket for 07/08 loan codes, which are
 * excluded from every live request per search.ts's
 * UNTESTED_LOAN_AWARD_TYPE_CODES), the four-way by-request-kind counts
 * (contracts/grants/other_financial_assistance/direct_payments), and the
 * skippedRequestKinds/PARTIAL RUN reporting added for the max_requests
 * partial-coverage behavior (Cowork/Fable review).
 */

function buildAssistanceCandidate(requestKind: AwardRequestKind, awardTypeCode: string | null): CandidatePreview {
  const fields = extractAwardFields(
    {
      generated_internal_id: `AWARD-${requestKind}-${awardTypeCode ?? "unknown"}`,
      Description: "An artificial intelligence research award.",
      ...(awardTypeCode ? { award_type_code: awardTypeCode } : {}),
    },
    requestKind,
  );
  const stage1 = applyStage1Filter({ description: fields.description });
  const result = buildCandidatePreview(fields, requestKind, stage1);
  if ("reason" in result) throw new Error("unreachable -- fixture always has generated_internal_id");
  return result;
}

describe("buildDryRunReport: assistance code buckets", () => {
  it("counts a validated (02-05) grants candidate correctly", () => {
    const report = buildDryRunReport([buildAssistanceCandidate("grants", "02")], [], 1);
    expect(report.counts.byAssistanceCodeBucket.validated02to05).toBe(1);
    expect(report.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(0);
    expect(report.counts.byAssistanceCodeBucket.untestedLoan07to08).toBe(0);
  });

  it("counts an unvalidated direct_payments candidate (06/10) correctly", () => {
    const report = buildDryRunReport([buildAssistanceCandidate("direct_payments", "06")], [], 1);
    expect(report.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(1);
    expect(report.counts.byAssistanceCodeBucket.untestedLoan07to08).toBe(0);
  });

  it("counts an unvalidated other_financial_assistance candidate (09/11) correctly", () => {
    const report = buildDryRunReport([buildAssistanceCandidate("other_financial_assistance", "09")], [], 1);
    expect(report.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(1);
    expect(report.counts.byAssistanceCodeBucket.untestedLoan07to08).toBe(0);
  });

  it("counts a loan-coded (07/08) candidate distinctly, never folded into unvalidated06to11 -- should never happen since loans are never requested, but must be visible if it does", () => {
    const report07 = buildDryRunReport([buildAssistanceCandidate("grants", "07")], [], 1);
    expect(report07.counts.byAssistanceCodeBucket.untestedLoan07to08).toBe(1);
    expect(report07.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(0);

    const report08 = buildDryRunReport([buildAssistanceCandidate("grants", "08")], [], 1);
    expect(report08.counts.byAssistanceCodeBucket.untestedLoan07to08).toBe(1);
    expect(report08.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(0);
  });

  it("never buckets a contracts candidate into any assistance code bucket", () => {
    const contractCandidate = buildAssistanceCandidate("contracts", "02"); // award_type_code is irrelevant for contracts
    const report = buildDryRunReport([contractCandidate], [], 1);
    expect(report.counts.byAssistanceCodeBucket.validated02to05).toBe(0);
    expect(report.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(0);
    expect(report.counts.byAssistanceCodeBucket.untestedLoan07to08).toBe(0);
    expect(report.counts.byAssistanceCodeBucket.unknown).toBe(0);
  });

  it("includes an explicit note that 07/08 are excluded from every live request", () => {
    const report = buildDryRunReport([], [], 0);
    expect(report.notes.some((note) => note.includes("07/08") && note.toLowerCase().includes("not requested"))).toBe(
      true,
    );
  });
});

describe("buildDryRunReport: requestKind fallback when award_type_code is missing", () => {
  /**
   * Cowork/Fable review: spending_by_award may not return a numeric
   * award_type_code field at all -- only Award Type/Contract Award Type
   * display labels. Rather than bucket every such candidate as "unknown"
   * just because one optional field is absent, buildDryRunReport falls
   * back to requestKind (authoritative for which award_type_group a
   * candidate was actually fetched under) when award_type_code is null.
   */
  it("a grants candidate with a missing award_type_code falls back to validated02to05, not unknown", () => {
    const report = buildDryRunReport([buildAssistanceCandidate("grants", null)], [], 1);
    expect(report.counts.byAssistanceCodeBucket.validated02to05).toBe(1);
    expect(report.counts.byAssistanceCodeBucket.unknown).toBe(0);
  });

  it("a direct_payments candidate with a missing award_type_code falls back to unvalidated06to11, not unknown", () => {
    const report = buildDryRunReport([buildAssistanceCandidate("direct_payments", null)], [], 1);
    expect(report.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(1);
    expect(report.counts.byAssistanceCodeBucket.unknown).toBe(0);
  });

  it("an other_financial_assistance candidate with a missing award_type_code falls back to unvalidated06to11, not unknown", () => {
    const report = buildDryRunReport([buildAssistanceCandidate("other_financial_assistance", null)], [], 1);
    expect(report.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(1);
    expect(report.counts.byAssistanceCodeBucket.unknown).toBe(0);
  });

  it("a present award_type_code still takes priority over the requestKind fallback", () => {
    // Fixture is deliberately incoherent (a grants-tagged candidate with a
    // direct_payments-family code) purely to prove award_type_code, when
    // present, is consulted before falling back to requestKind.
    const report = buildDryRunReport([buildAssistanceCandidate("grants", "06")], [], 1);
    expect(report.counts.byAssistanceCodeBucket.unvalidated06to11).toBe(1);
    expect(report.counts.byAssistanceCodeBucket.validated02to05).toBe(0);
  });

  it("falls back to unknown for a hypothetical future request kind the switch doesn't recognize (defensive default)", () => {
    const candidate = buildAssistanceCandidate("grants", null);
    candidate.requestKind = "some_future_kind" as unknown as typeof candidate.requestKind;
    const report = buildDryRunReport([candidate], [], 1);
    expect(report.counts.byAssistanceCodeBucket.unknown).toBe(1);
  });
});

describe("buildDryRunReport: by-request-kind counts", () => {
  it("counts candidates separately across all four request kinds", () => {
    const report = buildDryRunReport(
      [
        buildAssistanceCandidate("contracts", null),
        buildAssistanceCandidate("grants", "02"),
        buildAssistanceCandidate("other_financial_assistance", "09"),
        buildAssistanceCandidate("direct_payments", "06"),
      ],
      [],
      4,
    );
    expect(report.counts.byRequestKind).toEqual({
      contracts: 1,
      grants: 1,
      other_financial_assistance: 1,
      direct_payments: 1,
    });
  });
});

describe("buildDryRunReport: skippedRequestKinds / partial-run reporting", () => {
  it("defaults to an empty skippedRequestKinds array on a full run", () => {
    const report = buildDryRunReport([], [], 4);
    expect(report.skippedRequestKinds).toEqual([]);
    expect(report.notes.some((note) => note.includes("PARTIAL RUN"))).toBe(false);
  });

  it("records skipped request kinds and adds an explicit PARTIAL RUN note when the cap was reached", () => {
    const report = buildDryRunReport([], [], 2, ["other_financial_assistance", "direct_payments"]);
    expect(report.skippedRequestKinds).toEqual(["other_financial_assistance", "direct_payments"]);
    expect(
      report.notes.some(
        (note) =>
          note.includes("PARTIAL RUN") &&
          note.includes("other_financial_assistance") &&
          note.includes("direct_payments"),
      ),
    ).toBe(true);
  });
});

describe("buildDryRunReport: fieldPresenceStats pass-through", () => {
  it("defaults to all-zero fieldPresenceStats when omitted", () => {
    const report = buildDryRunReport([], [], 0);
    expect(report.fieldPresenceStats.totalRecordsInspected).toBe(0);
    expect(report.fieldPresenceStats.generatedInternalIdPresentCount).toBe(0);
  });

  it("surfaces the exact fieldPresenceStats passed in, computed from all fetched/deduped records (including Stage-1-excluded ones)", () => {
    const taggedAwards: TaggedRawAward[] = [
      { raw: { generated_internal_id: "A", Description: "Not AI relevant, will be Stage-1-excluded." }, requestKind: "contracts" },
      { raw: { generated_internal_id: "B", Description: "Also not AI relevant." }, requestKind: "grants" },
    ];
    const stats = computeFieldPresenceStats(taggedAwards);

    // Both records are Stage-1-excluded (no candidates), yet stats still reflect both.
    const report = buildDryRunReport([], [], 2, [], stats);
    expect(report.fieldPresenceStats.totalRecordsInspected).toBe(2);
    expect(report.fieldPresenceStats.generatedInternalIdPresentCount).toBe(2);
    expect(report.fieldPresenceStats.descriptionPresentCount).toBe(2);
  });

  it("field-presence stats appear in the formatted summary, labeled as presence counts only", () => {
    const taggedAwards: TaggedRawAward[] = [
      { raw: { generated_internal_id: "A", Description: "x" }, requestKind: "contracts" },
    ];
    const report = buildDryRunReport([], [], 1, [], computeFieldPresenceStats(taggedAwards));
    const summary = formatSummary(report);

    expect(summary).toContain("Field-presence stats");
    expect(summary).toContain("not a validation of field meaning");
    expect(summary).toContain("generated_internal_id present: 1");
  });
});

describe("buildDryRunReport: diagnosticKeyword (DIAGNOSTIC ONLY)", () => {
  it("defaults to null when omitted (normal, non-diagnostic run)", () => {
    const report = buildDryRunReport([], [], 4);
    expect(report.diagnosticKeyword).toBeNull();
    expect(report.notes.some((note) => note.includes("DIAGNOSTIC KEYWORD-BIASED RUN"))).toBe(false);
  });

  it("surfaces the exact diagnosticKeyword value when provided", () => {
    const report = buildDryRunReport([], [], 4, [], undefined, "artificial intelligence");
    expect(report.diagnosticKeyword).toBe("artificial intelligence");
  });

  it("adds an explicit DIAGNOSTIC KEYWORD-BIASED RUN warning note when diagnosticKeyword is set", () => {
    const report = buildDryRunReport([], [], 4, [], undefined, "machine learning");
    expect(
      report.notes.some(
        (note) =>
          note.includes("DIAGNOSTIC KEYWORD-BIASED RUN") &&
          note.includes("machine learning") &&
          note.toLowerCase().includes("not") &&
          note.toLowerCase().includes("representative"),
      ),
    ).toBe(true);
  });

  it("the diagnostic warning also appears in the formatted summary", () => {
    const report = buildDryRunReport([], [], 4, [], undefined, "autonomous vehicle");
    const summary = formatSummary(report);
    expect(summary).toContain("DIAGNOSTIC KEYWORD-BIASED RUN");
    expect(summary).toContain("autonomous vehicle");
    expect(summary.toLowerCase()).toContain("not representative");
  });

  it("does not affect normal report fields (counts/notes structure) when omitted vs. explicitly null", () => {
    const reportOmitted = buildDryRunReport([], [], 4);
    const reportExplicitNull = buildDryRunReport([], [], 4, [], undefined, null);
    expect(reportOmitted.diagnosticKeyword).toBe(reportExplicitNull.diagnosticKeyword);
    expect(reportOmitted.notes).toEqual(reportExplicitNull.notes);
  });
});
