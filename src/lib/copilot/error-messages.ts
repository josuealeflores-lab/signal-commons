import {
  ModelNotConfiguredError,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
  UnsupportedResearchItemError,
} from "./run-analysis";

/**
 * Reviewer-facing error-message mapping for the Copilot Server Action
 * (docs/DECISIONS.md D-097), kept in its own module rather than
 * actions.ts -- a "use server" file may only export async functions, and
 * this is a plain synchronous mapping function, so it lives here instead
 * (mirrors src/lib/review/action-messages.ts's existing separation).
 *
 * The not-configured message is a fixed, literal string: it never
 * interpolates err.message and never includes the literal
 * ANTHROPIC_API_KEY name, so a missing-key condition cannot leak any
 * internal detail to a reviewer. A genuine provider/network failure still
 * maps to the separate, existing, retryable provider-error message below
 * -- the two failure modes stay distinguishable both in code and in what
 * the reviewer sees.
 *
 * M11 Phase B (docs/DECISIONS.md D-100): record_copilot_analysis's new
 * idempotency/rate-limit guard clauses raise one of five custom SC00x
 * SQLSTATE codes (never the predefined PL/pgSQL P0001-P0004 class -- see
 * the migration's own header comment). The thrown rpcError from
 * run-analysis.ts is a PostgrestError-shaped object with a `code` field,
 * not one of the typed classes above, so it's checked separately, after
 * all the `instanceof` checks. Every other submit_review_action-unrelated
 * error keeps falling through to the generic message below, unchanged.
 */
const SC00X_MESSAGES: Record<string, string> = {
  SC001: "This action may have already been submitted. Please refresh the page and try again.",
  SC002: "This action could not be completed. Please refresh the page and try again.",
  SC003: "This action could not be completed. Please refresh the page and try again.",
  SC004: "You're submitting too quickly. Please wait a moment and try again.",
  SC005: "This action is still being processed. Please wait a moment and try again.",
};

function sc00xMessageFor(err: unknown): string | null {
  if (typeof err !== "object" || err === null || !("code" in err)) return null;
  const code = (err as { code: unknown }).code;
  return typeof code === "string" && code in SC00X_MESSAGES ? SC00X_MESSAGES[code] : null;
}

export function errorMessageFor(err: unknown): string {
  if (err instanceof ModelNotConfiguredError) return "AI features are not configured in this environment.";
  if (err instanceof ModelTimeoutError) return "Copilot analysis timed out. Try again.";
  if (err instanceof ModelProviderError) return "Copilot analysis failed (provider error). Try again.";
  if (err instanceof UnsupportedResearchItemError) return "Copilot analysis is not available for this item.";
  if (err instanceof ModelResponseParseError) return "Copilot analysis returned an unexpected response. Try again.";
  const sc00xMessage = sc00xMessageFor(err);
  if (sc00xMessage) return sc00xMessage;
  return "Copilot analysis failed. Try again.";
}
