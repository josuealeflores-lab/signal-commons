import { describe, expect, it, vi } from "vitest";
import {
  runAnalysisAndRecord,
  UnsupportedResearchItemError,
  ModelTimeoutError,
  ModelProviderError,
  ModelResponseParseError,
} from "@/lib/copilot/run-analysis";
import { DEFAULT_MODEL_NAME, callModel } from "@/lib/copilot/client";
import type { CopilotPromptContext } from "@/lib/copilot/context";

/** Properly typed so `.mock.calls[i][1]` is the real ModelCallOptions parameter, not an inferred zero-arity tuple. */
function fakeModelClient(impl: (...args: Parameters<typeof callModel>) => Promise<string>) {
  return vi.fn(impl);
}

/**
 * Hermetic -- every dependency (context read, model client, Supabase
 * client) is injected. No live model call, no DB write, no
 * submit_review_action call anywhere in this file (docs/DECISIONS.md
 * D-095).
 */

const CONTEXT: CopilotPromptContext = {
  researchItemId: "ri-1",
  signal: {
    headline: "H",
    summary: "S",
    why_it_matters: "W",
    evidence_strength: "high",
    verification_status: "unverified",
  },
  company: { name: "Co", publication_status: "draft", is_demo: false },
  sources: [],
  evidence: [],
};

const VALID_MODEL_JSON = JSON.stringify({
  summary: "Summary",
  riskFlags: [],
  missingEvidenceQuestions: [],
  suggestedNextStep: "unclear",
  confidence: "low",
  limitations: "None.",
});

function fakeClient(rpcImpl: (name: string, args: unknown) => Promise<{ data: unknown; error: unknown }>) {
  return { rpc: vi.fn(rpcImpl) };
}

