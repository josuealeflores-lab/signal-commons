import { Card } from "@/components/ui/Card";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";

const STRENGTH_DEFINITIONS: { strength: "high" | "medium" | "low"; description: string }[] = [
  {
    strength: "high",
    description:
      "The event is directly documented by an authoritative source, or multiple independent credible sources strongly corroborate it.",
  },
  {
    strength: "medium",
    description:
      "One credible source supports the event, or several indirect sources align, but important details remain unavailable.",
  },
  {
    strength: "low",
    description:
      "The event is early, company-reported, ambiguous, based on a weak source, or lacking independent confirmation.",
  },
];

const VERIFICATION_DEFINITIONS: {
  status: "verified" | "partially_verified" | "unverified" | "disputed" | "rejected";
  description: string;
}[] = [
  { status: "verified", description: "A human reviewer confirmed the displayed wording is supported." },
  { status: "partially_verified", description: "The core event is supported, but some details remain uncertain." },
  { status: "unverified", description: "Extracted or submitted, but not yet reviewed." },
  { status: "disputed", description: "Credible evidence conflicts with this claim." },
  { status: "rejected", description: "Unsupported, duplicate, irrelevant, or materially misleading." },
];

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
          {STRENGTH_DEFINITIONS.map(({ strength, description }) => (
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
          {VERIFICATION_DEFINITIONS.map(({ status, description }) => (
            <li key={status} className="flex items-start gap-2 text-sm">
              <VerificationStatusBadge status={status} />
              <span className="text-ink">{description}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-gray">
          &ldquo;Verified&rdquo; means the displayed claim is supported by available evidence.
          It does not certify the company, product, future performance, or social impact.
        </p>
      </div>
    </Card>
  );
}
