import { ALL_REQUEST_KINDS, buildSearchRequestBody, type TimePeriodWindow } from "./search.ts";
import type { AwardRequestKind, RawUsaspendingAward } from "./types.ts";

/**
 * Low-level USAspending fetch wrapper. Deliberately NOT guarded with
 * `import "server-only"`: this module holds no secret (USAspending needs
 * no auth) and doing so would make it throw under plain `npm test`
 * (docs/DECISIONS.md D-044 -- Vitest doesn't set the `react-server`
 * condition that guard relies on, even for hermetic unit tests). Isolation
 * from the public app bundle is enforced instead by (a) living under
 * src/lib/connectors/, never imported by src/app/**, and (b) the dedicated
 * no-leakage test (tests/lib/connectors/usaspending/no-leakage.test.ts).
 *
 * Every function here accepts an injectable `fetchImpl` so tests can supply
 * a mock and never make a live network call.
 */

export const DEFAULT_BASE_URL = "https://api.usaspending.gov";
export const SEARCH_PATH = "/api/v2/search/spending_by_award/";

export class RequestCapExceededError extends Error {
  constructor(maxRequests: number) {
    super(`max_requests cap of ${maxRequests} reached before issuing another request`);
    this.name = "RequestCapExceededError";
  }
}

export class UsaspendingRequestError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "UsaspendingRequestError";
    this.cause = cause;
  }
}

export interface HttpClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** Delay between successive page requests, in ms. Default ~1 req/s. */
  requestDelayMs?: number;
  maxRequests: number;
  /**
   * DIAGNOSTIC ONLY. When set, added as USAspending's `filters.description`
   * keyword filter on every request this run makes. Never set by default --
   * see search.ts's buildSearchRequestBody header comment and
   * connector-usaspending.ts's --diagnostic-keyword flag.
   */
  diagnosticKeyword?: string;
}

/** Mutable counter shared across every request issued in one connector run. */
export interface RequestState {
  requestsSent: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetches a single page. Stop-on-first-failure: throws on cap-exceeded, non-2xx, network error, or an unexpected response shape -- never retries silently. */
export async function fetchSearchPage(
  requestKind: AwardRequestKind,
  window: TimePeriodWindow,
  page: number,
  limit: number,
  requestState: RequestState,
  options: HttpClientOptions,
): Promise<RawUsaspendingAward[]> {
  if (requestState.requestsSent >= options.maxRequests) {
    throw new RequestCapExceededError(options.maxRequests);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const body = buildSearchRequestBody(requestKind, window, page, limit, options.diagnosticKeyword);

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${SEARCH_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw new UsaspendingRequestError("USAspending request failed (network error or timeout)", cause);
  }

  requestState.requestsSent += 1;

  if (!response.ok) {
    // Capture the response body for diagnostics -- USAspending's 4xx
    // responses carry a validation message (e.g. which `fields` entry was
    // rejected) that would otherwise be silently discarded, leaving only
    // the status code to debug from.
    let responseBody: string | null = null;
    try {
      responseBody = await response.text();
    } catch {
      // Body unreadable; fall through with responseBody left null.
    }
    throw new UsaspendingRequestError(
      `USAspending request failed with HTTP ${response.status}`,
      responseBody,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (cause) {
    throw new UsaspendingRequestError("USAspending response was not valid JSON", cause);
  }

  if (!isPlainRecord(json) || !Array.isArray(json.results)) {
    throw new UsaspendingRequestError(
      "USAspending response did not have the expected { results: [...] } shape",
    );
  }

  return json.results as RawUsaspendingAward[];
}

/**
 * Bounded, minimal pagination: stops as soon as a page returns fewer than
 * `limit` results (last page) or once `maxCandidatesForThisRequest` raw
 * records have been collected -- never loops unbounded. `max_requests`
 * (the API-call/politeness cap) is enforced independently of
 * `max_candidates` (the output-size cap) via fetchSearchPage's own check.
 */
export async function fetchAllPages(
  requestKind: AwardRequestKind,
  window: TimePeriodWindow,
  limit: number,
  maxCandidatesForThisRequest: number,
  requestState: RequestState,
  options: HttpClientOptions,
): Promise<RawUsaspendingAward[]> {
  const results: RawUsaspendingAward[] = [];
  let page = 1;
  const delayMs = options.requestDelayMs ?? 1000;

  for (;;) {
    if (page > 1 && delayMs > 0) {
      await sleep(delayMs);
    }

    const pageResults = await fetchSearchPage(requestKind, window, page, limit, requestState, options);
    results.push(...pageResults);

    if (pageResults.length < limit) break;
    if (results.length >= maxCandidatesForThisRequest) break;
    page += 1;
  }

  return results;
}

export interface PlannedFetchResult {
  /** Raw awards fetched per request kind, present only for kinds actually attempted. */
  fetchedByKind: Partial<Record<AwardRequestKind, RawUsaspendingAward[]>>;
  /**
   * Request kinds never attempted because the max_requests budget was
   * already exhausted before their turn -- reported distinctly so a small
   * smoke-test cap produces a partial-but-successful report instead of an
   * exception.
   */
  skippedDueToRequestCap: AwardRequestKind[];
}

/**
 * Plans and fetches each of `requestKinds` (default: ALL_REQUEST_KINDS, in
 * fixed contracts -> grants -> other_financial_assistance -> direct_payments
 * order), treating `options.maxRequests` as a hard upper bound on total
 * live HTTP requests across ALL kinds combined (not per kind).
 *
 * Before starting a given kind's fetch, checks whether the budget is
 * already exhausted; if so, that kind (and every kind after it) is
 * recorded in `skippedDueToRequestCap` and never fetched at all -- this
 * lets `--max-requests=2` finish cleanly with a partial report (e.g.
 * contracts + grants only) instead of throwing after two successful
 * requests. If a kind's own pagination unexpectedly needs more requests
 * than remain in the budget mid-fetch, `fetchAllPages`/`fetchSearchPage`'s
 * existing `RequestCapExceededError` still throws -- that failure mode is
 * intentionally preserved as a defensive fallback for the case pagination
 * exceeds what was planned for.
 */
export async function fetchAllPlannedRequestKinds(
  window: TimePeriodWindow,
  pageLimit: number,
  maxCandidatesPerKind: number,
  requestState: RequestState,
  options: HttpClientOptions,
  requestKinds: readonly AwardRequestKind[] = ALL_REQUEST_KINDS,
): Promise<PlannedFetchResult> {
  const fetchedByKind: Partial<Record<AwardRequestKind, RawUsaspendingAward[]>> = {};
  const skippedDueToRequestCap: AwardRequestKind[] = [];

  for (const kind of requestKinds) {
    if (requestState.requestsSent >= options.maxRequests) {
      skippedDueToRequestCap.push(kind);
      continue;
    }

    fetchedByKind[kind] = await fetchAllPages(kind, window, pageLimit, maxCandidatesPerKind, requestState, options);
  }

  return { fetchedByKind, skippedDueToRequestCap };
}
