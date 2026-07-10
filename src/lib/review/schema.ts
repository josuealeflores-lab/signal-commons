import { z } from "zod";
import { evidenceStrengthSchema } from "@/lib/data/schema";

/**
 * UI-layer defense-in-depth only (docs/DECISIONS.md D-058) — mirrors
 * submit_review_action's hardcoded edit_approve column allow-list. The RPC
 * itself is the authoritative enforcement; this only gives a fast, clear
 * client-side error before a network round-trip. No `companies` allow-list
 * exists this milestone (item_type = 'new_signal' only).
 */
export const editApproveFieldsSchema = z
  .object({
    headline: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
    why_it_matters: z.string().min(1).optional(),
    evidence_strength: evidenceStrengthSchema.optional(),
  })
  .strict();

export type EditApproveFields = z.infer<typeof editApproveFieldsSchema>;

export const reviewActionSchema = z.enum([
  "approve",
  "edit_approve",
  "reject",
  "request_evidence",
  "mark_disputed",
  "reopen",
]);

export type ReviewActionName = z.infer<typeof reviewActionSchema>;
