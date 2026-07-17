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
 */
export function errorMessageFor(err: unknown): string {
  if (err instanceof ModelNotConfiguredError) return "AI features are not configured in this environment.";
  if (err instanceof ModelTimeoutError) return "Copilot analysis timed out. Try again.";
  if (err instanceof ModelProviderError) return "Copilot analysis failed (provider error). Try again.";
  if (err instanceof UnsupportedResearchItemError) return "Copilot analysis is not available for this item.";
  if (err instanceof ModelResponseParseError) return "Copilot analysis returned an unexpected response. Try again.";
  return "Copilot analysis failed. Try again.";
}
