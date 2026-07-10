import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";
import { SourceList } from "@/components/evidence/SourceList";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewActionForm } from "@/components/review/ReviewActionForm";
import { getResearchItemById } from "@/lib/review/queue";

interface ResearchItemPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export async function generateMetadata({ params }: ResearchItemPageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getResearchItemById(id);
  if (!detail) return {};
  return { title: `${detail.signal.headline} — Research queue — Signal Commons` };
}

/**
 * The evidence-packet view (docs/PRODUCT_REQUIREMENTS.md §8): target
 * signal's full fields, linked evidence/sources, an edit form for
 * edit_approve, and the 6 review-action buttons — plus the full
 * review_actions history for this item.
 */
export default async function ResearchItemPage({ params, searchParams }: ResearchItemPageProps) {
  const { id } = await params;
  const { error } = await searchParams;
  const detail = await getResearchItemById(id);
  if (!detail) notFound();

  const { item, signal, sources, history } = detail;

  return (
    <section className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="rounded-md border border-border-subtle bg-surface px-4 py-3 text-sm text-ink">
          {error}
        </p>
      ) : null}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-gray">
          {item.item_type} &middot; queue status: {item.status}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{signal.headline}</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <EvidenceStrengthBadge strength={signal.evidence_strength} />
        <VerificationStatusBadge status={signal.verification_status} />
        <span className="rounded-full border border-border-subtle px-3 py-1 text-xs text-slate-gray">
          publication_status: {signal.publication_status}
        </span>
      </div>

      <Card as="section" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-gray">
          Summary
        </h2>
        <p className="mt-2 text-sm text-ink">{signal.summary}</p>
        <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-gray">Why it matters</h2>
        <p className="mt-2 text-sm text-ink">{signal.why_it_matters}</p>
      </Card>

      <Card as="section" aria-labelledby="evidence-heading">
        <h2 id="evidence-heading" className="text-lg font-semibold text-ink">
          Evidence
        </h2>
        <div className="mt-3">
          <SourceList signal={signal} sources={sources} />
        </div>
      </Card>

      <ReviewActionForm researchItemId={item.id} status={item.status} signal={signal} />

      <Card as="section" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold text-ink">
          Review history
        </h2>
        {history.length === 0 ? (
          <div className="mt-3">
            <EmptyState message="No review actions recorded yet." />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {history.map((action) => (
              <li key={action.id} className="border-t border-border-subtle pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm font-semibold text-ink">{action.action}</p>
                <p className="text-xs text-slate-gray">{new Date(action.created_at).toLocaleString()}</p>
                {action.reviewer_note ? <p className="mt-1 text-sm text-ink">{action.reviewer_note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
