import type { ReviewActionName } from "./schema";

/**
 * Mirrors the jsonb shape submit_review_action now returns (M6D,
 * docs/DECISIONS.md D-094). Pure, exported for hermetic testing.
 */
export interface SubmitReviewActionResult {
  action: string;
  research_item_id: string;
  research_item_status: string;
  signal_id: string;
  signal_publication_status: string;
  signal_verification_status: string;
  company_id: string;
  company_publication_status: string;
  published: boolean;
  private_approval: boolean;
}

/**
 * Builds the human-readable notice shown after a review action, from the
 * RPC's own jsonb return value -- never from a guess based on which button
 * was clicked. Returns null when there's nothing worth telling the reviewer
 * beyond the default page state (reject/request_evidence/reopen), or when
 * `result` is absent (an older caller that ignored the RPC's return value,
 * or a request whose response genuinely carried no data) -- this function
 * must never throw or fabricate a message in that case.
 *
 * This is UI messaging only, per D-055/D-090's "the gate is server-side,
 * not UI-only" precedent -- submit_review_action itself is what actually
 * prevents publication; this only describes, honestly, what it already did.
 */
export function buildActionNotice(action: ReviewActionName, result: SubmitReviewActionResult | null | undefined): string | null {
  if (!result) return null;

  if (action === "approve" || action === "edit_approve") {
    return result.published
      ? "Approved and published."
      : "Approved — private, because the linked company is not published yet.";
  }

  if (action === "mark_disputed") {
    return result.signal_publication_status === "draft"
      ? "Marked disputed. This record was never public, so it remains private."
      : "Marked disputed and removed from public view for reinvestigation.";
  }

  return null;
}
