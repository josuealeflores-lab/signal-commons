import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";
import { SourceList } from "@/components/evidence/SourceList";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReviewActionForm } from "@/components/review/ReviewActionForm";
import { DemoRealBadge } from "@/components/review/DemoRealBadge";
import { getResearchItemById } from "@/lib/review/queue";

interface ResearchItemPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
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
  const { error, notice } = await searchParams;
  const detail = await getResearchItemById(id);
  if (!detail) notFound();

  const { item, signal, company, sources, history } = detail;

  return (
    <section className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="rounded-md border border-border-subtle bg-surface px-4 py-3 text-sm text-ink">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="rounded-md border border-border-subtle bg-surface px-4 py-3 text-sm text-ink">
          {notice}
        </p>
      ) : null}

      {!item.is_demo ? (
        <p
          role="note"
          className="rounded-md border border-amber-600 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800"
        >
          This is a real, USAspending-derived record from the connector — not demo data. It stays private in this
          reviewer queue and is never publicly visible unless its linked company is separately published.
        </p>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-gray">
            {item.item_type} &middot; queue status: {item.status}
          </p>
          <DemoRealBadge isDemo={item.is_demo} />
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-ink">{signal.headline}</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <EvidenceStrengthBadge strength={signal.evidence_strength} />
        <VerificationStatusBadge status={signal.verification_status} />
        <span className="rounded-full border border-border-subtle px-3 py-1 text-xs text-slate-gray">
          signal publication_status: {signal.publication_status}
        </span>
      </div>

      <Card as="section" aria-labelledby="company-heading">
        <h2 id="company-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-gray">
          Linked company
        </h2>
        <p className="mt-2 text-sm text-ink">{company.name}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <DemoRealBadge isDemo={company.is_demo} />
          <span className="rounded-full border border-border-subtle px-3 py-1 text-xs text-slate-gray">
            company publication_status: {company.publication_status}
          </span>
        </div>
        {company.publication_status !== "published" ? (
          <p className="mt-2 text-xs text-slate-gray">
            Approving this item will not make the signal publicly visible — its company has not been published.
          </p>
        ) : null}
      </Card>

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
