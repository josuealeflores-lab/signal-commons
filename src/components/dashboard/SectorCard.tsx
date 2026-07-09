import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { SectorIcon } from "@/components/dashboard/SectorIcon";
import type { SectorOverviewItem } from "@/lib/data/dashboard";

export interface SectorCardProps {
  item: SectorOverviewItem;
  /** When provided, the whole card links to the sector detail page. */
  href?: string;
}

export function SectorCard({ item, href }: SectorCardProps) {
  const { sector, companyCount } = item;
  const content = (
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

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-deep-teal">
        {content}
      </Link>
    );
  }
  return content;
}
