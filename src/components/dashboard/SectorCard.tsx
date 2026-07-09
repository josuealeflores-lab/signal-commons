import { Card } from "@/components/ui/Card";
import { SectorIcon } from "@/components/dashboard/SectorIcon";
import type { SectorOverviewItem } from "@/lib/data/dashboard";

export function SectorCard({ item }: { item: SectorOverviewItem }) {
  const { sector, companyCount } = item;
  return (
    <Card className="flex flex-col items-center gap-2 text-center">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-light-gray text-deep-teal"
      >
        <SectorIcon iconKey={sector.icon_key} />
      </span>
      <span className="text-sm font-semibold text-ink">{sector.name}</span>
      <span className="text-xs text-slate-gray">
        {companyCount} {companyCount === 1 ? "company" : "companies"}
      </span>
    </Card>
  );
}
