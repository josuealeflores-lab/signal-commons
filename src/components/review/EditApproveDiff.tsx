import type { Signal } from "@/lib/data/schema";

export interface EditApproveDiffProps {
  signal: Signal;
}

/**
 * The editable-proposed-summary fields for edit_approve
 * (docs/PRODUCT_REQUIREMENTS.md's research-queue requirement) — pre-filled
 * with the signal's current values so a reviewer edits from the real
 * extracted text, not a blank form. Field names match exactly the RPC's
 * hardcoded edit_approve allow-list (docs/DECISIONS.md D-058) — this is
 * UI-layer defense-in-depth only; the RPC's own static column list is
 * authoritative regardless of what's submitted here.
 */
export function EditApproveDiff({ signal }: EditApproveDiffProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="headline" className="text-sm font-medium text-ink">
          Headline
        </label>
        <input
          id="headline"
          name="headline"
          type="text"
          defaultValue={signal.headline}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="summary" className="text-sm font-medium text-ink">
          Summary
        </label>
        <textarea
          id="summary"
          name="summary"
          rows={3}
          defaultValue={signal.summary}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="why_it_matters" className="text-sm font-medium text-ink">
          Why it matters
        </label>
        <textarea
          id="why_it_matters"
          name="why_it_matters"
          rows={3}
          defaultValue={signal.why_it_matters}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="evidence_strength" className="text-sm font-medium text-ink">
          Evidence strength
        </label>
        <select
          id="evidence_strength"
          name="evidence_strength"
          defaultValue={signal.evidence_strength}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm text-ink"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="reviewer_note" className="text-sm font-medium text-ink">
          Reviewer note (optional)
        </label>
        <textarea
          id="reviewer_note"
          name="reviewer_note"
          rows={2}
          className="rounded-md border border-border-subtle px-3 py-2 text-sm text-ink"
        />
      </div>
    </div>
  );
}
