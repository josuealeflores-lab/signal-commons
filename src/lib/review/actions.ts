"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionSupabaseClient } from "@/lib/supabase/session-client";
import { editApproveFieldsSchema, type EditApproveFields, type ReviewActionName } from "./schema";
import { buildActionNotice, type SubmitReviewActionResult } from "./action-messages";
import { errorMessageFor } from "./error-messages";

/**
 * Thin, typed wrappers over the single submit_review_action RPC
 * (docs/DECISIONS.md D-054) — one Server Action per action name, not one
 * RPC per action. Always uses the session-aware client, so the RPC's own
 * `auth.uid()` resolves to the calling reviewer, and RLS/the RPC's
 * reviewer gate apply exactly as they would for any other authenticated
 * request — never the service-role client.
 *
 * Every exported action below has the shape `(researchItemId, formData) =>
 * Promise<void>` specifically so it can be used as
 * `formAction={action.bind(null, researchItemId)}` on a plain <form> —
 * Next.js's bound-server-action-in-a-form convention requires the final
 * runtime parameter to be the submitted FormData, and the form-action prop
 * type requires a `void`-returning function (a `Promise<T>` for a concrete
 * `T` other than `void` is not assignable there, even though a plain
 * non-Promise-wrapped value would be). On failure, redirects back to the
 * research item's own page with an `error` query param, mirroring
 * `auth/login`'s pattern.
 *
 * M6D (docs/DECISIONS.md D-094): submit_review_action now returns a small
 * jsonb status object instead of void. On success, `buildActionNotice`
 * turns that into a `?notice=` query param so the page can show honest
 * messaging ("Approved — private, because the linked company is not
 * published yet") rather than implying a real publish happened. This is a
 * UI-messaging convenience only, never the safety boundary — the RPC's own
 * behavior already decided whether anything actually published.
 *
 * M11 Phase B (docs/DECISIONS.md D-100): a fresh idempotency key is
 * generated server-side via crypto.randomUUID(), once per Server Action
 * invocation -- never accepted from the client/form, since a plain form
 * POST has no client-side retry logic that would need a stable key across
 * multiple attempts. Each distinct form submission is a genuinely new
 * user-initiated mutation attempt and gets a genuinely new key, so a key
 * can never be reused across two different reviewer actions. Errors are
 * now mapped through error-messages.ts's errorMessageFor, which gives the
 * five new idempotency/rate-limit SC00x codes a friendly message and
 * leaves every other existing error message passing through unchanged.
 */
async function callSubmitReviewAction(
  researchItemId: string,
  action: ReviewActionName,
  reviewerNote: string | null,
  editedFields: EditApproveFields | null,
): Promise<void> {
  const supabase = await getSessionSupabaseClient();
  const idempotencyKey = crypto.randomUUID();
  const { data, error } = await supabase.rpc("submit_review_action", {
    p_research_item_id: researchItemId,
    p_action: action,
    p_idempotency_key: idempotencyKey,
    p_reviewer_note: reviewerNote,
    p_edited_fields: editedFields,
  });

  revalidatePath("/research-queue");
  revalidatePath(`/research-queue/${researchItemId}`);
  revalidatePath("/reviewer");

  if (error) {
    redirect(`/research-queue/${researchItemId}?error=${encodeURIComponent(errorMessageFor(error))}`);
  }

  const notice = buildActionNotice(action, data as SubmitReviewActionResult | null);
  if (notice) {
    redirect(`/research-queue/${researchItemId}?notice=${encodeURIComponent(notice)}`);
  }
}

function noteFromFormData(formData: FormData): string | null {
  const value = formData.get("reviewer_note");
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export async function approveResearchItem(researchItemId: string, formData: FormData): Promise<void> {
  await callSubmitReviewAction(researchItemId, "approve", noteFromFormData(formData), null);
}

export async function rejectResearchItem(researchItemId: string, formData: FormData): Promise<void> {
  await callSubmitReviewAction(researchItemId, "reject", noteFromFormData(formData), null);
}

export async function requestMoreEvidence(researchItemId: string, formData: FormData): Promise<void> {
  await callSubmitReviewAction(researchItemId, "request_evidence", noteFromFormData(formData), null);
}

export async function markDisputed(researchItemId: string, formData: FormData): Promise<void> {
  await callSubmitReviewAction(researchItemId, "mark_disputed", noteFromFormData(formData), null);
}

export async function reopenResearchItem(researchItemId: string, formData: FormData): Promise<void> {
  await callSubmitReviewAction(researchItemId, "reopen", noteFromFormData(formData), null);
}

/**
 * Validates edited fields against the same allow-list the RPC hardcodes
 * (defense-in-depth only, per D-058 — the RPC's own column list is
 * authoritative regardless of what this validation lets through).
 */
export async function editAndApproveResearchItem(researchItemId: string, formData: FormData): Promise<void> {
  const rawFields = {
    headline: formData.get("headline"),
    summary: formData.get("summary"),
    why_it_matters: formData.get("why_it_matters"),
    evidence_strength: formData.get("evidence_strength"),
  };
  const candidate = Object.fromEntries(
    Object.entries(rawFields).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );

  const parsed = editApproveFieldsSchema.safeParse(candidate);
  if (!parsed.success) {
    redirect(`/research-queue/${researchItemId}?error=${encodeURIComponent(parsed.error.message)}`);
  }

  await callSubmitReviewAction(researchItemId, "edit_approve", noteFromFormData(formData), parsed.data);
}
