"use client";

import { useFormStatus } from "react-dom";

/**
 * The only client component introduced by M7's first slice (docs/DECISIONS.md
 * D-095) — exists solely to disable the trigger button and show a pending
 * label while the Copilot Server Action is in flight, giving basic
 * accidental-double-submit protection. The action logic itself
 * (runCopilotAnalysis) remains a plain Server Action bound via a form
 * action, exactly like every other reviewer action button — this
 * component holds no state of its own beyond what useFormStatus reads
 * from its nearest parent <form>.
 */
export function RunAnalysisButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border-subtle px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Analyzing…" : "Run Copilot analysis"}
    </button>
  );
}
