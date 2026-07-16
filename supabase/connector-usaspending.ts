import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPlannedRequestKinds, UsaspendingRequestError, type RequestState } from "../src/lib/connectors/usaspending/http-client.ts";
import {
  computeFieldPresenceStats,
  dedupeAwardsByGeneratedInternalId,
  type TaggedRawAward,
} from "../src/lib/connectors/usaspending/field-mapping.ts";
import { processTaggedAwards } from "../src/lib/connectors/usaspending/pipeline.ts";
import { type BatchAliasMap } from "../src/lib/connectors/usaspending/entity-resolution-preview.ts";
import { buildDryRunReport, formatSummary } from "../src/lib/connectors/usaspending/dry-run-report.ts";
import { ALL_REQUEST_KINDS } from "../src/lib/connectors/usaspending/search.ts";
import type { AwardRequestKind, EntityAliasRecord, RawUsaspendingAward } from "../src/lib/connectors/usaspending/types.ts";
import {
  commitCandidateBatch,
  buildIngestionRunCompletion,
  type CommitRpcCaller,
  type CommitRpcResult,
} from "../src/lib/connectors/usaspending/commit.ts";
import {
  parseArgs,
  computeDefaultWindow,
  assertDevCiProject,
  assertExactlyOneActiveReviewer,
  type CliOptions,
} from "../src/lib/connectors/usaspending/cli-guards.ts";

/**
 * Milestone 6B/6C USAspending connector CLI. Two modes:
 *
 * - dry-run (default): makes live read-only network calls to
 *   api.usaspending.gov but performs ZERO database writes of any kind. Does
 *   not import getServiceSupabaseClient at module load time -- see below.
 * - --commit (M6C): additionally writes real, draft, non-demo rows via the
 *   commit_usaspending_candidate SECURITY DEFINER RPC (applied to dev/CI
 *   only as of docs/DECISIONS.md D-092). Requires three independent
 *   technical guards (not a policy note) to all pass, in order, before any
 *   fetch or DB call: --confirm-reviewer-control present, the dev/CI
 *   project allow-list assertion, and a reviewer-control preflight query
 *   (exactly one active reviewer_profiles row). All three guard
 *   implementations and CLI flag parsing live in
 *   src/lib/connectors/usaspending/cli-guards.ts specifically so they're
 *   importable and hermetically unit-testable -- this file itself has a
 *   side-effecting top-level `main()` call and must never be imported by a
 *   test (same reasoning as pipeline.ts's original extraction from this
 *   file in M6B).
 *
 * getServiceSupabaseClient is imported dynamically, only inside main()'s
 * --commit branch, never at this file's top level. This is deliberate, not
 * an oversight: service-client.ts has `import "server-only"`, which throws
 * immediately under plain `node` (no --conditions=react-server) --
 * D-044/the dry-run script's own design relies on that flag NOT being
 * needed for dry-run. A top-level static import of service-client.ts would
 * break `npm run connector:usaspending:dry-run` (which intentionally never
 * passes --conditions=react-server) even when --commit is never passed.
 * `npm run connector:usaspending:commit` (package.json) does pass
 * --conditions=react-server, so the dynamic import succeeds there.
 *
 * There is no production commit script anywhere in package.json --
 * --commit's dev/CI project assertion is the only thing that would stop a
 * manually-invoked production run, so no script is added that could
 * encourage one.
 */

const DEFAULT_PAGE_LIMIT = 100;
const OUTPUT_DIR = path.resolve(import.meta.dirname, "..", "connector-runs");

