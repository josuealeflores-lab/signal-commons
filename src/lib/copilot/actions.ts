"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  runAnalysisAndRecord,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
  UnsupportedResearchItemError,
} from "./run-analysis";

/**
 * Thin "use server" wrapper over run-analysis.ts's injectable core — same
 * separation-of-concerns pattern as src/lib/review/actions.ts over
 * queue.ts. Uses the session client throughout (via run-analysis.ts),
 * never service-role. Reviewer-triggered only: this Server Action is only
 * ever invoked by an explicit form submission on the research-item detail
 * page, never automatically. Never calls submit_review_action.
 */

function errorMessageFor(err: unknown): string {
  if (err instanceof ModelTimeoutError) return "Copilot analysis timed out. Try again.";
  if (err instanceof ModelProviderError) return "Copilot analysis failed (provider error). Try again.";
  if (err instanceof UnsupportedResearchItemError) return "Copilot analysis is not available for this item.";
  if (err instanceof ModelResponseParseError) return "Copilot analysis returned an unexpected response. Try again.";
  return "Copilot analysis failed. Try again.";
}

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
