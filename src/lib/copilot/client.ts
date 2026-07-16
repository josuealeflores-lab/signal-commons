import type { CopilotPrompt } from "./prompt";

/**
 * Thin, injectable, server-only wrapper over a single non-streaming
 * Anthropic Messages API call (docs/DECISIONS.md D-095).
 *
 * Deliberately NOT the @anthropic-ai/sdk dependency: a hand-rolled wrapper
 * mirroring the USAspending connector's own HTTP client module (the
 * injectable-fetchImpl pattern: typed errors, no silent retries) is
 * preferred unless SDK usage is separately justified at a later
 * implementation step. Exact model name, endpoint, and request/response
 * shape must be re-verified against current official Anthropic
 * documentation before this is ever pointed at a live key in production —
 * this module makes no live call itself and is never exercised against
 * the real provider by any test in this repo (every test injects its own
 * fetchImpl).
 *
 * Deliberately NOT guarded with `import "server-only"`: doing so would
 * throw under plain `npm test` (Vitest doesn't set the `react-server`
 * condition that guard relies on — docs/DECISIONS.md D-044), which would
 * make this module's own callModel behavior (success/malformed/timeout/
 * provider-error) impossible to test hermetically. The actual isolation
 * boundary is structural: this module is only ever imported by
 * run-analysis.ts, which in turn is only ever called from actions.ts's
 * "use server" Server Action — Next.js's own Server Action compilation is
 * what keeps this code (and any API key it reads) out of the client
 * bundle, independent of this guard. This mirrors the connector HTTP
 * client's own stated rationale for omitting the guard.
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
// Stable, unversioned-by-model API version header — unaffected by which
// model string is requested. Reconfirm against current official Anthropic
// docs before go-live, per this module's own header comment above.
const ANTHROPIC_API_VERSION = "2023-06-01";

/** Single named default, easy to update in one place; overridable via ModelCallOptions.model or the COPILOT_MODEL_NAME env var. */
export const DEFAULT_MODEL_NAME = "claude-opus-4-8";
export const DEFAULT_TIMEOUT_MS = 20000;
export const DEFAULT_MAX_TOKENS = 1024;

/**
 * The single, shared model-name resolution precedence (Cowork/Fable
 * provenance fix, docs/DECISIONS.md D-095): (1) an explicit override, (2)
 * the COPILOT_MODEL_NAME env var, (3) DEFAULT_MODEL_NAME. callModel below
 * and run-analysis.ts's runAnalysisAndRecord both call this SAME function
 * — the model actually used to generate an analysis and the model
 * recorded in copilot_analyses.model can never diverge, because there is
 * only one place this precedence is ever evaluated.
 */
export function resolveModelName(explicitModel?: string): string {
  return explicitModel ?? process.env.COPILOT_MODEL_NAME ?? DEFAULT_MODEL_NAME;
}

export class ModelTimeoutError extends Error {
  constructor() {
    super("Copilot model call timed out");
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

export interface ModelCallOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  model?: string;
  maxTokens?: number;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractFirstTextBlock(json: unknown): string | null {
  if (!isPlainRecord(json)) return null;
  const content = json.content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (isPlainRecord(block) && block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
  }
  return null;
}

/**
 * Makes exactly one non-streaming call and returns the model's raw text
 * response (expected to be a JSON string matching
 * schema.ts's copilotAnalysisOutputSchema — parsing/validation happens in
 * run-analysis.ts, not here). Throws a typed error for every failure mode
 * — never returns a partial or best-guess result.
 */
export async function callModel(prompt: CopilotPrompt, options: ModelCallOptions = {}): Promise<string> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ModelProviderError("Missing ANTHROPIC_API_KEY");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = resolveModelName(options.model);
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

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
        system: prompt.system,
        messages: [{ role: "user", content: prompt.user }],
      }),
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ModelTimeoutError();
    }
    throw new ModelProviderError("Copilot model request failed (network error)");
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    throw new ModelProviderError(`Copilot model request failed with HTTP ${response.status}`, response.status);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new ModelResponseParseError("Copilot model response was not valid JSON");
  }

  const text = extractFirstTextBlock(json);
  if (text === null) {
    throw new ModelResponseParseError("Copilot model response did not include a text content block");
  }

  return text;
}