describe("runAnalysisAndRecord", () => {
  it("records only validated output via record_copilot_analysis, and never any other RPC", async () => {
    const client = fakeClient(async () => ({ data: { id: "ca-1" }, error: null }));
    const result = await runAnalysisAndRecord("ri-1", {
      getContext: async () => CONTEXT,
      callModelImpl: async () => VALID_MODEL_JSON,
      getClient: async () => client as never,
    });
    expect(result).toBe("Copilot analysis generated.");
    expect(client.rpc).toHaveBeenCalledTimes(1);
    const [calledName, calledArgs] = client.rpc.mock.calls[0];
    expect(calledName).toBe("record_copilot_analysis");
    expect(calledName).not.toBe("submit_review_action");
    expect(calledArgs).toMatchObject({
      p_research_item_id: "ri-1",
      p_suggested_next_step: "unclear",
      p_confidence: "low",
    });
  });

  it("throws UnsupportedResearchItemError when the context read returns undefined, and never calls the RPC", async () => {
    const client = fakeClient(async () => ({ data: null, error: null }));
    await expect(
      runAnalysisAndRecord("ri-missing", {
        getContext: async () => undefined,
        callModelImpl: async () => VALID_MODEL_JSON,
        getClient: async () => client as never,
      }),
    ).rejects.toBeInstanceOf(UnsupportedResearchItemError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("throws ModelResponseParseError on non-JSON model output and never calls the RPC", async () => {
    const client = fakeClient(async () => ({ data: null, error: null }));
    await expect(
      runAnalysisAndRecord("ri-1", {
        getContext: async () => CONTEXT,
        callModelImpl: async () => "not json",
        getClient: async () => client as never,
      }),
    ).rejects.toBeInstanceOf(ModelResponseParseError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("throws ModelResponseParseError on schema-invalid model output and never calls the RPC", async () => {
    const client = fakeClient(async () => ({ data: null, error: null }));
    await expect(
      runAnalysisAndRecord("ri-1", {
        getContext: async () => CONTEXT,
        callModelImpl: async () => JSON.stringify({ summary: "only summary" }),
        getClient: async () => client as never,
      }),
    ).rejects.toBeInstanceOf(ModelResponseParseError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("rejects a model-supplied action verb masquerading as suggestedNextStep, and never calls the RPC", async () => {
    const client = fakeClient(async () => ({ data: null, error: null }));
    await expect(
      runAnalysisAndRecord("ri-1", {
        getContext: async () => CONTEXT,
        callModelImpl: async () =>
          JSON.stringify({
            summary: "Summary",
            riskFlags: [],
            missingEvidenceQuestions: [],
            suggestedNextStep: "approve",
            confidence: "low",
            limitations: null,
          }),
        getClient: async () => client as never,
      }),
    ).rejects.toBeInstanceOf(ModelResponseParseError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("propagates a model timeout cleanly, without calling the RPC", async () => {
    const client = fakeClient(async () => ({ data: null, error: null }));
    await expect(
      runAnalysisAndRecord("ri-1", {
        getContext: async () => CONTEXT,
        callModelImpl: async () => {
          throw new ModelTimeoutError();
        },
        getClient: async () => client as never,
      }),
    ).rejects.toBeInstanceOf(ModelTimeoutError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("propagates a provider error cleanly, without calling the RPC", async () => {
    const client = fakeClient(async () => ({ data: null, error: null }));
    await expect(
      runAnalysisAndRecord("ri-1", {
        getContext: async () => CONTEXT,
        callModelImpl: async () => {
          throw new ModelProviderError("boom");
        },
        getClient: async () => client as never,
      }),
    ).rejects.toBeInstanceOf(ModelProviderError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("passes a fresh, valid UUID as p_idempotency_key on every call, never reusing one across separate calls (M11 Phase B, docs/DECISIONS.md D-100)", async () => {
    const client = fakeClient(async () => ({ data: { id: "ca-1" }, error: null }));
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    await runAnalysisAndRecord("ri-1", {
      getContext: async () => CONTEXT,
      callModelImpl: async () => VALID_MODEL_JSON,
      getClient: async () => client as never,
    });
    await runAnalysisAndRecord("ri-1", {
      getContext: async () => CONTEXT,
      callModelImpl: async () => VALID_MODEL_JSON,
      getClient: async () => client as never,
    });

    expect(client.rpc).toHaveBeenCalledTimes(2);
    const firstArgs = client.rpc.mock.calls[0][1] as { p_idempotency_key: string };
    const secondArgs = client.rpc.mock.calls[1][1] as { p_idempotency_key: string };
    expect(firstArgs.p_idempotency_key).toMatch(UUID_PATTERN);
    expect(secondArgs.p_idempotency_key).toMatch(UUID_PATTERN);
    expect(firstArgs.p_idempotency_key).not.toBe(secondArgs.p_idempotency_key);
  });

  it("propagates an RPC-level error and does not swallow it", async () => {
    const client = fakeClient(async () => ({ data: null, error: new Error("rpc failed") }));
    await expect(
      runAnalysisAndRecord("ri-1", {
        getContext: async () => CONTEXT,
        callModelImpl: async () => VALID_MODEL_JSON,
        getClient: async () => client as never,
      }),
    ).rejects.toThrow("rpc failed");
  });

  describe("model provenance (Cowork/Fable fix)", () => {
    it("records DEFAULT_MODEL_NAME and passes it to the model client when no override is set", async () => {
      const originalEnv = process.env.COPILOT_MODEL_NAME;
      delete process.env.COPILOT_MODEL_NAME;
      try {
        const client = fakeClient(async () => ({ data: { id: "ca-1" }, error: null }));
        const callModelImpl = fakeModelClient(async () => VALID_MODEL_JSON);
        await runAnalysisAndRecord("ri-1", {
          getContext: async () => CONTEXT,
          callModelImpl,
          getClient: async () => client as never,
        });

        const [, calledOptions] = callModelImpl.mock.calls[0];
        const [, calledRpcArgs] = client.rpc.mock.calls[0];
        expect(calledOptions).toMatchObject({ model: DEFAULT_MODEL_NAME });
        expect(calledRpcArgs).toMatchObject({ p_model: DEFAULT_MODEL_NAME });
        // The two must be the identical resolved value, not independently coincidental.
        expect((calledRpcArgs as { p_model: string }).p_model).toBe(calledOptions?.model);
      } finally {
        if (originalEnv !== undefined) process.env.COPILOT_MODEL_NAME = originalEnv;
      }
    });

    it("passes an injected model override to both the model client and record_copilot_analysis's p_model", async () => {
      const client = fakeClient(async () => ({ data: { id: "ca-1" }, error: null }));
      const callModelImpl = fakeModelClient(async () => VALID_MODEL_JSON);
      await runAnalysisAndRecord("ri-1", {
        getContext: async () => CONTEXT,
        callModelImpl,
        getClient: async () => client as never,
        model: "claude-injected-override",
      });

      const [, calledOptions] = callModelImpl.mock.calls[0];
      const [, calledRpcArgs] = client.rpc.mock.calls[0];
      expect(calledOptions).toMatchObject({ model: "claude-injected-override" });
      expect(calledRpcArgs).toMatchObject({ p_model: "claude-injected-override" });
    });

    it("resolves COPILOT_MODEL_NAME from the environment and records that same value, restoring the env var afterward", async () => {
      const originalEnv = process.env.COPILOT_MODEL_NAME;
      process.env.COPILOT_MODEL_NAME = "claude-env-override";
      try {
        const client = fakeClient(async () => ({ data: { id: "ca-1" }, error: null }));
        const callModelImpl = fakeModelClient(async () => VALID_MODEL_JSON);
        await runAnalysisAndRecord("ri-1", {
          getContext: async () => CONTEXT,
          callModelImpl,
          getClient: async () => client as never,
        });

        const [, calledOptions] = callModelImpl.mock.calls[0];
        const [, calledRpcArgs] = client.rpc.mock.calls[0];
        expect(calledOptions).toMatchObject({ model: "claude-env-override" });
        expect(calledRpcArgs).toMatchObject({ p_model: "claude-env-override" });
      } finally {
        if (originalEnv === undefined) delete process.env.COPILOT_MODEL_NAME;
        else process.env.COPILOT_MODEL_NAME = originalEnv;
      }
      // Restoration happened in the finally block above, not asserted here as
      // a separate test -- a follow-up test asserting global env state would
      // be order-dependent on Vitest's execution order rather than a real
      // guarantee; the try/finally itself is the actual cleanup mechanism.
    });
  });
});
