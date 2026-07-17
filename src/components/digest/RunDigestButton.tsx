"use client";

import { useFormStatus } from "react-dom";

/**
 * Mirrors copilot/RunAnalysisButton.tsx's pattern exactly: disables the
 * trigger and shows a pending label while the digest Server Action is in
 * flight, using useFormStatus from the nearest parent <form>. Holds no
 * state of its own.
 */
export function RunDigestButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-border-subtle px-4 py-2 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Generating…" : "Generate queue digest"}
    </button>
  );
}
