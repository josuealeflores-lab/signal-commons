import { describe, expect, it, vi } from "vitest";
import {
  fetchSearchPage,
  fetchAllPages,
  fetchAllPlannedRequestKinds,
  RequestCapExceededError,
  UsaspendingRequestError,
  type RequestState,
} from "@/lib/connectors/usaspending/http-client";

/**
 * Hermetic (no live API) -- every test injects a mock `fetchImpl`, never
 * the global `fetch`. Exercises max_requests (API-call cap, separate from
 * max_candidates the output-size cap) and stop-on-first-failure: HTTP
 * non-2xx, network error, malformed JSON, and an unexpected response
 * shape all halt immediately with no retry. Also covers
 * fetchAllPlannedRequestKinds's partial-run behavior: once max_requests is
 * exhausted, remaining planned request kinds are skipped (not fetched)
 * rather than throwing.
 */

const WINDOW = { startDate: "2026-01-01", endDate: "2026-03-31" };

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("fetchSearchPage", () => {
  it("returns results from a successful response and increments requestsSent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: [{ generated_internal_id: "abc" }] }));
    const requestState: RequestState = { requestsSent: 0 };

    const results = await fetchSearchPage("contracts", WINDOW, 1, 100, requestState, {
      fetchImpl,
      maxRequests: 5,
    });

    expect(results).toEqual([{ generated_internal_id: "abc" }]);
    expect(requestState.requestsSent).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws RequestCapExceededError before issuing a request once max_requests is reached", async () => {
    const fetchImpl = vi.fn();
    const requestState: RequestState = { requestsSent: 3 };

    await expect(
      fetchSearchPage("contracts", WINDOW, 1, 100, requestState, { fetchImpl, maxRequests: 3 }),
    ).rejects.toBeInstanceOf(RequestCapExceededError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("stops on first failure: HTTP non-2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 500));
    const requestState: RequestState = { requestsSent: 0 };

    await expect(
      fetchSearchPage("contracts", WINDOW, 1, 100, requestState, { fetchImpl, maxRequests: 5 }),
    ).rejects.toThrow(UsaspendingRequestError);
  });

  it("captures the response body as `cause` on HTTP non-2xx, for diagnostics", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ detail: "'fields' must only contain valid field names." }, false, 422));
    const requestState: RequestState = { requestsSent: 0 };

    try {
      await fetchSearchPage("contracts", WINDOW, 1, 100, requestState, { fetchImpl, maxRequests: 5 });
      expect.unreachable("expected fetchSearchPage to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(UsaspendingRequestError);
      expect((err as UsaspendingRequestError).cause).toContain("must only contain valid field names");
    }
  });

  it("stops on first failure: network error/timeout", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network timeout"));
    const requestState: RequestState = { requestsSent: 0 };

    await expect(
      fetchSearchPage("contracts", WINDOW, 1, 100, requestState, { fetchImpl, maxRequests: 5 }),
    ).rejects.toThrow(UsaspendingRequestError);
  });

  it("stops on first failure: malformed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("Unexpected token");
      },
    } as unknown as Response);
    const requestState: RequestState = { requestsSent: 0 };

    await expect(
      fetchSearchPage("contracts", WINDOW, 1, 100, requestState, { fetchImpl, maxRequests: 5 }),
    ).rejects.toThrow(UsaspendingRequestError);
  });

  it("stops on first failure: unexpected response shape (no results array)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ notResults: [] }));
    const requestState: RequestState = { requestsSent: 0 };

    await expect(
      fetchSearchPage("contracts", WINDOW, 1, 100, requestState, { fetchImpl, maxRequests: 5 }),
    ).rejects.toThrow(UsaspendingRequestError);
  });
});

