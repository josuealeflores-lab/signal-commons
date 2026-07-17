"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { runAnalysisAndRecord } from "./run-analysis";
import { errorMessageFor } from "./error-messages";

/**
 * Thin "use server" wrapper over run-analysis.ts's injectable core — same
 * separation-of-concerns pattern as src/lib/review/actions.ts over
 * queue.ts. Uses the session client throughout (via run-analysis.ts),
 * never service-role. Reviewer-triggered only: this Server Action is only
 * ever invoked by an explicit form submission on the research-item detail
 * page, never automatically. Never calls submit_review_action.
 *
 * The error-message mapping itself lives in error-messages.ts, not here —
 * a "use server" file may only export async functions, and errorMessageFor
 * is a plain synchronous function (docs/DECISIONS.md D-097).
 */

export async function runCopilotAnalysis(researchItemId: string): Promise<void> {
  let notice: string | null = null;
  let errorMessage: string | null = null;

  try {
    notice = await runAnalysisAndRecord(researchItemId);
  } catch (err) {
    errorMessage = errorMessageFor(err);
  }

  revalidatePath(`/research-queue/${researchItemId}`);

  if (errorMessage) {
    redirect(`/research-queue/${researchItemId}?error=${encodeURIComponent(errorMessage)}`);
  }
  redirect(`/research-queue/${researchItemId}?notice=${encodeURIComponent(notice ?? "Copilot analysis generated.")}`);
}
