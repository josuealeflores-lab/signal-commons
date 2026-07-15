import fs from "node:fs";
import path from "node:path";
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
import type { AwardRequestKind, RawUsaspendingAward } from "../src/lib/connectors/usaspending/types.ts";

/**
 * Milestone 6B USAspending connector -- DRY-RUN ONLY. This script makes
 * live read-only network calls to api.usaspending.gov, but performs ZERO
 * database writes of any kind: no ingestion_runs row, no research_items
 * row, no companies/signals/source_documents/signal_evidence/
 * company_aliases row. It does not import getServiceSupabaseClient or any
 * Supabase client at all -- the entity-resolution preview
 * (src/lib/connectors/usaspending/entity-resolution-preview.ts) is a pure
 * function operating on an empty `existingAliases` array by default,
 * relying on intra-batch matching only (Cowork/Fable's recommended M6B
 * design -- no DB dependency unless a future milestone adds one).
 *
 * --commit mode does not exist in this file at all; passing --commit
 * fails loudly rather than silently doing nothing, so a flag typo can
 * never be mistaken for a real commit run.
 *
 * NOT run automatically by this implementation step. Do not invoke this
 * script against the live API until a separately-approved manual
 * validation gate (see the M6B plan's §9) -- starting with a minimal
 * read-only smoke test to reconcile the exact request-body field names
 * against the live API, before any full dry-run pull.
 *
 * Requests are planned and issued one award_type_group at a time
 * (contracts, then grants, then other_financial_assistance, then
 * direct_payments -- ALL_REQUEST_KINDS's fixed order), never combining
 * codes from more than one group in a single request (D-086, extended
 * after a live 422 showed USAspending enforces this within "assistance"
 * too, not just contracts-vs-assistance). Loans (07/08) are excluded from
 * every request. --max-requests is a hard cap on total live HTTP requests
 * across all groups combined; if the cap is reached before a group's turn,
 * that group (and any after it) is skipped entirely and reported as such
 * -- see fetchAllPlannedRequestKinds's header comment in http-client.ts.
 *
 * Every run also computes aggregate, non-sensitive field-presence counts
 * (via field-mapping.ts's computeFieldPresenceStats) across every fetched/
 * deduped record -- including ones Stage-1 excludes -- so field-mapping
 * coverage stays observable even when a run produces zero candidates.
 * These are presence counts only: never a raw value, recipient name,
 * award description, or example record.
 *
 * `--diagnostic-keyword="<term>"` is a DIAGNOSTIC-ONLY opt-in flag that
 * adds USAspending's `filters.description` keyword filter to every
 * request this run makes, biasing the sample toward matches purely to
 * exercise the candidate-preview path on live data. It is never the
 * default (omitted unless explicitly passed), never changes normal
 * cap-driven behavior, and every report/summary produced with it set is
 * prominently labeled "DIAGNOSTIC KEYWORD-BIASED RUN" with an explicit
 * warning that results are not representative and must never be used for
 * recall/precision estimation or Stage-1 validation.
 *
 * Unlike the supabase/seed*.ts scripts, `connector:usaspending:dry-run`
 * runs plain `node supabase/connector-usaspending.ts` with no
 * `--env-file`/`--conditions=react-server` flags. That's intentional, not
 * an oversight: this script reads zero environment variables (grep
 * confirms no `process.env` usage anywhere in src/lib/connectors/
 * usaspending/ or this file) and needs no Supabase credential of any
 * kind -- USAspending's Award Search endpoint requires no auth, and M6B's
 * entity-resolution preview is a pure function with no DB dependency (see
 * above). If a future milestone adds a real credential requirement (e.g.
 * M6C's --commit mode reading company_aliases), reintroduce
 * `--env-file`/`--conditions=react-server` at that point -- don't assume
 * they're needed here.
 */

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_MAX_CANDIDATES = 25;
const DEFAULT_PAGE_LIMIT = 100;
const OUTPUT_DIR = path.resolve(import.meta.dirname, "..", "connector-runs");

export interface CliOptions {
  maxRequests: number;
  maxCandidates: number;
  /**
   * DIAGNOSTIC ONLY. Null unless --diagnostic-keyword was explicitly
   * passed. Never the default request path -- see search.ts's
   * buildSearchRequestBody header comment.
   */
  diagnosticKeyword: string | null;
}

function getFlagValue(argv: string[], flag: string, defaultValue: number): number {
  const exact = argv.indexOf(flag);
  const prefixed = argv.findIndex((arg) => arg.startsWith(`${flag}=`));

  if (exact !== -1) {
    const raw = argv[exact + 1];
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
  }

  if (prefixed !== -1) {
    const raw = argv[prefixed].split("=")[1];
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
  }

  return defaultValue;
}

