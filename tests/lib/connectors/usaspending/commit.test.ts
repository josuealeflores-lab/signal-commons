import { describe, expect, it, vi } from "vitest";
import { extractAwardFields, buildCandidatePreview, isSkippedRecord } from "@/lib/connectors/usaspending/field-mapping";
import { applyStage1Filter } from "@/lib/connectors/usaspending/stage1-filter";
import {
  commitCandidate,
  commitCandidateBatch,
  isEligibleForCommit,
  buildIngestionRunCompletion,
  type CommitRpcCaller,
  type CommitRpcResult,
} from "@/lib/connectors/usaspending/commit";
import type { CandidatePreview, EntityPreviewResult, RawUsaspendingAward } from "@/lib/connectors/usaspending/types";

/**
 * Hermetic -- no Supabase client, no DB, no network. commitCandidate/
 * commitCandidateBatch take an injected CommitRpcCaller mock; every test
 * here asserts against that mock's call count/arguments to prove
 * ineligible candidates never reach the RPC at all, not just that the
 * final outcome looks right.
 */

const BASE_AWARD: RawUsaspendingAward = {
  generated_internal_id: "CONT_AWD_COMMIT_1",
  "Recipient Name": "Acme Robotics LLC",
  "Recipient UEI": "uei-commit-1",
  "Awarding Agency": "National Science Foundation",
  "Contract Award Type": "Definitive Contract",
  "Base Obligation Date": "2026-02-15",
  Description: "This project applies machine learning to improve robotics.",
};

function buildCandidate(entityPreview: EntityPreviewResult, overrides?: Partial<RawUsaspendingAward>): CandidatePreview {
  const raw = { ...BASE_AWARD, ...overrides };
  const fields = extractAwardFields(raw, "contracts");
  const stage1 = applyStage1Filter({ description: fields.description });
  const result = buildCandidatePreview(fields, "contracts", stage1);
  if (isSkippedRecord(result)) throw new Error("unreachable: fixture must not be skipped");
  result.entityPreview = entityPreview;
  return result;
}

function newDecision(overrides?: Partial<EntityPreviewResult>): EntityPreviewResult {
  return {
    decision: "NEW",
    reason: null,
    matchedCompanyId: null,
    isPossibleIndividual: false,
    parentSubsidiaryNote: null,
    ...overrides,
  };
}

describe("isEligibleForCommit", () => {
  it("is true only for MATCH and NEW", () => {
    expect(isEligibleForCommit(buildCandidate(newDecision({ decision: "NEW" })))).toBe(true);
    expect(isEligibleForCommit(buildCandidate(newDecision({ decision: "MATCH", matchedCompanyId: "co-1" })))).toBe(true);
    expect(isEligibleForCommit(buildCandidate(newDecision({ decision: "AMBIGUOUS", reason: "no_uei" })))).toBe(false);
    expect(isEligibleForCommit(buildCandidate(newDecision({ decision: "CONFLICT", reason: "duplicate_uei" })))).toBe(false);
  });

  it("is false when entityPreview is null (never computed)", () => {
    const candidate = buildCandidate(newDecision());
    candidate.entityPreview = null;
    expect(isEligibleForCommit(candidate)).toBe(false);
  });
});

