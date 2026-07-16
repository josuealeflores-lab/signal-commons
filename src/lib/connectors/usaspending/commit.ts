import { serializeCandidateForCommit, type CommitCandidateDto } from "./commit-serializer.ts";
import type { CandidatePreview } from "./types.ts";

/**
 * M6C commit orchestration -- pure/hermetic logic only. Deliberately does
 * NOT import getServiceSupabaseClient or any Supabase client: the actual
 * RPC call and ingestion_runs read/write happen only in
 * supabase/connector-usaspending.ts (a CLI script, never imported by a
 * test, exactly like pipeline.ts/http-client.ts's existing pattern -- see
 * D-044 on why connector modules avoid `import "server-only"`). This
 * module instead accepts an injected `CommitRpcCaller` function, the same
 * dependency-injection pattern http-client.ts uses for `fetchImpl` -- tests
 * supply a mock caller and never touch a real database.
 *
 * Eligibility mirrors docs/ENTITY_RESOLUTION_POLICY.md §5 and the applied
 * commit_usaspending_candidate migration's own scope: only MATCH and NEW
 * candidates are ever sent to the RPC. AMBIGUOUS/CONFLICT/possible_individual
 * are skipped and counted by this orchestration layer itself -- never as an
 * entity_match research_items row (M6C non-scope; see the migration's
 * header comment on why entity_match creation is deferred).
 */

export type CommitRpcResult =
  | { decision: "committed"; companyId: string; companyCreated: boolean; sourceDocumentId: string; signalId: string; researchItemId: string }
  | { decision: "skipped_already_exists"; researchItemId: string }
  | { decision: "skipped_demo_company_collision" }
  | { decision: "skipped_invalid_payload"; missingFields: string[] };

export interface CommitRpcParams {
  p_ingestion_run_id: string;
  p_normalized_uei: string;
  p_candidate: CommitCandidateDto;
}

/** Injected dependency -- the CLI's real implementation wraps `client.rpc("commit_usaspending_candidate", params)`. */
export type CommitRpcCaller = (params: CommitRpcParams) => Promise<CommitRpcResult>;

export type CommitSkipReason =
  | "ambiguous_name_collision"
  | "ambiguous_no_uei"
  | "conflict_duplicate_uei"
  | "possible_individual"
  | "missing_entity_decision"
  | "missing_recipient_uei_for_commit"
  | "serialization_failed"
  | "rpc_skipped_demo_company_collision"
  | "rpc_skipped_already_exists"
  | "rpc_skipped_invalid_payload"
  | "rpc_call_failed";

export interface CommitOutcome {
  generatedInternalId: string;
  outcome: "committed" | "skipped";
  reason?: CommitSkipReason;
  companyId?: string;
  signalId?: string;
  researchItemId?: string;
}

export interface CommitRunSummary {
  committedCount: number;
  skippedByReason: Record<string, number>;
  /** Non-sensitive: deterministic ids only, never a raw recipient name/description. */
  committedResearchItemIds: string[];
}

/** Only MATCH and NEW candidates are eligible for the RPC at all. */
export function isEligibleForCommit(candidate: CandidatePreview): boolean {
  const decision = candidate.entityPreview?.decision;
  return decision === "MATCH" || decision === "NEW";
}

function skipReasonForIneligible(candidate: CandidatePreview): CommitSkipReason {
  const entity = candidate.entityPreview;
  if (!entity) return "missing_entity_decision";
  switch (entity.reason) {
    case "possible_individual":
      return "possible_individual";
    case "name_collision":
      return "ambiguous_name_collision";
    case "no_uei":
      return "ambiguous_no_uei";
    case "duplicate_uei":
      return "conflict_duplicate_uei";
    default:
      return "missing_entity_decision";
  }
}

const RPC_SKIP_REASON_MAP: Record<string, CommitSkipReason> = {
  skipped_demo_company_collision: "rpc_skipped_demo_company_collision",
  skipped_already_exists: "rpc_skipped_already_exists",
  skipped_invalid_payload: "rpc_skipped_invalid_payload",
};

/**
 * Commits (or skips) exactly one candidate. Never calls the RPC for an
 * ineligible candidate -- callers can assert this in tests by checking the
 * injected rpcCaller mock was not invoked for AMBIGUOUS/CONFLICT/
 * possible_individual fixtures.
 *
 * Idempotency (already-ingested deterministic ids) is enforced by the RPC
 * itself (research_items.id existence check, see the applied migration) --
 * this orchestration layer deliberately does not duplicate that check with
 * a separate pre-fetch, to avoid a second, potentially-stale round trip.
 */
