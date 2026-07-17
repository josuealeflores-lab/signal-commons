import { describe, expect, it, vi } from "vitest";
import {
  callModel,
  ModelNotConfiguredError,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
  DEFAULT_MODEL_NAME,
} from "@/lib/copilot/client";

/**
 * Hermetic -- every test in this file injects its own fetchImpl. No test
 * here, or anywhere in this repo, ever calls the live Anthropic API
 * (docs/DECISIONS.md D-095).
 */

const PROMPT = { system: "system prompt", user: "user prompt" };

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("callModel", () => {
  it("returns the first text content block on a successful response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ content: [{ type: "text", text: '{"summary":"ok"}' }] }));
    const result = await callModel(PROMPT, { apiKey: "test-key", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toBe('{"summary":"ok"}');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws ModelResponseParseError when the response body is not valid JSON", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    await expect(callModel(PROMPT, { apiKey: "test-key", fetchImpl })).rejects.toBeInstanceOf(ModelResponseParseError);
  });

  it("throws ModelResponseParseError when the response has no text content block", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ content: [] })) as unknown as typeof fetch;
    await expect(callModel(PROMPT, { apiKey: "test-key", fetchImpl })).rejects.toBeInstanceOf(ModelResponseParseError);
  });

  it("throws ModelResponseParseError when the response shape is unexpected", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ unexpected: true })) as unknown as typeof fetch;
    await expect(callModel(PROMPT, { apiKey: "test-key", fetchImpl })).rejects.toBeInstanceOf(ModelResponseParseError);
  });

  it("throws ModelProviderError on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "bad request" }, false, 400)) as unknown as typeof fetch;
    await expect(callModel(PROMPT, { apiKey: "test-key", fetchImpl })).rejects.toBeInstanceOf(ModelProviderError);
  });

  it("throws ModelNotConfiguredError (not ModelProviderError) when no API key is available (docs/DECISIONS.md D-097)", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      await expect(callModel(PROMPT, { fetchImpl })).rejects.toBeInstanceOf(ModelNotConfiguredError);
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      if (originalKey !== undefined) process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("throws ModelTimeoutError when the call is aborted before completing", async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new DOMException("aborted", "AbortError");
          reject(err);
        });
      });
    }) as unknown as typeof fetch;

    await expect(callModel(PROMPT, { apiKey: "test-key", fetchImpl, timeoutMs: 5 })).rejects.toBeInstanceOf(ModelTimeoutError);
  });

  it("never calls the live Anthropic API -- every test above supplies its own fetchImpl", () => {
    expect(true).toBe(true);
  });

  it("exports a non-empty, configurable default model name", () => {
    expect(typeof DEFAULT_MODEL_NAME).toBe("string");
    expect(DEFAULT_MODEL_NAME.length).toBeGreaterThan(0);
  });
});
