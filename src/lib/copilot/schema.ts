import { z } from "zod";

/**
 * The Copilot's structured output contract (docs/DECISIONS.md D-095).
 *
 * suggestedNextStep's vocabulary is deliberately disjoint from BOTH
 * submit_review_action's real action verbs (src/lib/review/schema.ts's
 * reviewActionSchema) AND research_items.status's real values — an
 * earlier draft used 'needs_more_evidence' and was corrected specifically
 * because it collided with the real research_items.status value of the
 * same name. RESEARCH_ITEM_STATUS_VALUES is defined here, single-sourced,
 * so this disjointness is directly testable rather than asserted only in
 * prose.
 */
export const SUGGESTED_NEXT_STEP_VALUES = [
  "leans_approve",
  "leans_reject",
  "suggests_evidence_review",
  "unclear",
] as const;

export const suggestedNextStepSchema = z.enum(SUGGESTED_NEXT_STEP_VALUES);
export type SuggestedNextStep = z.infer<typeof suggestedNextStepSchema>;

/** research_items.status's real vocabulary (src/lib/review/queue.ts's QueueCounts / submit_review_action's v_new_item_status values) — used only for the disjointness tests, not imported elsewhere. */
export const RESEARCH_ITEM_STATUS_VALUES = [
  "pending",
  "needs_more_evidence",
  "approved",
  "rejected",
  "disputed",
] as const;

/**
 * Strict: an unknown extra field from the model is rejected outright
 * rather than silently passed through, matching
 * src/lib/review/schema.ts's editApproveFieldsSchema convention. Malformed
 * or schema-invalid model output must never reach record_copilot_analysis.
 */
export const copilotAnalysisOutputSchema = z
  .object({
    summary: z.string().min(1),
    riskFlags: z.array(z.string()),
    missingEvidenceQuestions: z.array(z.string()),
    suggestedNextStep: suggestedNextStepSchema,
    confidence: z.enum(["low", "medium", "high"]),
    limitations: z.string().nullable(),
  })
  .strict();

export type CopilotAnalysisOutput = z.infer<typeof copilotAnalysisOutputSchema>;
