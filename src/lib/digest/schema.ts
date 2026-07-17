import { z } from "zod";

/**
 * M8A queue-digest output contract (docs/DECISIONS.md D-096).
 *
 * Strict, like copilot/schema.ts's copilotAnalysisOutputSchema: an unknown
 * extra field from the model is rejected outright. Nothing in this shape
 * resembles a real reviewer action verb (src/lib/review/schema.ts's
 * reviewActionSchema) or a research_items.status value -- the digest is
 * advisory prose and structured references only, never a decision.
 */

export const priorityFocusItemSchema = z
  .object({
    researchItemId: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

export const digestOutputSchema = z
  .object({
    queueSummary: z.string().min(1),
    priorityFocusItems: z.array(priorityFocusItemSchema),
    missingEvidenceThemes: z.array(z.string()),
    riskPatterns: z.array(z.string()),
    suggestedReviewerFocus: z.string(),
    limitations: z.string(),
  })
  .strict();

export type PriorityFocusItem = z.infer<typeof priorityFocusItemSchema>;
export type DigestOutput = z.infer<typeof digestOutputSchema>;

/** Tool-call argument schemas, validated before a tool handler ever runs (§3 of D-096). */
export const listQueueItemsArgsSchema = z.object({}).strict();
export const getItemContextArgsSchema = z
  .object({
    researchItemId: z.string().min(1),
  })
  .strict();
