import { Card } from "@/components/ui/Card";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { getRecentlyEmerging } from "@/lib/data/dashboard";
import { getSignalTypeLabel } from "@/lib/content/labels";

export function RecentlyEmerging() {
  const items = getRecentlyEmerging(5);

  return (
    <Card as="section" aria-labelledby="recently-emerging-heading">
      <h2 id="recently-emerging-heading" className="text-lg font-semibold text-indigo-navy">
        Recently emerging
      </h2>
      <p className="mt-1 text-xs text-slate-gray">
        Dates reflect the fixed demo dataset, not live monitoring.
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-gray">
          No published signals are available in this demo dataset yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border-subtle">
          {items.map(({ signal, company, sector }) => (
            <li key={signal.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-ink">{company.name}</span>
                <EvidenceStrengthBadge strength={signal.evidence_strength} />
              </div>
              <p className="text-sm text-slate-gray">{company.summary}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-gray">
                {sector ? <span>{sector.name}</span> : null}
                <span aria-hidden="true">&middot;</span>
                <span>{getSignalTypeLabel(signal.signal_type)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
