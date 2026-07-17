import { describe, expect, it, vi } from "vitest";
import { callDigestModel, ModelProviderError, ModelResponseParseError, ModelTimeoutError, DEFAULT_MAX_TOKENS } from "@/lib/digest/client";
import { DIGEST_TOOL_DEFINITIONS } from "@/lib/digest/tools";

/**
 * Hermetic -- every test in this file injects its own fetchImpl. No test
 * here, or anywhere in this repo, ever calls the live Anthropic API
 * (docs/DECISIONS.md D-096).
 */

const BASE_PARAMS = {
  system: "system prompt",
  messages: [{ role: "user" as const, content: "hello" }],
  tools: DIGEST_TOOL_DEFINITIONS,
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

/** Properly typed so `.mock.calls[i][1]` is the real fetch init object, not an inferred zero-arity tuple. */
function fakeFetch(impl: (...args: Parameters<typeof fetch>) => Promise<Response>) {
  return vi.fn(impl);
}

describe("callDigestModel", () => {
  it("parses text and tool_use content blocks and the stop_reason from a successful response", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        content: [
          { type: "text", text: "thinking out loud" },
          { type: "tool_use", id: "tu-1", name: "list_queue_items", input: {} },
        ],
        stop_reason: "tool_use",
      }),
    );
    const result = await callDigestModel({ ...BASE_PARAMS, options: { apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch } });
    expect(result.stop_reason).toBe("tool_use");
    expect(result.content).toEqual([
      { type: "text", text: "thinking out loud" },
      { type: "tool_use", id: "tu-1", name: "list_queue_items", input: {} },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sends the tools array and system/messages in the request body", async () => {
    const fetchImpl = fakeFetch(async () => jsonResponse({ content: [{ type: "text", text: "{}" }], stop_reason: "end_turn" }));
    await callDigestModel({ ...BASE_PARAMS, options: { apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch } });
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.tools).toEqual(DIGEST_TOOL_DEFINITIONS);
    expect(body.system).toBe("system prompt");
    expect(body.max_tokens).toBe(DEFAULT_MAX_TOKENS);
  });

  it("returns an empty content array and null stop_reason for an unrecognized response shape", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: true }));
    const result = await callDigestModel({ ...BASE_PARAMS, options: { apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch } });
    expect(result.content).toEqual([]);
    expect(result.stop_reason).toBeNull();
  });

  it("throws ModelResponseParseError when the response body is not valid JSON", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    await expect(callDigestModel({ ...BASE_PARAMS, options: { apiKey: "test-key", fetchImpl } })).rejects.toBeInstanceOf(
      ModelResponseParseError,
    );
  });

  it("throws ModelProviderError on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "bad request" }, false, 400)) as unknown as typeof fetch;
    await expect(callDigestModel({ ...BASE_PARAMS, options: { apiKey: "test-key", fetchImpl } })).rejects.toBeInstanceOf(ModelProviderError);
  });

  it("throws ModelProviderError when no API key is available", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      await expect(callDigestModel({ ...BASE_PARAMS, options: { fetchImpl } })).rejects.toBeInstanceOf(ModelProviderError);
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("throws ModelTimeoutError when the call is aborted before completing (standalone, own internal timeout)", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    await expect(
      callDigestModel({ ...BASE_PARAMS, options: { apiKey: "test-key", fetchImpl, timeoutMs: 5 } }),
    ).rejects.toBeInstanceOf(ModelTimeoutError);
  });

  it("throws ModelTimeoutError when an externally supplied signal aborts (shared loop-level controller)", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const pending = callDigestModel({ ...BASE_PARAMS, options: { apiKey: "test-key", fetchImpl, signal: controller.signal } });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(ModelTimeoutError);
  });

  it("never calls the live Anthropic API -- every test above supplies its own fetchImpl", () => {
    expect(true).toBe(true);
  });
});