describe("commitCandidate: ineligible candidates never call the RPC", () => {
  const ineligibleCases: Array<[string, EntityPreviewResult, string]> = [
    ["possible_individual", newDecision({ decision: "AMBIGUOUS", reason: "possible_individual", isPossibleIndividual: true }), "possible_individual"],
    ["name_collision", newDecision({ decision: "AMBIGUOUS", reason: "name_collision" }), "ambiguous_name_collision"],
    ["no_uei", newDecision({ decision: "AMBIGUOUS", reason: "no_uei" }), "ambiguous_no_uei"],
    ["duplicate_uei", newDecision({ decision: "CONFLICT", reason: "duplicate_uei" }), "conflict_duplicate_uei"],
  ];

  it.each(ineligibleCases)("%s is skipped with reason %s and never invokes rpcCaller", async (_label, entityPreview, expectedReason) => {
    const candidate = buildCandidate(entityPreview);
    const rpcCaller = vi.fn();

    const outcome = await commitCandidate(candidate, "ingest-test-1", rpcCaller);

    expect(outcome.outcome).toBe("skipped");
    expect(outcome.reason).toBe(expectedReason);
    expect(rpcCaller).not.toHaveBeenCalled();
  });

  it("never creates any entity_match-shaped row -- outcome carries no item_type/payload at all", async () => {
    const candidate = buildCandidate(newDecision({ decision: "AMBIGUOUS", reason: "name_collision" }));
    const rpcCaller = vi.fn();
    const outcome = await commitCandidate(candidate, "ingest-test-1", rpcCaller);

    expect(outcome).not.toHaveProperty("item_type");
    expect(outcome).not.toHaveProperty("payload");
    expect(outcome.companyId).toBeUndefined();
    expect(outcome.signalId).toBeUndefined();
    expect(outcome.researchItemId).toBeUndefined();
  });
});

describe("commitCandidate: eligible candidates call the RPC with the correct params", () => {
  it("passes the ingestion_run_id, normalized UEI, and serialized DTO to rpcCaller for a NEW candidate", async () => {
    const candidate = buildCandidate(newDecision({ decision: "NEW" }));
    const rpcCaller: CommitRpcCaller = vi.fn(async (): Promise<CommitRpcResult> => ({
      decision: "committed",
      companyId: "co-uei-uei-commit-1",
      companyCreated: true,
      sourceDocumentId: candidate.sourceDocumentPreview.id,
      signalId: candidate.signalPreview.id,
      researchItemId: candidate.researchItemId,
    }));

    const outcome = await commitCandidate(candidate, "ingest-test-2", rpcCaller);

    expect(rpcCaller).toHaveBeenCalledTimes(1);
    const params = vi.mocked(rpcCaller).mock.calls[0][0];
    expect(params.p_ingestion_run_id).toBe("ingest-test-2");
    expect(params.p_normalized_uei).toBe("UEI-COMMIT-1");
    expect(params.p_candidate.recipientName).toBe("Acme Robotics LLC");
    expect(params.p_candidate.researchItemId).toBe(candidate.researchItemId);

    expect(outcome.outcome).toBe("committed");
    expect(outcome.companyId).toBe("co-uei-uei-commit-1");
    expect(outcome.researchItemId).toBe(candidate.researchItemId);
  });

  it("maps every RPC skip decision to the corresponding non-sensitive skip reason", async () => {
    const cases: Array<[CommitRpcResult, string]> = [
      [{ decision: "skipped_already_exists", researchItemId: "ri-x" }, "rpc_skipped_already_exists"],
      [{ decision: "skipped_demo_company_collision" }, "rpc_skipped_demo_company_collision"],
      [{ decision: "skipped_invalid_payload", missingFields: ["signal.id"] }, "rpc_skipped_invalid_payload"],
    ];

    for (const [rpcResult, expectedReason] of cases) {
      const candidate = buildCandidate(newDecision({ decision: "NEW" }));
      const rpcCaller = vi.fn(async (): Promise<CommitRpcResult> => rpcResult);
      const outcome = await commitCandidate(candidate, "ingest-test-3", rpcCaller);
      expect(outcome.outcome).toBe("skipped");
      expect(outcome.reason).toBe(expectedReason);
    }
  });

  it("skips as rpc_call_failed (never surfacing the raw error) when rpcCaller throws", async () => {
    const candidate = buildCandidate(newDecision({ decision: "NEW" }));
    const rpcCaller = vi.fn(async (): Promise<CommitRpcResult> => {
      throw new Error("simulated Postgres error containing Recipient Name: Acme Robotics LLC");
    });

    const outcome = await commitCandidate(candidate, "ingest-test-4", rpcCaller);
    expect(outcome.outcome).toBe("skipped");
    expect(outcome.reason).toBe("rpc_call_failed");
    expect(JSON.stringify(outcome)).not.toContain("Acme Robotics LLC");
  });

  it("skips without calling the RPC when the candidate unexpectedly has no recipientUei despite being MATCH/NEW", async () => {
    const candidate = buildCandidate(newDecision({ decision: "NEW" }));
    candidate.fields.recipientUei = null;
    const rpcCaller = vi.fn();

    const outcome = await commitCandidate(candidate, "ingest-test-5", rpcCaller);
    expect(outcome.outcome).toBe("skipped");
    expect(outcome.reason).toBe("missing_recipient_uei_for_commit");
    expect(rpcCaller).not.toHaveBeenCalled();
  });
});

