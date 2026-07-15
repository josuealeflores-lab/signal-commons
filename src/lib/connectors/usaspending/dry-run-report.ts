import { isUnvalidatedAssistanceCode, isUntestedLoanAssistanceCode } from "./search.ts";
import type { FieldPresenceStats } from "./field-mapping.ts";
import type { AwardRequestKind, CandidatePreview, EntityDecisionKind, SkippedRecord } from "./types.ts";

/**
 * Builds the dry-run report data (pure -- no filesystem access here, so
 * this stays hermetically testable). Only the CLI orchestrator
 * (supabase/connector-usaspending.ts) actually writes files, under the
 * gitignored connector-runs/ directory.
 */

export interface DryRunSummaryCounts {
  byRequestKind: Record<AwardRequestKind, number>;
  byAssistanceCodeBucket: {
    validated02to05: number;
    unvalidated06to11: number;
    untestedLoan07to08: number;
    unknown: number;
  };
  byRuleBranch: Record<string, number>;
  bySkipReason: Record<string, number>;
  byEntityDecision: Record<EntityDecisionKind, number>;
  possibleIndividualCount: number;
  duplicateUeiCount: number;
  totalCandidates: number;
  totalSkipped: number;
}

export interface DryRunReport {
  generatedAt: string;
  connectorKey: "usaspending_award_search";
  requestsSent: number;
  /** Request kinds never attempted because max_requests was already exhausted before their turn (see http-client.ts's fetchAllPlannedRequestKinds). Empty on a full run. */
  skippedRequestKinds: AwardRequestKind[];
  /**
   * DIAGNOSTIC ONLY. Null on every normal run. Set only when
   * --diagnostic-keyword was explicitly passed to the CLI -- see
   * search.ts's buildSearchRequestBody and connector-usaspending.ts.
   */
  diagnosticKeyword: string | null;
  /**
   * Aggregate, non-sensitive field-presence counts across every fetched/
   * deduped raw record (including ones Stage-1 excluded) -- see
   * field-mapping.ts's computeFieldPresenceStats. These are PRESENCE
   * counts only, not validation of field meaning/correctness, and never
   * include a raw value, recipient name, award description, or example
   * record.
   */
  fieldPresenceStats: FieldPresenceStats;
  candidates: CandidatePreview[];
  skipped: SkippedRecord[];
  counts: DryRunSummaryCounts;
  notes: string[];
}

const REQUIRED_NOTES = [
  "Stage-1 candidate-surfacing filter: recall is UNVALIDATED. The >=0.90 overall / >=0.80 per-sector recall gate has never been evaluated against real data (docs/research/usaspending_validation.METRICS.md).",
  "Assistance award types 06-11 have ZERO labeling-validation coverage -- only 02-05 were sampled in this session's validation set. Do not treat the 06-11 bucket as validated.",
  "USAspending's live API enforces award_type_codes grouping at a finer granularity than originally documented: D-086 originally prevented mixing contracts and assistance in one request; a live HTTP 422 showed the same rule applies within assistance itself. M6B now splits every requested award_type_codes set by USAspending's own award_type_group (contracts, grants, other_financial_assistance, direct_payments) -- no request may mix codes across groups.",
  "Assistance loan codes 07/08 are NOT requested by this connector at all -- their valid `fields` set is unconfirmed against the live API (Cowork/Fable review), so they are excluded from every live award_type_codes filter until reconciled. Any 07/08 award seen here would be unexpected and should be investigated, not treated as a normal sample.",
  "The weak-term + code/agency corroborator rule branch (weak_term_plus_corroborator) produced ZERO true positives in the one validated labeling window (code_pull/supplemental_pull) -- kept active but NOT validated for live-queue use.",
  "possible_individual and parent_subsidiary routing are conservative safeguards, not validated heuristics (zero real labeled examples, docs/DECISIONS.md D-088).",
  "Recipient parent-company fields (Recipient Parent Name/UEI) are never populated by this connector -- they are not part of the spending_by_award search response; parent enrichment would require a separate award-detail lookup, out of scope for M6B.",
  "KNOWN LIMITATION (docs/DECISIONS.md D-091): a diagnostic live smoke test found NAICS and PSC map to null on live contract records (0/54 populated), even though USAspending accepted both as request-side `fields` entries without error -- a response-side mapping/value-shape issue, not a request-validity one. This does not block M6B since NAICS/PSC never feed the candidate-preview output and are already handled safely as null, but it MUST be reconciled before a larger operational dry-run or before relying on Stage-1's NAICS/PSC-based code-corroborator branch.",
  "This report contains preview objects only. No database write of any kind occurred during this run.",
];

