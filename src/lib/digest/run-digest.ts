import { randomUUID } from "node:crypto";
import {
  DIGEST_TOOL_DEFINITIONS,
  LIST_QUEUE_ITEMS_TOOL,
  GET_ITEM_CONTEXT_TOOL,
  listQueueItems,
  getItemContext,
  type DigestQueueItemSummary,
  type DigestItemContextResult,
} from "./tools";
import { listQueueItemsArgsSchema, getItemContextArgsSchema, digestOutputSchema, type DigestOutput } from "./schema";
import { buildDigestSystemPrompt, buildInitialUserPrompt, renderQueueItemsToolResult, renderItemContextToolResult } from "./prompt";
import {
  callDigestModel,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
  type DigestMessage,
  type DigestContentBlock,
} from "./client";

export { ModelProviderError, ModelResponseParseError, ModelTimeoutError };

/**
 * Bounded tool-use loop for the M8A queue digest (docs/DECISIONS.md D-096
 * §1). These bounds are enforced in code, not merely described in the
 * prompt, and the loop fails closed -- never returns a partial digest --
 * if any bound is exceeded before a valid final digest is produced.
 */
export const MAX_MODEL_TURNS = 4;
export const MAX_TOTAL_TOOL_INVOCATIONS = 6;
export const MAX_GET_ITEM_CONTEXT_CALLS = 3;
export const LOOP_TIMEOUT_MS = 20000;

export class DigestLoopBoundsExceededError extends Error {
  constructor(reason: string) {
    super(`Queue digest loop exceeded its bounds: ${reason}`);
    this.name = "DigestLoopBoundsExceededError";
  }
}

export interface RunDigestDeps {
  listQueueItemsImpl?: typeof listQueueItems;
  getItemContextImpl?: typeof getItemContext;
  callModelImpl?: typeof callDigestModel;
  model?: string;
  /** Deterministic nonce override for tests; defaults to a fresh crypto.randomUUID() per run. */
  nonce?: string;
}

interface ToolDispatchResult {
  content: string;
  isError: boolean;
}

interface DispatchContext {
  listQueueItemsImpl: typeof listQueueItems;
  getItemContextImpl: typeof getItemContext;
  nonce: string;
}

async function dispatchTool(toolUse: { name: string; input: unknown }, ctx: DispatchContext): Promise<ToolDispatchResult> {
  if (toolUse.name === LIST_QUEUE_ITEMS_TOOL) {
    const parsedArgs = listQueueItemsArgsSchema.safeParse(toolUse.input ?? {});
    if (!parsedArgs.success) {
      return { content: "Invalid arguments for list_queue_items.", isError: true };
    }
    const items: DigestQueueItemSummary[] = await ctx.listQueueItemsImpl();
    return { content: renderQueueItemsToolResult(items, ctx.nonce), isError: false };
  }

  if (toolUse.name === GET_ITEM_CONTEXT_TOOL) {
    const parsedArgs = getItemContextArgsSchema.safeParse(toolUse.input);
    if (!parsedArgs.success) {
      return { content: "Invalid arguments for get_item_context.", isError: true };
    }
    const result: DigestItemContextResult = await ctx.getItemContextImpl(parsedArgs.data.researchItemId);
    return { content: renderItemContextToolResult(result, ctx.nonce), isError: !result.found };
  }

  return { content: `Unknown tool: ${toolUse.name}`, isError: true };
}

function extractTextBlock(content: DigestContentBlock[]): string | null {
  const block = content.find((b): b is { type: "text"; text: string } => b.type === "text");
  return block ? block.text : null;
}

function extractToolUseBlocks(content: DigestContentBlock[]) {
  return content.filter((b): b is { type: "tool_use"; id: string; name: string; input: unknown } => b.type === "tool_use");
}

/**
 * The bounded, read-only tool-use loop itself. No "use server" directive
 * here -- stays hermetically testable under plain `npm test`, mirroring
 * copilot/run-analysis.ts's separation from actions.ts. Never calls
 * submit_review_action or record_copilot_analysis -- every tool in
 * DIGEST_TOOL_DEFINITIONS is read-only by construction (tools.ts).
 * Produces no side effects and persists nothing: the returned
 * DigestOutput is the entire result, held only in the caller's memory
 * (docs/DECISIONS.md D-096 §7).
 */
export async function runDigestAndSummarize(deps: RunDigestDeps = {}): Promise<DigestOutput> {
  const listQueueItemsImpl = deps.listQueueItemsImpl ?? listQueueItems;
  const getItemContextImpl = deps.getItemContextImpl ?? getItemContext;
  const callModelImpl = deps.callModelImpl ?? callDigestModel;
  const nonce = deps.nonce ?? randomUUID();

  const system = buildDigestSystemPrompt(nonce);
  const messages: DigestMessage[] = [{ role: "user", content: buildInitialUserPrompt() }];

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), LOOP_TIMEOUT_MS);

  let totalToolInvocations = 0;
  let getItemContextCalls = 0;

  try {
    for (let turn = 1; turn <= MAX_MODEL_TURNS; turn++) {
      let response;
      try {
        response = await callModelImpl({
          system,
          messages,
          tools: DIGEST_TOOL_DEFINITIONS,
          options: { signal: controller.signal, model: deps.model },
        });
      } catch (err) {
        if (controller.signal.aborted) throw new ModelTimeoutError();
        throw err;
      }

      if (response.stop_reason === "end_turn") {
        const text = extractTextBlock(response.content);
        if (text === null) {
          throw new ModelResponseParseError("Queue digest model response had no text block");
        }
        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(text);
        } catch {
          throw new ModelResponseParseError("Queue digest model response was not valid JSON");
        }
        const parsed = digestOutputSchema.safeParse(parsedJson);
        if (!parsed.success) {
          throw new ModelResponseParseError("Queue digest model response did not match the expected schema");
        }
        return parsed.data;
      }

      if (response.stop_reason === "pause_turn") {
        // Server-side-tool continuation; M8A registers none, but handled
        // gracefully rather than treated as an error -- still bounded by
        // the surrounding for-loop's MAX_MODEL_TURNS either way.
        messages.push({ role: "assistant", content: response.content });
        continue;
      }

      const toolUseBlocks = extractToolUseBlocks(response.content);
      if (toolUseBlocks.length === 0) {
        throw new DigestLoopBoundsExceededError(
          `model stopped with stop_reason "${response.stop_reason ?? "unknown"}" and produced no usable output`,
        );
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResultBlocks: DigestContentBlock[] = [];
      for (const toolUse of toolUseBlocks) {
        totalToolInvocations += 1;
        if (totalToolInvocations > MAX_TOTAL_TOOL_INVOCATIONS) {
          throw new DigestLoopBoundsExceededError("max total tool invocations exceeded");
        }
        if (toolUse.name === GET_ITEM_CONTEXT_TOOL) {
          getItemContextCalls += 1;
          if (getItemContextCalls > MAX_GET_ITEM_CONTEXT_CALLS) {
            throw new DigestLoopBoundsExceededError("max get_item_context calls exceeded");
          }
        }

        const dispatchResult = await dispatchTool(toolUse, { listQueueItemsImpl, getItemContextImpl, nonce });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: dispatchResult.content,
          is_error: dispatchResult.isError,
        });
      }

      messages.push({ role: "user", content: toolResultBlocks });

      if (turn === MAX_MODEL_TURNS) {
        throw new DigestLoopBoundsExceededError("max model turns exceeded without a final digest");
      }
    }

    throw new DigestLoopBoundsExceededError("loop ended unexpectedly without a final digest");
  } finally {
    clearTimeout(timeoutHandle);
  }
}