describe("fetchAllPages", () => {
  it("stops paginating once a page returns fewer results than the limit (last page)", async () => {
    // limit=3 but only 2 results returned -- fewer than the limit signals
    // "last page," so a second request must never be issued.
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ results: Array.from({ length: 2 }, (_, i) => ({ generated_internal_id: `p1-${i}` })) }),
      );
    const requestState: RequestState = { requestsSent: 0 };

    const results = await fetchAllPages("contracts", WINDOW, 3, 100, requestState, {
      fetchImpl,
      maxRequests: 10,
      requestDelayMs: 0,
    });

    expect(results).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("stops once max_candidates for this request kind is reached, independent of max_requests", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ results: Array.from({ length: 5 }, (_, i) => ({ generated_internal_id: `p1-${i}` })) }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ results: Array.from({ length: 5 }, (_, i) => ({ generated_internal_id: `p2-${i}` })) }),
      );
    const requestState: RequestState = { requestsSent: 0 };

    // limit=5 per page (so a full page never signals "last page"), cap output at 6 candidates.
    const results = await fetchAllPages("contracts", WINDOW, 5, 6, requestState, {
      fetchImpl,
      maxRequests: 100,
      requestDelayMs: 0,
    });

    expect(results.length).toBeGreaterThanOrEqual(6);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("throws RequestCapExceededError if pagination would exceed max_requests before max_candidates is reached", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ results: Array.from({ length: 10 }, (_, i) => ({ generated_internal_id: `p-${i}` })) }),
    );
    const requestState: RequestState = { requestsSent: 0 };

    await expect(
      fetchAllPages("contracts", WINDOW, 10, 1000, requestState, {
        fetchImpl,
        maxRequests: 2,
        requestDelayMs: 0,
      }),
    ).rejects.toBeInstanceOf(RequestCapExceededError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe("fetchAllPlannedRequestKinds", () => {
  // Each mocked call returns 1 result (< limit), so every planned kind
  // consumes exactly one request -- makes the cap arithmetic exact/testable.
  function singleResultFetchImpl() {
    return vi.fn().mockImplementation(async () => jsonResponse({ results: [{ generated_internal_id: "x" }] }));
  }

  it("with max_requests=2, runs only the first two planned kinds (contracts, grants) and reports the rest as skipped_due_to_request_cap", async () => {
    const fetchImpl = singleResultFetchImpl();
    const requestState: RequestState = { requestsSent: 0 };

    const { fetchedByKind, skippedDueToRequestCap } = await fetchAllPlannedRequestKinds(
      WINDOW,
      100,
      10,
      requestState,
      { fetchImpl, maxRequests: 2, requestDelayMs: 0 },
    );

    expect(Object.keys(fetchedByKind)).toEqual(["contracts", "grants"]);
    expect(skippedDueToRequestCap).toEqual(["other_financial_assistance", "direct_payments"]);
    expect(requestState.requestsSent).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("with max_requests=4, plans and runs all four non-loan groups with none skipped", async () => {
    const fetchImpl = singleResultFetchImpl();
    const requestState: RequestState = { requestsSent: 0 };

    const { fetchedByKind, skippedDueToRequestCap } = await fetchAllPlannedRequestKinds(
      WINDOW,
      100,
      10,
      requestState,
      { fetchImpl, maxRequests: 4, requestDelayMs: 0 },
    );

    expect(Object.keys(fetchedByKind)).toEqual(["contracts", "grants", "other_financial_assistance", "direct_payments"]);
    expect(skippedDueToRequestCap).toEqual([]);
    expect(requestState.requestsSent).toBe(4);
  });

  it("with max_requests=1, runs only contracts and skips the other three", async () => {
    const fetchImpl = singleResultFetchImpl();
    const requestState: RequestState = { requestsSent: 0 };

    const { fetchedByKind, skippedDueToRequestCap } = await fetchAllPlannedRequestKinds(
      WINDOW,
      100,
      10,
      requestState,
      { fetchImpl, maxRequests: 1, requestDelayMs: 0 },
    );

    expect(Object.keys(fetchedByKind)).toEqual(["contracts"]);
    expect(skippedDueToRequestCap).toEqual(["grants", "other_financial_assistance", "direct_payments"]);
  });

  it("never throws when the cap is reached between planned kinds -- only mid-kind overruns still throw defensively", async () => {
    const fetchImpl = singleResultFetchImpl();
    const requestState: RequestState = { requestsSent: 0 };

    await expect(
      fetchAllPlannedRequestKinds(WINDOW, 100, 10, requestState, { fetchImpl, maxRequests: 2, requestDelayMs: 0 }),
    ).resolves.toBeDefined();
  });

  it("a kind whose own pagination unexpectedly needs more requests than remain in the budget still throws RequestCapExceededError (defensive fallback)", async () => {
    // Every page returns a full page (10 results, limit=10) -- pagination
    // never naturally stops, so contracts alone would need more requests
    // than the tiny max_requests budget allows.
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ results: Array.from({ length: 10 }, (_, i) => ({ generated_internal_id: `p-${i}` })) }));
    const requestState: RequestState = { requestsSent: 0 };

    await expect(
      fetchAllPlannedRequestKinds(WINDOW, 10, 1000, requestState, { fetchImpl, maxRequests: 2, requestDelayMs: 0 }),
    ).rejects.toBeInstanceOf(RequestCapExceededError);
  });
});

describe("diagnosticKeyword propagation (DIAGNOSTIC ONLY)", () => {
  it("fetchSearchPage never includes filters.description in the sent request body when diagnosticKeyword is omitted", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const requestState: RequestState = { requestsSent: 0 };

    await fetchSearchPage("contracts", WINDOW, 1, 100, requestState, { fetchImpl, maxRequests: 5 });

    const sentBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sentBody.filters).not.toHaveProperty("description");
  });

  it("fetchSearchPage includes filters.description in the sent request body when diagnosticKeyword is set on options", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const requestState: RequestState = { requestsSent: 0 };

    await fetchSearchPage("contracts", WINDOW, 1, 100, requestState, {
      fetchImpl,
      maxRequests: 5,
      diagnosticKeyword: "artificial intelligence",
    });

    const sentBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(sentBody.filters.description).toBe("artificial intelligence");
  });

  it("fetchAllPlannedRequestKinds propagates diagnosticKeyword to every kind's request", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: [] }));
    const requestState: RequestState = { requestsSent: 0 };

    await fetchAllPlannedRequestKinds(WINDOW, 100, 10, requestState, {
      fetchImpl,
      maxRequests: 4,
      requestDelayMs: 0,
      diagnosticKeyword: "machine learning",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    for (const call of fetchImpl.mock.calls) {
      const sentBody = JSON.parse(call[1].body);
      expect(sentBody.filters.description).toBe("machine learning");
    }
  });
});
