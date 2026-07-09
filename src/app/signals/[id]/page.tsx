import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";
import { SourceList } from "@/components/evidence/SourceList";
import { getSignalTypeLabel } from "@/lib/content/labels";
import { getSignalView } from "@/lib/data/browse";

interface SignalDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * getSignalView() is gated to published signals only — a draft signal's id
 * returns undefined here, identically to an unknown id, so metadata never
 * reflects draft content before the page component itself calls notFound().
 */
export async function generateMetadata({ params }: SignalDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const view = await getSignalView(id);
  if (!view) return {};
  return {
    title: `${view.signal.headline} — Signal Commons`,
    description: view.signal.summary,
  };
}

export default async function SignalDetailPage({ params }: SignalDetailPageProps) {
  const { id } = await params;
  const view = await getSignalView(id);
  if (!view) notFound();

  const { signal, company, sector, sources } = view;

  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-gray">
            {sector ? sector.name : "Sector unavailable"} &middot; {getSignalTypeLabel(signal.signal_type)}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-indigo-navy">
            {signal.headline}
          </h1>
          <p className="mt-2 text-sm text-slate-gray">
            <Link href={`/companies/${company.slug}`} className="font-semibold text-deep-teal underline underline-offset-2">
              {company.name}
            </Link>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <EvidenceStrengthBadge strength={signal.evidence_strength} />
          <VerificationStatusBadge status={signal.verification_status} />
        </div>

        <Card as="section" aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-gray">
            Summary
          </h2>
          <p className="mt-2 text-sm text-ink">{signal.summary}</p>
          <h2 className="mt-4 text-sm font-semibold uppercase tracking-wide text-slate-gray">
            Why it matters
          </h2>
          <p className="mt-2 text-sm text-ink">{signal.why_it_matters}</p>
        </Card>

        <Card as="section" aria-labelledby="sources-heading">
          <h2 id="sources-heading" className="text-lg font-semibold text-indigo-navy">
            Sources
          </h2>
          <div className="mt-3">
            <SourceList signal={signal} sources={sources} />
          </div>
        </Card>
      </div>
    </section>
  );
}
