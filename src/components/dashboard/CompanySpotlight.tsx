import { Card } from "@/components/ui/Card";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";
import { getCompanySpotlight } from "@/lib/data/dashboard";

export function CompanySpotlight() {
  const spotlight = getCompanySpotlight();

  if (!spotlight) {
    return (
      <Card as="section" aria-labelledby="company-spotlight-heading">
        <h2 id="company-spotlight-heading" className="text-lg font-semibold text-indigo-navy">
          Company spotlight
        </h2>
        <p className="mt-4 text-sm text-slate-gray">
          No eligible company is available to spotlight in this demo dataset.
        </p>
      </Card>
    );
  }

  const { company, sector, signal, stillMissingNote } = spotlight;

  return (
    <Card as="section" aria-labelledby="company-spotlight-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="company-spotlight-heading" className="text-lg font-semibold text-indigo-navy">
          Company spotlight
        </h2>
        <div className="flex flex-wrap gap-2">
          <EvidenceStrengthBadge strength={signal.evidence_strength} />
          <VerificationStatusBadge status={signal.verification_status} />
        </div>
      </div>
      <p className="mt-1 text-sm font-semibold text-ink">{company.name}</p>
      {sector ? <p className="text-xs text-slate-gray">{sector.name}</p> : null}

      <dl className="mt-4 flex flex-col gap-4">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-gray">
            Why it matters
          </dt>
          <dd className="mt-1 text-sm text-ink">{company.why_it_matters}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-gray">
            What changed recently
          </dt>
          <dd className="mt-1 text-sm text-ink">
            {signal.headline} — {signal.summary}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-gray">
            What&apos;s still missing
          </dt>
          <dd className="mt-1 text-sm text-ink">{stillMissingNote}</dd>
        </div>
      </dl>
    </Card>
  );
}
