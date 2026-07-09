import { KpiCard } from "@/components/dashboard/KpiCard";
import { getKpiSummary } from "@/lib/data/dashboard";

export async function KpiCards() {
  const summary = await getKpiSummary();
  return (
    <section aria-label="Key metrics" className="px-4 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Company profiles"
          value={summary.companyProfiles}
          description="Spans every evidence stage in this demo; not all have a published signal yet."
        />
        <KpiCard label="Published signals" value={summary.publishedSignals} />
        <KpiCard label="High-evidence signals" value={summary.highConfidenceSignals} />
        <KpiCard label="Sectors covered" value={summary.sectorsCovered} />
      </div>
    </section>
  );
}
