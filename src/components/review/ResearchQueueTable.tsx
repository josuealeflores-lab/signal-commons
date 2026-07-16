import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { DemoRealBadge } from "./DemoRealBadge";
import type { ResearchItem } from "@/lib/review/queue";

export interface ResearchQueueTableProps {
  items: ResearchItem[];
}

export function ResearchQueueTable({ items }: ResearchQueueTableProps) {
  if (items.length === 0) {
    return <EmptyState message="No research items match the selected filters." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`/research-queue/${item.id}`}
            className="block rounded-2xl border border-border-subtle bg-surface p-4 shadow-sm hover:border-deep-teal"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-ink">{item.id}</span>
              <div className="flex items-center gap-2">
                <DemoRealBadge isDemo={item.is_demo} />
                <span className="text-xs uppercase tracking-wide text-slate-gray">{item.status}</span>
              </div>
            </div>
            <p className="mt-1 text-xs text-slate-gray">
              {item.item_type} &middot; priority: {item.priority}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
