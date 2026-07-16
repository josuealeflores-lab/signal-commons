import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { RunAnalysisButton } from "./RunAnalysisButton";
import type { CopilotAnalysisRecord } from "@/lib/copilot/context";

export interface CopilotCardProps {
  analyses: CopilotAnalysisRecord[];
  action: (formData: FormData) => void | Promise<void>;
}

const DISCLAIMER = "Advisory only. Verify sources independently. Not publication-ready. Does not replace reviewer judgment.";

const SUGGESTED_NEXT_STEP_LABEL: Record<CopilotAnalysisRecord["suggested_next_step"], string> = {
  leans_approve: "leans toward approval",
  leans_reject: "leans toward rejection",
  suggests_evidence_review: "suggests reviewing evidence further",
  unclear: "unclear — no strong lean",
};

/**
 * Reviewer-only, advisory-only Copilot card (docs/DECISIONS.md D-095).
 * Renders past analyses newest-first plus a manual trigger — never
 * auto-runs. All output is rendered as plain React text (no
 * dangerouslySetInnerHTML, no markdown-to-HTML rendering), so any
 * script/markdown content in a model response is inert.
 *
 * `action` is accepted as a prop (rather than importing
 * runCopilotAnalysis directly) so this component stays hermetically
 * testable with a fake action, and so the "use server" module is never
 * imported by the test suite.
 *
 * suggestedNextStep is deliberately rendered as plain, muted prose below
 * the risk-flags/missing-evidence sections — never a button or badge —
 * so it can't be mistaken for, or anchor against, the real
 * ReviewActionForm controls rendered just below this card.
 */
export function CopilotCard({ analyses, action }: CopilotCardProps) {
  return (
    <Card as="section" aria-labelledby="copilot-heading">
      <h2 id="copilot-heading" className="text-lg font-semibold text-ink">
        Copilot analysis
      </h2>
      <p className="mt-2 text-xs font-medium text-slate-gray">{DISCLAIMER}</p>

      {analyses.length === 0 ? (
        <div className="mt-3">
          <EmptyState message="No Copilot analysis has been run for this item yet." />
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-4">
          {analyses.map((analysis) => (
            <li key={analysis.id} className="border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
              <p className="text-sm text-ink">{analysis.summary}</p>

              {analysis.risk_flags.length > 0 ? (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-gray">Risk flags</h3>
                  <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                    {analysis.risk_flags.map((flag, index) => (
                      <li key={index}>{flag}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {analysis.missing_evidence.length > 0 ? (
                <div className="mt-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-gray">
                    Missing-evidence questions
                  </h3>
                  <ul className="mt-1 list-disc pl-5 text-sm text-ink">
                    {analysis.missing_evidence.map((question, index) => (
                      <li key={index}>{question}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p className="mt-3 text-xs italic text-slate-gray">
                Copilot&rsquo;s advisory lean: {SUGGESTED_NEXT_STEP_LABEL[analysis.suggested_next_step]} — advisory
                only, not a decision.
              </p>

              <p className="mt-2 text-xs text-slate-gray">Confidence: {analysis.confidence}</p>
              {analysis.limitations ? (
                <p className="mt-1 text-xs text-slate-gray">Limitations: {analysis.limitations}</p>
              ) : null}
              <p className="mt-2 text-xs text-slate-gray">
                {analysis.model} &middot; {new Date(analysis.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}

      <form action={action} className="mt-4">
        <RunAnalysisButton />
      </form>
    </Card>
  );
}