/** Bulk-lookup helper: real, non-demo-filtered UEI aliases, feeding previewEntityDecision so it can propose MATCH against already-known real companies (see pipeline.ts's header comment). */
async function fetchNonDemoUeiAliases(client: SupabaseClient): Promise<EntityAliasRecord[]> {
  const { data, error } = await client
    .from("company_aliases")
    .select("company_id, alias_type, normalized_alias, companies!inner(is_demo)")
    .eq("alias_type", "uei")
    .eq("companies.is_demo", false);

  if (error) {
    throw new Error(`COMMIT MODE ABORTED: failed to load existing non-demo UEI aliases: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    companyId: row.company_id as string,
    aliasType: row.alias_type as EntityAliasRecord["aliasType"],
    normalizedAlias: row.normalized_alias as string,
  }));
}

async function fetchAndPrepareCandidates(options: CliOptions, existingAliases: EntityAliasRecord[]) {
  const requestState: RequestState = { requestsSent: 0 };
  const window = computeDefaultWindow();
  const httpOptions = {
    maxRequests: options.maxRequests,
    ...(options.diagnosticKeyword ? { diagnosticKeyword: options.diagnosticKeyword } : {}),
  };

  const { fetchedByKind, skippedDueToRequestCap } = await fetchAllPlannedRequestKinds(
    window,
    DEFAULT_PAGE_LIMIT,
    options.maxCandidates,
    requestState,
    httpOptions,
  );

  const taggedAwards: TaggedRawAward[] = dedupeAwardsByGeneratedInternalId(
    ALL_REQUEST_KINDS.flatMap((kind: AwardRequestKind) =>
      (fetchedByKind[kind] ?? []).map((raw: RawUsaspendingAward) => ({ raw, requestKind: kind })),
    ),
  );

  const fieldPresenceStats = computeFieldPresenceStats(taggedAwards);
  const batchAliasMap: BatchAliasMap = new Map();
  const { candidates, skipped } = processTaggedAwards(taggedAwards, batchAliasMap, existingAliases);

  return { requestState, skippedDueToRequestCap, fieldPresenceStats, candidates, skipped };
}

async function runDryRunMode(options: CliOptions): Promise<void> {
  console.log(
    `USAspending connector dry-run starting (max_requests=${options.maxRequests}, max_candidates=${options.maxCandidates})`,
  );
  console.log("This script makes live read-only network calls to api.usaspending.gov.");
  console.log(
    "It performs ZERO database writes of any kind -- no ingestion_runs/research_items/companies/signals/source_documents/signal_evidence/company_aliases row is ever inserted.",
  );

  if (options.diagnosticKeyword) {
    console.log(
      `*** DIAGNOSTIC KEYWORD-BIASED RUN *** keyword="${options.diagnosticKeyword}" -- this biases every request toward keyword matches and is NOT representative. Never use this run's results for recall/precision estimation or Stage-1 validation.`,
    );
  }

  const { requestState, skippedDueToRequestCap, fieldPresenceStats, candidates, skipped } = await fetchAndPrepareCandidates(
    options,
    [],
  );

  if (skippedDueToRequestCap.length > 0) {
    console.log(
      `PARTIAL RUN: max_requests=${options.maxRequests} was reached before these request kinds could be attempted: ${skippedDueToRequestCap.join(", ")}. They were never fetched -- this is not full connector coverage.`,
    );
  }

  const report = buildDryRunReport(
    candidates,
    skipped,
    requestState.requestsSent,
    skippedDueToRequestCap,
    fieldPresenceStats,
    options.diagnosticKeyword,
  );

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = report.generatedAt.replace(/[:.]/g, "-");
  const jsonPath = path.join(OUTPUT_DIR, `dry-run-${timestamp}.json`);
  const summaryPath = path.join(OUTPUT_DIR, `dry-run-${timestamp}.summary.md`);

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(summaryPath, formatSummary(report));

  console.log(formatSummary(report));
  console.log(`\nFull report written to: ${jsonPath}`);
  console.log(`Summary written to: ${summaryPath}`);
}

/**
 * COMMIT MODE. Not run by this implementation step -- see this file's
 * header comment and the M6C plan's manual approval gates. Only reachable
 * from main() after all three preflight guards have already passed.
 */
