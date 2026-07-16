/**
 * Pure/hermetic CLI flag-parsing and --commit preflight-guard logic for
 * supabase/connector-usaspending.ts. Pulled out of that file for the same
 * reason pipeline.ts was pulled out of it originally: the CLI file itself
 * has a side-effecting top-level `main()` call and must never be imported
 * by a test -- this module has no side effects on import and is safe to
 * import directly.
 *
 * `assertExactlyOneActiveReviewer` takes a minimal, duck-typed
 * `ReviewerCountClient` shape rather than the real `SupabaseClient` type,
 * so tests can pass a plain mock object without importing @supabase/supabase-js
 * or service-client.ts at all.
 */

export interface CliOptions {
  mode: "dry-run" | "commit";
  maxRequests: number;
  maxCandidates: number;
  /**
   * DIAGNOSTIC ONLY. Null unless --diagnostic-keyword was explicitly
   * passed. Never the default request path -- see search.ts's
   * buildSearchRequestBody header comment. Hard-rejected in combination
   * with --commit (see parseArgs).
   */
  diagnosticKeyword: string | null;
  /** --commit's required, separate opt-in flag (see parseArgs). */
  confirmReviewerControl: boolean;
}

const DEFAULT_MAX_REQUESTS = 10;
const DEFAULT_MAX_CANDIDATES = 25;

/**
 * Dev/CI project refs --commit is allowed to run against. An allow-list,
 * not a production deny-list -- an allow-list fails safe against any
 * unrecognized project (including production), a deny-list only catches
 * refs it already knows about. Production (cxotknsqqswxxtbquyou) is
 * deliberately never on this list.
 */
export const ALLOWED_COMMIT_PROJECT_REFS = ["isdtiwdfeirgjoaokikg"];

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

/**
 * --commit + --diagnostic-keyword is hard-rejected here, before any fetch
 * or DB access of any kind -- a diagnostic, keyword-biased sample must
 * never be allowed to bias a real commit run.
 */
export function parseArgs(argv: string[]): CliOptions {
  const isCommit = argv.includes("--commit");
  const diagnosticKeyword = getStringFlagValue(argv, "--diagnostic-keyword");

  if (isCommit && diagnosticKeyword) {
    throw new Error(
      "--commit cannot be combined with --diagnostic-keyword. Diagnostic keyword-biased runs are dry-run only.",
    );
  }

  return {
    mode: isCommit ? "commit" : "dry-run",
    maxRequests: getFlagValue(argv, "--max-requests", DEFAULT_MAX_REQUESTS),
    maxCandidates: getFlagValue(argv, "--max-candidates", DEFAULT_MAX_CANDIDATES),
    diagnosticKeyword,
    confirmReviewerControl: argv.includes("--confirm-reviewer-control"),
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

/** Pure -- extracts the project ref from a Supabase project URL (e.g. "https://isdtiwdfeirgjoaokikg.supabase.co" -> "isdtiwdfeirgjoaokikg"). */
export function extractProjectRefFromSupabaseUrl(url: string): string | null {
  const match = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : null;
}

/**
 * Throws (aborts) before any fetch/DB call if the configured Supabase
 * project isn't on the dev/CI allow-list. Never a deny-list -- see
 * ALLOWED_COMMIT_PROJECT_REFS's comment.
 */
export function assertDevCiProject(supabaseUrl: string | undefined, allowList: string[] = ALLOWED_COMMIT_PROJECT_REFS): void {
  if (!supabaseUrl) {
    throw new Error(
      "COMMIT MODE ABORTED: NEXT_PUBLIC_SUPABASE_URL is not set -- cannot verify this is the dev/CI project.",
    );
  }
  const ref = extractProjectRefFromSupabaseUrl(supabaseUrl);
  if (!ref || !allowList.includes(ref)) {
    throw new Error(
      `COMMIT MODE ABORTED: Supabase project ref "${ref ?? supabaseUrl}" is not on the dev/CI commit allow-list (${allowList.join(", ")}). Refusing to run --commit against an unrecognized or production project.`,
    );
  }
}

/**
 * Reviewer-control preflight, applied to an already-executed query's raw
 * result: aborts unless exactly one active reviewer_profiles row exists.
 * Deliberately takes plain primitives (count/error), not a Supabase client
 * or query-builder shape -- structurally duck-typing against the real
 * SupabaseClient's deeply generic chainable builder type previously
 * triggered `TS2589: Type instantiation is excessively deep and possibly
 * infinite` at the call site in supabase/connector-usaspending.ts. Taking
 * primitives sidesteps that entirely and makes this trivially testable
 * with plain numbers/objects -- no client mock of any kind needed.
 *
 * The actual `client.from("reviewer_profiles").select(...).eq(...)` query
 * runs in supabase/connector-usaspending.ts (the one place a real
 * SupabaseClient is ever constructed); this function is called with that
 * query's `{ count, error }` result. Must run before any USAspending fetch
 * or commit write -- a simple count check (not an identity/email check) is
 * deliberate: unambiguous, hard to get wrong, and re-verified on every
 * single --commit invocation, not just once.
 */
export function assertExactlyOneActiveReviewer(count: number | null, error: { message: string } | null): void {
  if (error) {
    throw new Error(`COMMIT MODE ABORTED: reviewer-control preflight query failed: ${error.message}`);
  }
  if (count !== 1) {
    throw new Error(
      `COMMIT MODE ABORTED: reviewer-control preflight requires exactly one active reviewer_profiles row; found ${count}. Deactivate every other reviewer account before running --commit.`,
    );
  }
}