describe("commitCandidate: a serialization failure is a counted skip, not a thrown exception (Cowork/Fable robustness fix)", () => {
  it("does not throw when an eligible MATCH/NEW candidate has a blank recipientName", async () => {
    const candidate = buildCandidate(newDecision({ decision: "NEW" }));
    candidate.fields.recipientName = "";
    const rpcCaller = vi.fn();

    await expect(commitCandidate(candidate, "ingest-test-6", rpcCaller)).resolves.not.toThrow();
  });

  it("is counted as skipped with reason serialization_failed", async () => {
    const candidate = buildCandidate(newDecision({ decision: "NEW" }));
    candidate.fields.recipientName = "";
    const rpcCaller = vi.fn();

    const outcome = await commitCandidate(candidate, "ingest-test-6", rpcCaller);
    expect(outcome.outcome).toBe("skipped");
    expect(outcome.reason).toBe("serialization_failed");
  });

  it("never calls rpcCaller for the candidate that failed to serialize", async () => {
    const candidate = buildCandidate(newDecision({ decision: "NEW" }));
    candidate.fields.recipientName = null;
    const rpcCaller = vi.fn();

    await commitCandidate(candidate, "ingest-test-6", rpcCaller);
    expect(rpcCaller).not.toHaveBeenCalled();
  });

  it("the outcome never contains raw candidate content, only the reason code", async () => {
    const candidate = buildCandidate(newDecision({ decision: "NEW" }));
    candidate.fields.recipientName = "";
    const rpcCaller = vi.fn();

    const outcome = await commitCandidate(candidate, "ingest-test-6", rpcCaller);
    const serialized = JSON.stringify(outcome);
    expect(serialized).not.toContain("machine learning");
    expect(serialized).not.toContain("robotics");
  });

  it("one candidate's serialization failure does not stop other valid candidates in the same batch from committing", async () => {
    const brokenCandidate = buildCandidate(newDecision({ decision: "NEW" }), { generated_internal_id: "AWD-BLANK-NAME" });
    brokenCandidate.fields.recipientName = "";
    const goodCandidate = buildCandidate(newDecision({ decision: "NEW" }), { generated_internal_id: "AWD-GOOD" });

    const rpcCaller: CommitRpcCaller = vi.fn(async (): Promise<CommitRpcResult> => ({
      decision: "committed",
      companyId: "co-uei-good",
      companyCreated: true,
      sourceDocumentId: goodCandidate.sourceDocumentPreview.id,
      signalId: goodCandidate.signalPreview.id,
      researchItemId: goodCandidate.researchItemId,
    }));

    const { outcomes, summary } = await commitCandidateBatch(
      [brokenCandidate, goodCandidate],
      "ingest-test-batch-2",
      rpcCaller,
    );

    expect(outcomes).toHaveLength(2);
    expect(summary.committedCount).toBe(1);
    expect(summary.committedResearchItemIds).toEqual([goodCandidate.researchItemId]);
    expect(summary.skippedByReason.serialization_failed).toBe(1);
    // The RPC must only ever have been called once, for the good candidate.
    expect(rpcCaller).toHaveBeenCalledTimes(1);

    // Summary stays non-sensitive: counts and deterministic ids only.
    const serializedSummary = JSON.stringify(summary);
    expect(serializedSummary).not.toContain("machine learning");
    expect(serializedSummary).not.toContain("Acme Robotics");
  });
});