function getStringFlagValue(argv: string[], flag: string): string | null {
  const exact = argv.indexOf(flag);
  const prefixed = argv.findIndex((arg) => arg.startsWith(`${flag}=`));

  if (exact !== -1) {
    const raw = argv[exact + 1];
    return raw && !raw.startsWith("--") ? raw : null;
  }

  if (prefixed !== -1) {
    const raw = argv[prefixed].slice(argv[prefixed].indexOf("=") + 1);
    return raw.length > 0 ? raw : null;
  }

  return null;
}

export function parseArgs(argv: string[]): CliOptions {
  if (argv.includes("--commit")) {
    throw new Error(
      "--commit is not implemented until Milestone 6C. This script only supports --dry-run in Milestone 6B.",
    );
  }

  return {
    maxRequests: getFlagValue(argv, "--max-requests", DEFAULT_MAX_REQUESTS),
    maxCandidates: getFlagValue(argv, "--max-candidates", DEFAULT_MAX_CANDIDATES),
    diagnosticKeyword: getStringFlagValue(argv, "--diagnostic-keyword"),
  };
}

/**
 * Operational sampling window: the trailing 90 days, per the locked
 * spec's Decision 6 -- USAspending's own time_period filter semantics
 * define the actual candidate set (D-087); this is just the requested
 * boundary, never a post-hoc rejection rule.
 */
export function computeDefaultWindow(now: Date = new Date()): { startDate: string; endDate: string } {
  const end = now;
  const start = new Date(now);
  start.setDate(start.getDate() - 90);
  return { startDate: toDateString(start), endDate: toDateString(end) };
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

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

  const requestState: RequestState = { requestsSent: 0 };
  const window = computeDefaultWindow();
  const httpOptions = {
    maxRequests: options.maxRequests,
    ...(options.diagnosticKeyword ? { diagnosticKeyword: options.diagnosticKeyword } : {}),
  };

  // D-086 (extended): one request per USAspending award_type_group --
  // contracts, then the three non-loan assistance groups (grants,
  // other_financial_assistance, direct_payments), in that fixed order.
  // Loans (07/08) are never requested (search.ts's
  // UNTESTED_LOAN_AWARD_TYPE_CODES). max_requests is a hard cap on total
  // live HTTP requests across ALL groups combined: once the budget is
  // exhausted, remaining groups are skipped (not fetched at all) rather
  // than throwing -- see fetchAllPlannedRequestKinds's header comment.
  const { fetchedByKind, skippedDueToRequestCap } = await fetchAllPlannedRequestKinds(
    window,
    DEFAULT_PAGE_LIMIT,
    options.maxCandidates,
    requestState,
    httpOptions,
  );

  if (skippedDueToRequestCap.length > 0) {
    console.log(
      `PARTIAL RUN: max_requests=${options.maxRequests} was reached before these request kinds could be attempted: ${skippedDueToRequestCap.join(", ")}. They were never fetched -- this is not full connector coverage.`,
    );
  }

  // D-086 dedup: first-seen-wins by generated_internal_id across every
  // fetched group, in ALL_REQUEST_KINDS's fixed priority order.
  const taggedAwards: TaggedRawAward[] = dedupeAwardsByGeneratedInternalId(
    ALL_REQUEST_KINDS.flatMap((kind: AwardRequestKind) =>
      (fetchedByKind[kind] ?? []).map((raw: RawUsaspendingAward) => ({ raw, requestKind: kind })),
    ),
  );

  // Aggregate, non-sensitive field-presence stats across every fetched/
  // deduped record -- including ones Stage-1 will go on to exclude -- so
  // field-mapping coverage is observable even on a run that produces zero
  // candidates. Computed from the same taggedAwards the pipeline consumes,
  // via the same extractAwardFields() the candidate path uses.
  const fieldPresenceStats = computeFieldPresenceStats(taggedAwards);

  const batchAliasMap: BatchAliasMap = new Map();
  const { candidates, skipped } = processTaggedAwards(taggedAwards, batchAliasMap);

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

main().catch((err) => {
  console.error("USAspending connector dry-run failed:", err);
  // Node's default error formatting does not reliably surface a custom
  // `cause` property, and USAspending's validation error message (the
  // thing that actually explains a 422) lives there -- print it
  // explicitly so a failed run is diagnosable from console output alone.
  if (err instanceof UsaspendingRequestError && err.cause) {
    console.error("USAspending response body:\n" + String(err.cause));
  }
  process.exitCode = 1;
});
