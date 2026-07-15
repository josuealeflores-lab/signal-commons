import { describe, expect, it, vi } from "vitest";
import { fetchAllPages, fetchAllPlannedRequestKinds, type RequestState } from "@/lib/connectors/usaspending/http-client";
import { dedupeAwardsByGeneratedInternalId, type TaggedRawAward } from "@/lib/connectors/usaspending/field-mapping";
import { processTaggedAwards } from "@/lib/connectors/usaspending/pipeline";
import { buildDryRunReport } from "@/lib/connectors/usaspending/dry-run-report";
import { ALL_REQUEST_KINDS } from "@/lib/connectors/usaspending/search";
import type { BatchAliasMap } from "@/lib/connectors/usaspending/entity-resolution-preview";
import type { AwardRequestKind } from "@/lib/connectors/usaspending/types";

/**
 * Full fixture-based pipeline test: mocked USAspending responses (never a
 * live API call) run through fetch -> dedupe -> Stage-1 filter -> field
 * mapping -> entity-resolution preview -> report, asserting the final
 * candidate list matches expectations end to end. Also covers a partial
 * (max_requests-capped) run, per Cowork/Fable's request-cap review.
 */

const WINDOW = { startDate: "2026-01-01", endDate: "2026-03-31" };

function jsonResponse(results: unknown[]): Response {
  return { ok: true, status: 200, json: async () => ({ results }) } as Response;
}

