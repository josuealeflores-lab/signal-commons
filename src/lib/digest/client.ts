import { resolveModelName } from "@/lib/copilot/client";
import type { DigestToolDefinition } from "./tools";

/**
 * Thin, injectable, server-only wrapper over a single non-streaming
 * Anthropic Messages API call carrying `tools` plus the running message
 * history (docs/DECISIONS.md D-096 §3). run-digest.ts owns the bounded
 * loop itself; this module only shapes one request/response.
 *
 * Verified against this environment's bundled claude-api skill docs
 * (typescript/claude-api/tool-use.md's "Manual Agentic Loop" section,
 * current as of this implementation) for the manual-loop request/response
 * shape: tool definitions ({name, description, input_schema}),
 * tool_use/tool_result content blocks, and stop_reason handling (end_turn
 * / tool_use / pause_turn). This shape must be re-verified against
 * current official Anthropic documentation before this module is ever
 * pointed at a live key in production -- no test in this repo exercises
 * the real provider (every test injects its own fetchImpl).
 *
 * Deliberately NOT the @anthropic-ai/sdk dependency, for the same reason
 * copilot/client.ts gives (a hand-rolled wrapper mirroring the connector
 * stack's http-client.ts, unless SDK usage is separately justified later).
 * Deliberately NOT server-only-guarded, for the same structural-isolation
 * reason copilot/client.ts documents -- only run-digest.ts imports this
 * module, which in turn is only ever invoked from actions.ts's "use
 * server" Server Action.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

export const DEFAULT_MAX_TOKENS = 1024;
export const DEFAULT_TIMEOUT_MS = 20000;

export class ModelTimeoutError extends Error {
  constructor() {
    super("Queue digest model call timed out");
    this.name = "ModelTimeoutError";
  }
}

export class ModelProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ModelProviderError";
    this.status = status;
  }
}

export class ModelResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelResponseParseError";
  }
}

export type DigestContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface DigestMessage {
  role: "user" | "assistant";
  content: string | DigestContentBlock[];
}

export interface DigestModelResponse {
  content: DigestContentBlock[];
  stop_reason: string | null;
}

export interface DigestModelCallOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** Per-call fallback timeout, only used when no external `signal` is supplied (e.g. this module tested standalone). */
  timeoutMs?: number;
  /** Shared AbortSignal for an entire bounded loop -- run-digest.ts creates one controller for the whole run, not one per call. */
  signal?: AbortSignal;
  model?: string;
  maxTokens?: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseContentBlocks(json: unknown): DigestContentBlock[] {
  if (!isPlainRecord(json) || !Array.isArray(json.content)) return [];
  const blocks: DigestContentBlock[] = [];
  for (const block of json.content) {
    if (!isPlainRecord(block) || typeof block.type !== "string") continue;
    if (block.type === "text" && typeof block.text === "string") {
      blocks.push({ type: "text", text: block.text });
    } else if (block.type === "tool_use" && typeof block.id === "string" && typeof block.name === "string") {
      blocks.push({ type: "tool_use", id: block.id, name: block.name, input: block.input });
    }
  }
  return blocks;
}

export async function callDigestModel(params: {
  system: string;
  messages: DigestMessage[];
  tools: DigestToolDefinition[];
  options?: DigestModelCallOptions;
}): Promise<DigestModelResponse> {
  const { system, messages, tools, options = {} } = params;

  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ModelProviderError("Missing ANTHROPIC_API_KEY");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const model = resolveModelName(options.model);
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  let ownController: AbortController | undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let signal = options.signal;
  if (!signal) {
    ownController = new AbortController();
    timeoutHandle = setTimeout(() => ownController!.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    signal = ownController.signal;
  }

  let response: Response;
  try {
    response = await fetchImpl(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        tools,
        messages,
      }),
      signal,
    });
  } catch {
    if (signal.aborted) {
      throw new ModelTimeoutError();
    }
    throw new ModelProviderError("Queue digest model request failed (network error)");
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    throw new ModelProviderError(`Queue digest model request failed with HTTP ${response.status}`, response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ModelResponseParseError("Queue digest model response was not valid JSON");
  }

  if (!isPlainRecord(json)) {
    throw new ModelResponseParseError("Queue digest model response had an unexpected shape");
  }

  const content = parseContentBlocks(json);
  const stopReason = typeof json.stop_reason === "string" ? json.stop_reason : null;

  return { content, stop_reason: stopReason };
}
