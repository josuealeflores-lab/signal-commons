import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { DigestPanel } from "@/components/digest/DigestPanel";
import { getQueueCounts, getRecentReviewActions } from "@/lib/review/queue";
import { generateQueueDigest } from "@/lib/digest/actions";

export const metadata: Metadata = {
  title: "Reviewer dashboard — Signal Commons",
};

interface CountCardProps {
  label: string;
  value: number;
}

function CountCard({ label, value }: CountCardProps) {
  return (
    <Card>
      <p className="text-2xl font-semibold text-ink">{value}</p>
      <p className="text-xs uppercase tracking-wide text-slate-gray">{label}</p>
    </Card>
  );
}

/**
 * Per docs/PRODUCT_REQUIREMENTS.md §9: queue counts, recent actions, an
 * ingestion-run status placeholder (no ingestion connector exists yet —
 * Milestone 6), and draft-vs-published counts.
 */
export default async function ReviewerDashboardPage() {
  const [counts, recentActions] = await Promise.all([getQueueCounts(), getRecentReviewActions()]);

  return (
    <section className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Reviewer dashboard</h1>
        <p className="mt-2 text-sm text-slate-gray">An overview of the research queue and your recent activity.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <CountCard label="Pending" value={counts.pending} />
        <CountCard label="Needs more evidence" value={counts.needsMoreEvidence} />
        <CountCard label="Approved" value={counts.approved} />
        <CountCard label="Rejected" value={counts.rejected} />
        <CountCard label="Disputed" value={counts.disputed} />
      </div>

      <DigestPanel action={generateQueueDigest} />

      <Card as="section" aria-labelledby="recent-actions-heading">
        <h2 id="recent-actions-heading" className="text-lg font-semibold text-ink">
          Your recent review actions
        </h2>
        {recentActions.length === 0 ? (
          <div className="mt-3">
            <EmptyState message="You haven't taken any review actions yet." />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {recentActions.map((action) => (
              <li key={action.id} className="border-t border-border-subtle pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-ink">{action.action}</p>
                <p className="text-xs text-slate-gray">
                  {action.research_item_id} &middot; {new Date(action.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section" aria-labelledby="ingestion-heading">
        <h2 id="ingestion-heading" className="text-lg font-semibold text-ink">
          Ingestion runs
        </h2>
        <div className="mt-3">
          <EmptyState message="No ingestion connectors are configured yet — this section is a placeholder for a future milestone." />
        </div>
      </Card>
    </section>
  );
}
