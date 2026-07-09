import { SectorCard } from "@/components/dashboard/SectorCard";
import { getSectorOverview } from "@/lib/data/dashboard";

/**
 * All seven sectors render with identical markup/classes via SectorCard —
 * no sector is visually or algorithmically privileged (docs/DECISIONS.md
 * D-001). The list is sorted only by display_order, a fixed taxonomy
 * ordering, not by any activity/ranking metric.
 */
export function SectorOverview() {
  const items = getSectorOverview();
  return (
    <section aria-labelledby="sector-overview-heading" className="px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h2 id="sector-overview-heading" className="text-xl font-semibold text-indigo-navy">
          Sector overview
        </h2>
        <p className="mt-1 text-sm text-slate-gray">
          All seven essential sectors are tracked with equal prominence.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {items.map((item) => (
            <li key={item.sector.slug}>
              <SectorCard item={item} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
