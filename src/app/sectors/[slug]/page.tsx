import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompanyListItem } from "@/components/companies/CompanyListItem";
import { SectorIcon } from "@/components/dashboard/SectorIcon";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCompanyTypeLabel } from "@/lib/content/labels";
import { filterCompanyViews, getSectorDetailView } from "@/lib/data/browse";
import type { EvidenceStrength } from "@/lib/data/schema";

interface SectorDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ companyType?: string; evidenceStrength?: string }>;
}

export async function generateMetadata({ params }: SectorDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const view = await getSectorDetailView(slug);
  if (!view) return {};
  return {
    title: `${view.sector.name} — Signal Commons`,
    description: `Companies and recent signals in the ${view.sector.name} sector.`,
  };
}

export default async function SectorDetailPage({ params, searchParams }: SectorDetailPageProps) {
  const { slug } = await params;
  const view = await getSectorDetailView(slug);
  if (!view) notFound();

  const { companyType, evidenceStrength } = await searchParams;
  const availableCompanyTypes = [...new Set(view.companies.map((c) => c.company.company_type))].sort();
  const hasActiveFilters = Boolean(companyType || evidenceStrength);

  const filteredCompanies = filterCompanyViews(view.companies, {
    companyType,
    evidenceStrength: evidenceStrength as EvidenceStrength | undefined,
  });

  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-light-gray text-deep-teal"
          >
            <SectorIcon iconKey={view.sector.icon_key} className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-indigo-navy">
              {view.sector.name}
            </h1>
            <p className="text-sm text-slate-gray">
              One of the seven sectors Signal Commons tracks with equal prominence.
            </p>
          </div>
        </div>

        <form className="mt-6 flex flex-wrap items-end gap-3" method="get">
          <div className="flex flex-col gap-1">
            <label htmlFor="companyType" className="text-xs font-medium text-slate-gray">
              Company type
            </label>
            <select
              id="companyType"
              name="companyType"
              defaultValue={companyType ?? ""}
              className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
            >
              <option value="">All company types</option>
              {availableCompanyTypes.map((type) => (
                <option key={type} value={type}>
                  {getCompanyTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="evidenceStrength" className="text-xs font-medium text-slate-gray">
              Evidence strength
            </label>
            <select
              id="evidenceStrength"
              name="evidenceStrength"
              defaultValue={evidenceStrength ?? ""}
              className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
            >
              <option value="">Any</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-deep-teal px-4 py-1.5 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
        </form>

        <h2 className="mt-8 text-lg font-semibold text-indigo-navy">Companies</h2>
        {hasActiveFilters ? (
          <p className="mt-1 text-xs text-slate-gray">
            Filtered — this sector has 3 companies in total.
          </p>
        ) : null}
        <ul className="mt-3 flex flex-col gap-3">
          {filteredCompanies.length === 0 ? (
            <li>
              <EmptyState message="No companies in this sector match the selected filters." />
            </li>
          ) : (
            filteredCompanies.map((companyView) => (
              <li key={companyView.company.id}>
                <CompanyListItem view={companyView} />
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
