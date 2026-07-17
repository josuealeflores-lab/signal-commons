import type { Metadata } from "next";
import { SectorCard } from "@/components/dashboard/SectorCard";
import { getSectorOverview } from "@/lib/data/dashboard";

const TITLE = "Sectors — Signal Commons";
const DESCRIPTION = "All seven sectors Signal Commons tracks, with equal prominence.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function SectorsIndexPage() {
  const items = await getSectorOverview();

  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-semibold tracking-tight text-indigo-navy">Sectors</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-gray">
          All seven essential sectors are tracked with equal prominence — no sector is
          featured or privileged over another.
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.sector.slug}>
              <SectorCard item={item} href={`/sectors/${item.sector.slug}`} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
