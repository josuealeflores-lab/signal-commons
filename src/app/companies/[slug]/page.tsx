import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";
import { SourceList } from "@/components/evidence/SourceList";
import { getCompanyTypeLabel } from "@/lib/content/labels";
import { getCompanyView } from "@/lib/data/browse";
import { getSourceDocumentsForSignal } from "@/lib/data/repository";

interface CompanyDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CompanyDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = getCompanyView(slug);
  if (!view) return {};
  return {
    title: `${view.company.name} — Signal Commons`,
    description: view.company.summary,
  };
}

export default async function CompanyDetailPage({ params }: CompanyDetailPageProps) {
  const { slug } = await params;
  const view = getCompanyView(slug);
  if (!view) notFound();

  const { company, sector, signals } = view;

  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-gray">
            {sector ? sector.name : "Sector unavailable"} &middot; {getCompanyTypeLabel(company.company_type)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-indigo-navy">
            {company.name}
          </h1>
          <p className="mt-2 text-sm text-ink">{company.summary}</p>
        </div>

        <Card as="section" aria-labelledby="why-it-matters-heading">
          <h2 id="why-it-matters-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-gray">
            Why it matters
          </h2>
          <p className="mt-2 text-sm text-ink">{company.why_it_matters}</p>
        </Card>

        <Card as="section" aria-labelledby="signals-heading">
          <h2 id="signals-heading" className="text-lg font-semibold text-indigo-navy">
            Recent approved signals
          </h2>
          {signals.length === 0 ? (
            <div className="mt-3">
              <EmptyState message="No published signal is available for this demo company yet." />
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-4">
              {signals.map((signal) => (
                <li key={signal.id} className="border-t border-border-subtle pt-4 first:border-t-0 first:pt-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{signal.headline}</span>
                    <div className="flex flex-wrap gap-2">
                      <EvidenceStrengthBadge strength={signal.evidence_strength} />
                      <VerificationStatusBadge status={signal.verification_status} />
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-slate-gray">{signal.summary}</p>
                  <div className="mt-3">
                    <SourceList signal={signal} sources={getSourceDocumentsForSignal(signal)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card as="section" aria-labelledby="watch-next-heading">
          <h2 id="watch-next-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-gray">
            What to watch next
          </h2>
          <div className="mt-2">
            <EmptyState message="No watch items are recorded for this demo company yet." />
          </div>
        </Card>
      </div>
    </section>
  );
}
