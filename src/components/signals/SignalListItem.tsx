import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";
import { getSignalTypeLabel } from "@/lib/content/labels";
import type { SignalView } from "@/lib/data/browse";

export function SignalListItem({ view }: { view: SignalView }) {
  const { signal, company, sector } = view;
  return (
    <Link href={`/signals/${signal.id}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal">
      <Card className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-ink">{signal.headline}</span>
          <div className="flex flex-wrap gap-2">
            <EvidenceStrengthBadge strength={signal.evidence_strength} />
            <VerificationStatusBadge status={signal.verification_status} />
          </div>
        </div>
        <p className="text-sm text-slate-gray">{company.name}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-gray">
          {sector ? <span>{sector.name}</span> : null}
          <span aria-hidden="true">&middot;</span>
          <span>{getSignalTypeLabel(signal.signal_type)}</span>
        </div>
      </Card>
    </Link>
  );
}