async function runCommitMode(options: CliOptions, client: SupabaseClient): Promise<void> {
  const ingestionRunId = `ingest-usaspending-${Date.now()}`;
  const startedAt = new Date().toISOString();

  console.log(
    `*** COMMIT MODE *** ingestion_run_id=${ingestionRunId}. This run WILL write real rows to the configured Supabase project.`,
  );

  const { error: insertError } = await client.from("ingestion_runs").insert({
    id: ingestionRunId,
    connector_key: "usaspending_award_search",
    started_at: startedAt,
    status: "running",
    records_discovered: 0,
    records_created: 0,
    records_skipped: 0,
  });
  if (insertError) {
    throw new Error(`COMMIT MODE ABORTED: failed to create ingestion_runs row: ${insertError.message}`);
  }

  const existingAliases = await fetchNonDemoUeiAliases(client);
  const { skippedDueToRequestCap, candidates } = await fetchAndPrepareCandidates(options, existingAliases);

  if (skippedDueToRequestCap.length > 0) {
    console.log(
      `PARTIAL RUN: max_requests=${options.maxRequests} was reached before these request kinds could be attempted: ${skippedDueToRequestCap.join(", ")}.`,
    );
  }

  const rpcCaller: CommitRpcCaller = async (params) => {
    const { data, error } = await client.rpc("commit_usaspending_candidate", params);
    if (error) throw error;
    return data as CommitRpcResult;
  };

  const { summary } = await commitCandidateBatch(candidates, ingestionRunId, rpcCaller);
  // Both an RPC call failure and a serialization failure indicate a real
  // pipeline/serializer defect (not an expected triage outcome like
  // AMBIGUOUS/CONFLICT) -- either one marks the run partially_succeeded
  // rather than succeeded, even though individual candidates around it
  // still committed fine.
  const hadFailures =
    Object.prototype.hasOwnProperty.call(summary.skippedByReason, "rpc_call_failed") ||
    Object.prototype.hasOwnProperty.call(summary.skippedByReason, "serialization_failed");
  const completion = buildIngestionRunCompletion(candidates.length, summary, hadFailures);

  const { error: updateError } = await client.from("ingestion_runs").update(completion).eq("id", ingestionRunId);
  if (updateError) {
    console.error(`Warning: failed to update ingestion_runs row ${ingestionRunId} with completion status: ${updateError.message}`);
  }

  console.log(`COMMIT MODE complete. committed=${summary.committedCount} skippedByReason=${JSON.stringify(summary.skippedByReason)}`);
  console.log(`ingestion_runs.id=${ingestionRunId}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.mode === "commit") {
    // Guard 1: --confirm-reviewer-control must be explicitly present.
    // Deliberately separate from --commit itself so a bare --commit typo
    // can never silently proceed. Checked before any fetch or DB call.
    if (!options.confirmReviewerControl) {
      throw new Error(
        "COMMIT MODE ABORTED: --commit requires --confirm-reviewer-control. This is a deliberate, separate opt-in flag.",
      );
    }

    // Guard 2: dev/CI project allow-list assertion. Checked before any
    // fetch or DB call -- reads only an env var, no network/DB access yet.
    assertDevCiProject(process.env.NEXT_PUBLIC_SUPABASE_URL);

    // getServiceSupabaseClient is imported dynamically here (not at this
    // file's top level) -- see this file's header comment for why a
    // top-level static import would break dry-run mode.
    const { getServiceSupabaseClient } = await import("../src/lib/supabase/service-client.ts");
    const client = getServiceSupabaseClient();

    // Guard 3: reviewer-control preflight (exactly one active reviewer).
    // This is the one guard that requires a DB read -- still runs before
    // any USAspending fetch or any commit write. The query itself runs
    // here (the one place a real SupabaseClient exists); the pass/fail
    // logic lives in cli-guards.ts's assertExactlyOneActiveReviewer, which
    // takes the plain { count, error } result rather than a client shape
    // (see that function's header comment for why).
    const reviewerCountQuery = await client.from("reviewer_profiles").select("id", { count: "exact", head: true }).eq("is_active", true);
    assertExactlyOneActiveReviewer(reviewerCountQuery.count, reviewerCountQuery.error);

    console.log(
      "COMMIT MODE: all preflight guards passed (confirm flag present, dev/CI project verified, exactly one active reviewer).",
    );

    await runCommitMode(options, client);
    return;
  }

  await runDryRunMode(options);
}

main().catch((err) => {
  console.error("USAspending connector run failed:", err);
  // Node's default error formatting does not reliably surface a custom
  // `cause` property, and USAspending's validation error message (the
  // thing that actually explains a 422) lives there -- print it
  // explicitly so a failed run is diagnosable from console output alone.
  if (err instanceof UsaspendingRequestError && err.cause) {
    console.error("USAspending response body:\n" + String(err.cause));
  }
  process.exitCode = 1;
});
