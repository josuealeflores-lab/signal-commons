"use server";

import { runDigestAndSummarize } from "./run-digest";
import { errorMessageFor } from "./error-messages";
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
 *
 * The error-message mapping itself lives in error-messages.ts, not here —
 * a "use server" file may only export async functions, and errorMessageFor
 * is a plain synchronous function (docs/DECISIONS.md D-097).
 */

export interface DigestActionState {
  digest: DigestOutput | null;
  error: string | null;
}

export async function generateQueueDigest(_prevState: DigestActionState): Promise<DigestActionState> {
  try {
    const digest = await runDigestAndSummarize();
    return { digest, error: null };
  } catch (err) {
    return { digest: null, error: errorMessageFor(err) };
  }
}
