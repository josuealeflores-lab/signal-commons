import {
  DigestLoopBoundsExceededError,
  ModelNotConfiguredError,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
} from "./run-digest";

/**
 * Reviewer-facing error-message mapping for the queue-digest Server
 * Action (docs/DECISIONS.md D-097), kept in its own module rather than
 * actions.ts for the same reason copilot/error-messages.ts is separate:
 * a "use server" file may only export async functions, and this is a
 * plain synchronous mapping function.
 *
 * The not-configured message is a fixed, literal string: it never
 * interpolates err.message and never includes the literal
 * ANTHROPIC_API_KEY name. A genuine provider/network failure still maps
 * to the separate, existing, retryable provider-error message below.
 */
export function errorMessageFor(err: unknown): string {
  if (err instanceof ModelNotConfiguredError) return "AI features are not configured in this environment.";
  if (err instanceof ModelTimeoutError) return "Queue digest timed out. Try again.";
  if (err instanceof DigestLoopBoundsExceededError) return "Queue digest could not finish within its bounds. Try again.";
  if (err instanceof ModelProviderError) return "Queue digest failed (provider error). Try again.";
  if (err instanceof ModelResponseParseError) return "Queue digest returned an unexpected response. Try again.";
  return "Queue digest failed. Try again.";
}
