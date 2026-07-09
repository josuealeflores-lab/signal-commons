import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { getCompanyTypeLabel } from "@/lib/content/labels";
import type { CompanyView } from "@/lib/data/browse";

export function CompanyListItem({ view }: { view: CompanyView }) {
  const { company, sector, primarySignal } = view;
  return (
    <Link href={`/companies/${company.slug}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal">
      <Card className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-ink">{company.name}</span>
          {primarySignal ? (
            <EvidenceStrengthBadge strength={primarySignal.evidence_strength} />
          ) : null}
        </div>
        <p className="text-sm text-slate-gray">{company.summary}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-gray">
          {sector ? <span>{sector.name}</span> : null}
          <span aria-hidden="true">&middot;</span>
          <span>{getCompanyTypeLabel(company.company_type)}</span>
          {!primarySignal ? (
            <>
              <span aria-hidden="true">&middot;</span>
              <span>No published signal yet</span>
            </>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