describe("full dry-run pipeline (mocked HTTP, no live API)", () => {
  it("fetches, dedupes, filters, maps, and previews entity decisions end to end", async () => {
    const contractRecords = [
      {
        generated_internal_id: "AWARD-1",
        "Recipient Name": "Alpha AI Systems LLC",
        "Recipient UEI": "UEI-ALPHA",
        "Awarding Agency": "National Science Foundation",
        "Award Description": "This contract funds artificial intelligence research for defense applications.",
        action_date: "2026-02-01",
      },
      {
        // Same generated_internal_id also returned by the assistance
        // sub-query below -- must be deduped, first-seen (contract) wins.
        generated_internal_id: "AWARD-DUP",
        "Recipient Name": "Beta Robotics Inc",
        "Recipient UEI": "UEI-BETA",
        "Award Description": "Routine facilities maintenance contract.",
        action_date: "2026-02-05",
      },
      {
        // No generated_internal_id -- must be skipped, not fabricated.
        "Recipient Name": "No Id Corp",
        "Award Description": "An artificial intelligence pilot program.",
      },
    ];

    const assistanceRecords = [
      {
        generated_internal_id: "AWARD-2",
        "Recipient Name": "Alpha AI Systems LLC",
        "Recipient UEI": "UEI-ALPHA",
        "Award Description": "A follow-on machine learning research grant to the same recipient.",
        action_date: "2026-02-10",
      },
      {
        generated_internal_id: "AWARD-DUP",
        "Recipient Name": "Beta Robotics Inc (duplicate copy)",
        "Award Description": "Duplicate award appearing in both sub-queries.",
      },
    ];

    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(contractRecords))
      .mockResolvedValueOnce(jsonResponse(assistanceRecords));

    const requestState: RequestState = { requestsSent: 0 };
    const httpOptions = { fetchImpl, maxRequests: 10, requestDelayMs: 0 };

    const contractRaws = await fetchAllPages("contracts", WINDOW, 100, 100, requestState, httpOptions);
    const assistanceRaws = await fetchAllPages("grants", WINDOW, 100, 100, requestState, httpOptions);

    const tagged: TaggedRawAward[] = dedupeAwardsByGeneratedInternalId([
      ...contractRaws.map((raw) => ({ raw, requestKind: "contracts" as const })),
      ...assistanceRaws.map((raw) => ({ raw, requestKind: "grants" as const })),
    ]);

    // 3 contract + 2 assistance = 5 raw, minus 1 deduped (AWARD-DUP seen
    // twice) = 4 unique records entering the pipeline.
    expect(tagged).toHaveLength(4);
    expect(tagged.filter((t) => t.raw.generated_internal_id === "AWARD-DUP")).toHaveLength(1);
    expect(tagged.find((t) => t.raw.generated_internal_id === "AWARD-DUP")?.requestKind).toBe("contracts");

    const batchAliasMap: BatchAliasMap = new Map();
    const { candidates, skipped } = processTaggedAwards(tagged, batchAliasMap);

    // AWARD-1 and AWARD-2 both queue (strong term "artificial intelligence"/
    // "machine learning"); AWARD-DUP's description has no AI signal, so it's
    // Stage-1-skipped, not entity-preview-skipped.
    expect(candidates.map((c) => c.generatedInternalId).sort()).toEqual(["AWARD-1", "AWARD-2"]);
    expect(skipped.some((s) => s.reason === "missing_generated_internal_id")).toBe(true);
    expect(skipped.some((s) => s.generatedInternalId === "AWARD-DUP")).toBe(true);

    // Same recipient UEI across both awards -> the second one previews as
    // an intra-batch MATCH against the first, never independently NEW.
    const award1 = candidates.find((c) => c.generatedInternalId === "AWARD-1");
    const award2 = candidates.find((c) => c.generatedInternalId === "AWARD-2");
    expect(award1?.entityPreview?.decision).toBe("NEW");
    expect(award2?.entityPreview?.decision).toBe("MATCH");
    expect(award2?.entityPreview?.matchedCompanyId).toBe(`batch:${award1?.generatedInternalId}`);

    const report = buildDryRunReport(candidates, skipped, requestState.requestsSent);
    expect(report.counts.totalCandidates).toBe(2);
    expect(report.counts.byEntityDecision.NEW).toBe(1);
    expect(report.counts.byEntityDecision.MATCH).toBe(1);
    expect(report.notes.length).toBeGreaterThan(0);
  });

  it("processes partial request-kind coverage end to end when max_requests caps out mid-plan (e.g. --max-requests=2)", async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation(async (_url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as { filters: { award_type_codes: string[] } };
        const isContracts = body.filters.award_type_codes.includes("A");
        return jsonResponse(
          isContracts
            ? [
                {
                  generated_internal_id: "AWARD-C1",
                  "Recipient Name": "Alpha AI Systems LLC",
                  "Recipient UEI": "UEI-ALPHA",
                  Description: "A contract funding artificial intelligence research.",
                },
              ]
            : [
                {
                  generated_internal_id: "AWARD-G1",
                  "Recipient Name": "Beta Analytics Inc",
                  "Recipient UEI": "UEI-BETA",
                  Description: "A machine learning research grant.",
                },
              ],
        );
      });

    const requestState: RequestState = { requestsSent: 0 };
    const httpOptions = { fetchImpl, maxRequests: 2, requestDelayMs: 0 };

    const { fetchedByKind, skippedDueToRequestCap } = await fetchAllPlannedRequestKinds(
      WINDOW,
      100,
      100,
      requestState,
      httpOptions,
    );

    // max_requests=2 -- only contracts + grants attempted; the other two
    // non-loan kinds are never fetched at all.
    expect(Object.keys(fetchedByKind)).toEqual(["contracts", "grants"]);
    expect(skippedDueToRequestCap).toEqual(["other_financial_assistance", "direct_payments"]);

    const tagged: TaggedRawAward[] = dedupeAwardsByGeneratedInternalId(
      ALL_REQUEST_KINDS.flatMap((kind: AwardRequestKind) => (fetchedByKind[kind] ?? []).map((raw) => ({ raw, requestKind: kind }))),
    );
    expect(tagged).toHaveLength(2);

    const batchAliasMap: BatchAliasMap = new Map();
    const { candidates, skipped } = processTaggedAwards(tagged, batchAliasMap);
    expect(candidates.map((c) => c.generatedInternalId).sort()).toEqual(["AWARD-C1", "AWARD-G1"]);

    const report = buildDryRunReport(candidates, skipped, requestState.requestsSent, skippedDueToRequestCap);
    expect(report.skippedRequestKinds).toEqual(["other_financial_assistance", "direct_payments"]);
    expect(report.counts.byRequestKind.contracts).toBe(1);
    expect(report.counts.byRequestKind.grants).toBe(1);
    expect(report.counts.byRequestKind.other_financial_assistance).toBe(0);
    expect(report.counts.byRequestKind.direct_payments).toBe(0);
    // The report must clearly flag this as partial coverage, not full connector coverage.
    expect(report.notes.some((note) => note.includes("PARTIAL RUN"))).toBe(true);
  });
});
