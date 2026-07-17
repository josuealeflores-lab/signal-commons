"use server";

import {
  runDigestAndSummarize,
  DigestLoopBoundsExceededError,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
} from "./run-digest";
import type { DigestOutput } from "./schema";

/**
 * Thin "use server" wrapper over run-digest.ts's injectable core, mirroring
 * copilot/actions.ts's separation from run-analysis.ts. Manual-trigger
 * only: this Server Action is only ever invoked by an explicit reviewer
 * button click, never automatically on page load. Ephemeral by design
 * (docs/DECISIONS.md D-096 §7) -- no DB write of any kind occurs here;
 * the digest is returned directly to the caller for in-memory display via
 * useActionState, and is never persisted, so there is nothing to
 * revalidate or redirect to.
 */

export interface DigestActionState {
  digest: DigestOutput | null;
  error: string | null;
}

function errorMessageFor(err: unknown): string {
  if (err instanceof ModelTimeoutError) return "Queue digest timed out. Try again.";
  if (err instanceof DigestLoopBoundsExceededError) return "Queue digest could not finish within its bounds. Try again.";
  if (err instanceof ModelProviderError) return "Queue digest failed (provider error). Try again.";
  if (err instanceof ModelResponseParseError) return "Queue digest returned an unexpected response. Try again.";
  return "Queue digest failed. Try again.";
}

export async function generateQueueDigest(_prevState: DigestActionState): Promise<DigestActionState> {
  try {
    const digest = await runDigestAndSummarize();
    return { digest, error: null };
  } catch (err) {
    return { digest: null, error: errorMessageFor(err) };
  }
}