export async function commitCandidate(
  candidate: CandidatePreview,
  ingestionRunId: string,
  rpcCaller: CommitRpcCaller,
): Promise<CommitOutcome> {
  if (!isEligibleForCommit(candidate)) {
    return {
      generatedInternalId: candidate.generatedInternalId,
      outcome: "skipped",
      reason: skipReasonForIneligible(candidate),
    };
  }

  // Structurally, MATCH/NEW always carry a UEI (previewEntityDecision
  // routes any no-UEI recipient to AMBIGUOUS/no_uei before MATCH/NEW is
  // ever reachable) -- but this function never assumes that invariant
  // holds without checking; fail safe as a skip, never call the RPC with
  // an empty UEI.
  const normalizedUei = candidate.fields.recipientUei?.trim().toUpperCase();
  if (!normalizedUei) {
    return {
      generatedInternalId: candidate.generatedInternalId,
      outcome: "skipped",
      reason: "missing_recipient_uei_for_commit",
    };
  }

  // A serialization failure for one candidate (e.g. a blank recipientName
  // that slipped past Stage-1/entity-resolution) must never abort the
  // whole commit batch -- caught here, not left to propagate out of
  // commitCandidateBatch's loop, and counted as a skip like every other
  // per-candidate failure mode. Never surfaces the underlying error
  // message (it could echo candidate content) -- a fixed, non-sensitive
  // reason code only.
  let dto: CommitCandidateDto;
  try {
    dto = serializeCandidateForCommit(candidate);
  } catch {
    return {
      generatedInternalId: candidate.generatedInternalId,
      outcome: "skipped",
      reason: "serialization_failed",
    };
  }

  let result: CommitRpcResult;
  try {
    result = await rpcCaller({
      p_ingestion_run_id: ingestionRunId,
      p_normalized_uei: normalizedUei,
      p_candidate: dto,
    });
  } catch {
    // Never surface the raw error/exception message here -- it could echo
    // request payload content back into a log. Non-sensitive reason code
    // only; the CLI's own console output is where a real operator sees the
    // underlying error for a single run, not the aggregate summary.
    return {
      generatedInternalId: candidate.generatedInternalId,
      outcome: "skipped",
      reason: "rpc_call_failed",
    };
  }

  if (result.decision === "committed") {
    return {
      generatedInternalId: candidate.generatedInternalId,
      outcome: "committed",
      companyId: result.companyId,
      signalId: result.signalId,
      researchItemId: result.researchItemId,
    };
  }

  return {
    generatedInternalId: candidate.generatedInternalId,
    outcome: "skipped",
    reason: RPC_SKIP_REASON_MAP[result.decision] ?? "rpc_call_failed",
  };
}

/** Sequential (never parallel) so `research_items` idempotency checks inside the RPC never race against each other for accidentally-duplicated candidates within the same run. */
export async function commitCandidateBatch(
  candidates: CandidatePreview[],
  ingestionRunId: string,
  rpcCaller: CommitRpcCaller,
): Promise<{ outcomes: CommitOutcome[]; summary: CommitRunSummary }> {
  const outcomes: CommitOutcome[] = [];
  const skippedByReason: Record<string, number> = {};
  const committedResearchItemIds: string[] = [];

  for (const candidate of candidates) {
    const outcome = await commitCandidate(candidate, ingestionRunId, rpcCaller);
    outcomes.push(outcome);

    if (outcome.outcome === "committed" && outcome.researchItemId) {
      committedResearchItemIds.push(outcome.researchItemId);
    } else if (outcome.reason) {
      skippedByReason[outcome.reason] = (skippedByReason[outcome.reason] ?? 0) + 1;
    }
  }

  return {
    outcomes,
    summary: {
      committedCount: committedResearchItemIds.length,
      skippedByReason,
      committedResearchItemIds,
    },
  };
}

export interface IngestionRunCompletion {
  status: "succeeded" | "partially_succeeded";
  records_discovered: number;
  records_created: number;
  records_skipped: number;
  error_summary: string | null;
  metadata: {
    skippedByReason: Record<string, number>;
    researchItemIds: string[];
  };
  finished_at: string;
}

/**
 * Builds the ingestion_runs completion row -- pure, no DB. error_summary is
 * always this one fixed, non-sensitive sentence (never per-candidate raw
 * content); the real per-reason breakdown lives only in metadata.skippedByReason
 * as counts.
 */
export function buildIngestionRunCompletion(
  totalDiscovered: number,
  summary: CommitRunSummary,
  hadFailures: boolean,
  now: Date = new Date(),
): IngestionRunCompletion {
  return {
    status: hadFailures ? "partially_succeeded" : "succeeded",
    records_discovered: totalDiscovered,
    records_created: summary.committedCount,
    records_skipped: totalDiscovered - summary.committedCount,
    error_summary: hadFailures
      ? "One or more candidates could not be committed; see metadata.skippedByReason for aggregate, non-sensitive counts by reason."
      : null,
    metadata: {
      skippedByReason: summary.skippedByReason,
      researchItemIds: summary.committedResearchItemIds,
    },
    finished_at: now.toISOString(),
  };
}
