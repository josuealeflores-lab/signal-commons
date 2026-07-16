import {
  approveResearchItem,
  editAndApproveResearchItem,
  markDisputed,
  rejectResearchItem,
  reopenResearchItem,
  requestMoreEvidence,
} from "@/lib/review/actions";
import { EditApproveDiff } from "./EditApproveDiff";
import type { ReviewSignal } from "@/lib/review/queue";

export interface ReviewActionFormProps {
  researchItemId: string;
  status: string;
  signal: ReviewSignal;
}

/**
 * The 6 review-action buttons plus the edit_approve field editor. Actions
 * not valid from the item's current status (docs/DECISIONS.md's per-action
 * precondition table) are hidden rather than merely disabled, so a reviewer
 * never sees a button that would just error — the RPC's own check remains
 * the actual enforcement either way, this is only a UI nicety.
 */
export function ReviewActionForm({ researchItemId, status, signal }: ReviewActionFormProps) {
  const canDecide = status === "pending" || status === "needs_more_evidence";
  const canDispute = canDecide || status === "approved";
  const canReopen = status === "rejected" || status === "disputed";

  if (!canDecide && !canDispute && !canReopen) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Review actions</h2>

      {canDecide ? (
        <form className="flex flex-col gap-3">
          <label htmlFor="reviewer_note" className="text-sm font-medium text-ink">
            Reviewer note (optional)
          </label>
          <textarea
            id="reviewer_note"
            name="reviewer_note"
            rows={2}
            className="rounded-md border border-border-subtle px-3 py-2 text-sm text-ink"
          />
          <div className="flex flex-wrap gap-2">
            <button
              formAction={approveResearchItem.bind(null, researchItemId)}
              className="rounded-md bg-deep-teal px-4 py-2 text-sm font-semibold text-white"
            >
              Approve
            </button>
            <button
              formAction={rejectResearchItem.bind(null, researchItemId)}
              className="rounded-md border border-border-subtle px-4 py-2 text-sm font-semibold text-ink"
            >
              Reject
            </button>
            <button
              formAction={requestMoreEvidence.bind(null, researchItemId)}
              className="rounded-md border border-border-subtle px-4 py-2 text-sm font-semibold text-ink"
            >
              Request more evidence
            </button>
          </div>
        </form>
      ) : null}

      {canDispute ? (
        <form>
          <button
            formAction={markDisputed.bind(null, researchItemId)}
            className="rounded-md border border-border-subtle px-4 py-2 text-sm font-semibold text-ink"
          >
            Mark disputed
          </button>
        </form>
      ) : null}

      {canReopen ? (
        <form>
          <button
            formAction={reopenResearchItem.bind(null, researchItemId)}
            className="rounded-md border border-border-subtle px-4 py-2 text-sm font-semibold text-ink"
          >
            Reopen
          </button>
        </form>
      ) : null}

      {canDecide ? (
        <details className="rounded-md border border-border-subtle p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink">Edit and approve</summary>
          <form action={editAndApproveResearchItem.bind(null, researchItemId)} className="mt-3 flex flex-col gap-3">
            <EditApproveDiff signal={signal} />
            <button
              type="submit"
              className="self-start rounded-md bg-deep-teal px-4 py-2 text-sm font-semibold text-white"
            >
              Save edits and approve
            </button>
          </form>
        </details>
      ) : null}
    </div>
  );
}