describe("commitCandidateBatch", () => {
  it("aggregates committed/skipped counts and researchItemIds across a mixed batch", async () => {
    const committedCandidate = buildCandidate(newDecision({ decision: "NEW" }), { generated_internal_id: "AWD-COMMITTED" });
    const skippedAmbiguous = buildCandidate(newDecision({ decision: "AMBIGUOUS", reason: "no_uei" }), { generated_internal_id: "AWD-AMBIGUOUS" });
    const skippedByRpc = buildCandidate(newDecision({ decision: "MATCH", matchedCompanyId: "co-demo-1" }), { generated_internal_id: "AWD-DEMO-COLLISION" });

    const rpcCaller: CommitRpcCaller = vi.fn(async (params): Promise<CommitRpcResult> => {
      if (params.p_candidate.researchItemId === committedCandidate.researchItemId) {
        return {
          decision: "committed",
          companyId: "co-uei-x",
          companyCreated: false,
          sourceDocumentId: committedCandidate.sourceDocumentPreview.id,
          signalId: committedCandidate.signalPreview.id,
          researchItemId: committedCandidate.researchItemId,
        };
      }
      return { decision: "skipped_demo_company_collision" };
    });

    const { outcomes, summary } = await commitCandidateBatch(
      [committedCandidate, skippedAmbiguous, skippedByRpc],
      "ingest-test-batch",
      rpcCaller,
    );

    expect(outcomes).toHaveLength(3);
    expect(summary.committedCount).toBe(1);
    expect(summary.committedResearchItemIds).toEqual([committedCandidate.researchItemId]);
    expect(summary.skippedByReason.ambiguous_no_uei).toBe(1);
    expect(summary.skippedByReason.rpc_skipped_demo_company_collision).toBe(1);

    // The RPC must never be invoked for the AMBIGUOUS candidate.
    const calledResearchItemIds = vi.mocked(rpcCaller).mock.calls.map(
      ([params]) => params.p_candidate.researchItemId,
    );
    expect(calledResearchItemIds).not.toContain(skippedAmbiguous.researchItemId);
  });
});

describe("buildIngestionRunCompletion", () => {
  it("returns succeeded with a null error_summary when there were no RPC call failures", () => {
    const completion = buildIngestionRunCompletion(
      5,
      { committedCount: 3, skippedByReason: { ambiguous_no_uei: 2 }, committedResearchItemIds: ["ri-1", "ri-2", "ri-3"] },
      false,
      new Date("2026-07-15T12:00:00.000Z"),
    );

    expect(completion.status).toBe("succeeded");
    expect(completion.records_discovered).toBe(5);
    expect(completion.records_created).toBe(3);
    expect(completion.records_skipped).toBe(2);
    expect(completion.error_summary).toBeNull();
    expect(completion.metadata.skippedByReason).toEqual({ ambiguous_no_uei: 2 });
    expect(completion.metadata.researchItemIds).toEqual(["ri-1", "ri-2", "ri-3"]);
    expect(completion.finished_at).toBe("2026-07-15T12:00:00.000Z");
  });

  it("returns partially_succeeded with a fixed, non-sensitive error_summary when RPC calls failed -- never per-candidate raw content", () => {
    const completion = buildIngestionRunCompletion(
      2,
      { committedCount: 1, skippedByReason: { rpc_call_failed: 1 }, committedResearchItemIds: ["ri-1"] },
      true,
    );

    expect(completion.status).toBe("partially_succeeded");
    expect(completion.error_summary).toBe(
      "One or more candidates could not be committed; see metadata.skippedByReason for aggregate, non-sensitive counts by reason.",
    );
    expect(completion.error_summary).not.toMatch(/Recipient|Description|award/i);
  });
});
