import { Card } from "@/components/ui/Card";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";
import {
  EVIDENCE_STRENGTH_DEFINITIONS,
  VERIFICATION_STATUS_DEFINITIONS,
  VERIFIED_DISCLAIMER,
} from "@/lib/content/labels";

export function EvidenceExplainer() {
  return (
    <Card as="section" aria-labelledby="evidence-explainer-heading">
      <h2 id="evidence-explainer-heading" className="text-lg font-semibold text-indigo-navy">
        Understanding evidence labels
      </h2>
      <p className="mt-1 text-sm text-slate-gray">
        We label every signal so you know how much to trust it — and separately, whether
        it has been checked.
      </p>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-gray">
          Evidence strength — how well-supported the signal is
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {EVIDENCE_STRENGTH_DEFINITIONS.map(({ strength, description }) => (
            <li key={strength} className="flex items-start gap-2 text-sm">
              <EvidenceStrengthBadge strength={strength} />
              <span className="text-ink">{description}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-gray">
          Verification status — whether the claim has been checked
        </h3>
        <ul className="mt-2 flex flex-col gap-2">
          {VERIFICATION_STATUS_DEFINITIONS.map(({ status, description }) => (
            <li key={status} className="flex items-start gap-2 text-sm">
              <VerificationStatusBadge status={status} />
              <span className="text-ink">{description}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-gray">{VERIFIED_DISCLAIMER}</p>
      </div>
    </Card>
  );
}
