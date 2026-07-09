import type { ReactNode } from "react";

export type StatusTone = "success" | "warning" | "neutral" | "danger";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-green-50 text-green-800 border-green-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  danger: "bg-rose-50 text-rose-900 border-rose-200",
};

export interface StatusPillProps {
  label: string;
  tone: StatusTone;
  icon?: ReactNode;
  /** Extra context for screen readers, e.g. "Evidence strength: High". */
  srPrefix?: string;
}

/**
 * Generic status pill with no domain knowledge of "evidence" or
 * "verification" — EvidenceStrengthBadge and VerificationStatusBadge wrap
 * this with their own distinct prop types so the two concepts can never be
 * merged (docs/DECISIONS.md D-019).
 */
export function StatusPill({ label, tone, icon, srPrefix }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      {icon ? (
        <span aria-hidden="true" className="flex h-3.5 w-3.5 items-center justify-center">
          {icon}
        </span>
      ) : null}
      <span>
        {srPrefix ? <span className="sr-only">{srPrefix}: </span> : null}
        {label}
      </span>
    </span>
  );
}