export function buildDryRunReport(
  candidates: CandidatePreview[],
  skipped: SkippedRecord[],
  requestsSent: number,
  skippedRequestKinds: AwardRequestKind[] = [],
  fieldPresenceStats: FieldPresenceStats = {
    totalRecordsInspected: 0,
    byRequestKind: { contracts: 0, grants: 0, other_financial_assistance: 0, direct_payments: 0 },
    generatedInternalIdPresentCount: 0,
    descriptionPresentCount: 0,
    baseObligationDatePresentCount: 0,
    startDatePresentCount: 0,
    lastModifiedDatePresentCount: 0,
    contractAwardTypePresentCount: 0,
    awardTypePresentCount: 0,
    naicsPresentCount: 0,
    pscPresentCount: 0,
    cfdaNumberPresentCount: 0,
    awardTypeCodePresentCount: 0,
  },
  diagnosticKeyword: string | null = null,
): DryRunReport {
  const byRequestKind: Record<AwardRequestKind, number> = {
    contracts: 0,
    grants: 0,
    other_financial_assistance: 0,
    direct_payments: 0,
  };
  const byAssistanceCodeBucket = {
    validated02to05: 0,
    unvalidated06to11: 0,
    untestedLoan07to08: 0,
    unknown: 0,
  };
  const byRuleBranch: Record<string, number> = {};
  const bySkipReason: Record<string, number> = {};
  const byEntityDecision: Record<EntityDecisionKind, number> = { MATCH: 0, NEW: 0, AMBIGUOUS: 0, CONFLICT: 0 };
  let possibleIndividualCount = 0;
  let duplicateUeiCount = 0;

  for (const candidate of candidates) {
    byRequestKind[candidate.requestKind] += 1;

    // "Assistance-family" now means any of the three non-contract kinds
    // (grants/other_financial_assistance/direct_payments) -- what used to
    // be one shared "assistance" request kind before the award_type_group
    // split.
    if (candidate.requestKind !== "contracts") {
      const awardTypeCode = candidate.awardTypeCode;

      if (awardTypeCode) {
        // Prefer the actual award_type_code when the API returns one.
        if (isUntestedLoanAssistanceCode(awardTypeCode)) {
          // Should never happen -- 07/08 are excluded from every live
          // request -- but counted distinctly (not silently folded into
          // unvalidated06to11) in case one appears unexpectedly.
          byAssistanceCodeBucket.untestedLoan07to08 += 1;
        } else if (isUnvalidatedAssistanceCode(awardTypeCode)) {
          byAssistanceCodeBucket.unvalidated06to11 += 1;
        } else {
          byAssistanceCodeBucket.validated02to05 += 1;
        }
      } else {
        // Cowork/Fable review: spending_by_award may not return a numeric
        // award_type_code field at all -- only Award Type/Contract Award
        // Type display labels. When award_type_code is missing, fall back
        // to requestKind, which is authoritative for which award_type_group
        // this candidate was actually fetched under (a `grants` request
        // only ever returns 02-05; a `direct_payments`/
        // `other_financial_assistance` request only ever returns its own
        // non-loan, unvalidated codes) -- more reliable than leaving the
        // candidate in `unknown` just because one optional field is absent.
        switch (candidate.requestKind) {
          case "grants":
            byAssistanceCodeBucket.validated02to05 += 1;
            break;
          case "direct_payments":
          case "other_financial_assistance":
            byAssistanceCodeBucket.unvalidated06to11 += 1;
            break;
          default:
            byAssistanceCodeBucket.unknown += 1;
        }
      }
    }

    if (candidate.stage1.ruleBranch) {
      byRuleBranch[candidate.stage1.ruleBranch] = (byRuleBranch[candidate.stage1.ruleBranch] ?? 0) + 1;
    }

    if (candidate.entityPreview) {
      byEntityDecision[candidate.entityPreview.decision] += 1;
      if (candidate.entityPreview.isPossibleIndividual) possibleIndividualCount += 1;
      if (candidate.entityPreview.reason === "duplicate_uei") duplicateUeiCount += 1;
    }
  }

  for (const skip of skipped) {
    bySkipReason[skip.reason] = (bySkipReason[skip.reason] ?? 0) + 1;
  }

  const notes = [...REQUIRED_NOTES];
  if (skippedRequestKinds.length > 0) {
    notes.unshift(
      `PARTIAL RUN: the following request kinds were skipped due to the max_requests cap and were NEVER fetched: ${skippedRequestKinds.join(", ")}. This report reflects partial connector coverage, not a full run -- do not treat omitted kinds as "zero results," they were never queried.`,
    );
  }
  if (diagnosticKeyword) {
    notes.unshift(
      `DIAGNOSTIC KEYWORD-BIASED RUN: this run added USAspending's keyword filter ("${diagnosticKeyword}") to every request to intentionally bias the sample toward matches, purely to exercise the candidate-preview path on live data. Results are NOT representative of the connector's normal (unbiased) sampling frame and must NEVER be used for recall/precision estimation or any Stage-1 filter validation.`,
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    connectorKey: "usaspending_award_search",
    requestsSent,
    skippedRequestKinds,
    diagnosticKeyword,
    fieldPresenceStats,
    candidates,
    skipped,
    counts: {
      byRequestKind,
      byAssistanceCodeBucket,
      byRuleBranch,
      bySkipReason,
      byEntityDecision,
      possibleIndividualCount,
      duplicateUeiCount,
      totalCandidates: candidates.length,
      totalSkipped: skipped.length,
    },
    notes,
  };
}

export function formatSummary(report: DryRunReport): string {
  const lines: string[] = [];
  lines.push(`USAspending dry-run report (${report.generatedAt})`);
  lines.push(`Connector key: ${report.connectorKey}`);
  lines.push(`Requests sent: ${report.requestsSent}`);
  if (report.diagnosticKeyword) {
    lines.push(`*** DIAGNOSTIC KEYWORD-BIASED RUN *** keyword="${report.diagnosticKeyword}"`);
    lines.push(
      "This run is NOT representative -- results are biased toward keyword matches and must never be used for recall/precision estimation or Stage-1 validation.",
    );
  }
  if (report.skippedRequestKinds.length > 0) {
    lines.push(`PARTIAL RUN -- skipped due to request cap: ${report.skippedRequestKinds.join(", ")}`);
  }
  lines.push(`Total candidates: ${report.counts.totalCandidates} | Total skipped: ${report.counts.totalSkipped}`);
  lines.push("");
  lines.push("Field-presence stats (aggregate counts only -- not a validation of field meaning):");
  lines.push(`  total records inspected: ${report.fieldPresenceStats.totalRecordsInspected}`);
  for (const [kind, count] of Object.entries(report.fieldPresenceStats.byRequestKind)) {
    lines.push(`    ${kind}: ${count}`);
  }
  lines.push(`  generated_internal_id present: ${report.fieldPresenceStats.generatedInternalIdPresentCount}`);
  lines.push(`  Description present: ${report.fieldPresenceStats.descriptionPresentCount}`);
  lines.push(`  Base Obligation Date present: ${report.fieldPresenceStats.baseObligationDatePresentCount}`);
  lines.push(`  Start Date present (context only, per D-087): ${report.fieldPresenceStats.startDatePresentCount}`);
  lines.push(`  Last Modified Date present: ${report.fieldPresenceStats.lastModifiedDatePresentCount}`);
  lines.push(`  Contract Award Type present (contracts): ${report.fieldPresenceStats.contractAwardTypePresentCount}`);
  lines.push(`  Award Type present (non-contracts): ${report.fieldPresenceStats.awardTypePresentCount}`);
  lines.push(`  NAICS present: ${report.fieldPresenceStats.naicsPresentCount}`);
  lines.push(`  PSC present: ${report.fieldPresenceStats.pscPresentCount}`);
  lines.push(`  CFDA Number present: ${report.fieldPresenceStats.cfdaNumberPresentCount}`);
  lines.push(`  awardTypeCode present: ${report.fieldPresenceStats.awardTypeCodePresentCount}`);
  lines.push("");
  lines.push("By request kind:");
  for (const [kind, count] of Object.entries(report.counts.byRequestKind)) {
    lines.push(`  ${kind}: ${count}`);
  }
  lines.push("Assistance code buckets:");
  lines.push(`  validated (02-05): ${report.counts.byAssistanceCodeBucket.validated02to05}`);
  lines.push(`  UNVALIDATED (06/09-11): ${report.counts.byAssistanceCodeBucket.unvalidated06to11}`);
  lines.push(
    `  UNTESTED LOAN (07-08, should be 0 -- excluded from every live request): ${report.counts.byAssistanceCodeBucket.untestedLoan07to08}`,
  );
  lines.push(`  unknown (award_type_code not reconciled): ${report.counts.byAssistanceCodeBucket.unknown}`);
  lines.push("By Stage-1 rule branch:");
  for (const [branch, count] of Object.entries(report.counts.byRuleBranch)) {
    lines.push(`  ${branch}: ${count}`);
  }
  lines.push("By skip reason:");
  for (const [reason, count] of Object.entries(report.counts.bySkipReason)) {
    lines.push(`  ${reason}: ${count}`);
  }
  lines.push("By entity-resolution decision:");
  for (const [decision, count] of Object.entries(report.counts.byEntityDecision)) {
    lines.push(`  ${decision}: ${count}`);
  }
  lines.push(`  possible_individual: ${report.counts.possibleIndividualCount}`);
  lines.push(`  duplicate_uei: ${report.counts.duplicateUeiCount}`);
  lines.push("");
  lines.push("Notes:");
  for (const note of report.notes) {
    lines.push(`  - ${note}`);
  }
  return lines.join("\n");
}
