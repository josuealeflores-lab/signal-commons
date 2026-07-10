import type { Metadata } from "next";
import { ResearchQueueTable } from "@/components/review/ResearchQueueTable";
import { getResearchQueue } from "@/lib/review/queue";

export const metadata: Metadata = {
  title: "Research queue — Signal Commons",
};

interface ResearchQueuePageProps {
  searchParams: Promise<{ status?: string; priority?: string }>;
}

export default async function ResearchQueuePage({ searchParams }: ResearchQueuePageProps) {
  const { status, priority } = await searchParams;
  const allItems = await getResearchQueue();
  const items = allItems.filter((item) => {
    if (status && item.status !== status) return false;
    if (priority && item.priority !== priority) return false;
    return true;
  });

  return (
    <section>
      <h1 className="text-2xl font-semibold text-ink">Research queue</h1>
      <p className="mt-2 text-sm text-slate-gray">
        {items.length} of {allItems.length} item{allItems.length === 1 ? "" : "s"} shown.
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-col gap-1">
          <label htmlFor="status" className="text-xs font-medium text-slate-gray">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="needs_more_evidence">Needs more evidence</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="priority" className="text-xs font-medium text-slate-gray">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={priority ?? ""}
            className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
          >
            <option value="">Any priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <button type="submit" className="rounded-md bg-deep-teal px-4 py-1.5 text-sm font-semibold text-white">
          Apply filters
        </button>
      </form>

      <div className="mt-6">
        <ResearchQueueTable items={items} />
      </div>
    </section>
  );
}
