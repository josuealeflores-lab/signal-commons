"use client";

import { useActionState } from "react";
import { Card } from "@/components/ui/Card";
import { RunDigestButton } from "./RunDigestButton";
import type { DigestActionState } from "@/lib/digest/actions";

/**
 * Reviewer-only, advisory-only, ephemeral queue digest panel
 * (docs/DECISIONS.md D-096). `action` is accepted as a prop (mirroring
 * copilot/CopilotCard's own convention) -- only its *type* is imported
 * from the "use server" actions module, never the runtime function
 * itself, so this component and its tests never import a "use server"
 * module directly. useActionState holds the one returned digest in
 * memory only; nothing is persisted, and the digest clears naturally on
 * navigation or refresh. All output is rendered as plain React text (no
 * dangerouslySetInnerHTML, no markdown-to-HTML), so any script/markdown
 * content in a model response is inert.
 */

export interface DigestPanelProps {
  action: (prevState: DigestActionState) => Promise<DigestActionState>;
  initialState?: DigestActionState;
}

const DISCLAIMER = "Advisory only. This digest does not approve, reject, publish, or replace reviewer judgment.";

/** Lives here, not in actions.ts -- a "use server" file may only export async functions, never a plain object constant. */
const DEFAULT_INITIAL_STATE: DigestActionState = { digest: null, error: null };

export function DigestPanel({ action, initialState = DEFAULT_INITIAL_STATE }: DigestPanelProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <Card as="section" aria-labelledby="digest-heading">
      <h2 id="digest-heading" className="text-lg font-semibold text-ink">
        Queue digest
      </h2>
      <p className="mt-2 text-xs font-medium text-slate-gray">{DISCLAIMER}</p>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-ink">
          {state.error}
        </p>
      ) : null}

      {state.digest ? (
        <div className="mt-3 flex flex-col gap-4">
          <p className="text-sm text-ink">{state.digest.queueSummary}</p>

          {state.digest.priorityFocusItems.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-gray">Priority focus items</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                {state.digest.priorityFocusItems.map((item, index) => (
                  <li key={index}>
                    {item.researchItemId}: {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.digest.missingEvidenceThemes.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-gray">Missing-evidence themes</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                {state.digest.missingEvidenceThemes.map((theme, index) => (
                  <li key={index}>{theme}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {state.digest.riskPatterns.length > 0 ? (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-gray">Risk patterns</h3>
              <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                {state.digest.riskPatterns.map((pattern, index) => (
                  <li key={index}>{pattern}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs italic text-slate-gray">Suggested reviewer focus: {state.digest.suggestedReviewerFocus}</p>
          {state.digest.limitations ? <p className="text-xs text-slate-gray">Limitations: {state.digest.limitations}</p> : null}
        </div>
      ) : null}

      <form action={formAction} className="mt-4">
        <RunDigestButton />
      </form>
    </Card>
  );
}
