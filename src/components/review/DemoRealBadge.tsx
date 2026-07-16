export interface DemoRealBadgeProps {
  isDemo: boolean;
}

/**
 * R2 (docs/DECISIONS.md D-085/D-094): the reviewer UI must visually
 * distinguish demo records from real, USAspending-connector-created ones.
 * This is a labeling aid only — the real safety boundary is
 * submit_review_action itself, not this badge.
 */
export function DemoRealBadge({ isDemo }: DemoRealBadgeProps) {
  if (isDemo) {
    return (
      <span className="rounded-full border border-border-subtle bg-surface px-3 py-1 text-xs font-medium text-slate-gray">
        Demo
      </span>
    );
  }

  return (
    <span className="rounded-full border border-amber-600 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
      Real — USAspending connector
    </span>
  );
}
