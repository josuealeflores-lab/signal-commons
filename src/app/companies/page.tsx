import type { Metadata } from "next";
import { CompanyFilterForm } from "@/components/companies/CompanyFilterForm";
import { CompanyListItem } from "@/components/companies/CompanyListItem";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterEqualityNote } from "@/components/ui/FilterEqualityNote";
import { COMPANY_SORT_OPTIONS, filterCompanyViews, getAvailableCompanyTypes, getCompanyViews, sortCompanyViews, type CompanySortKey } from "@/lib/data/browse";
import { getSectors } from "@/lib/data/repository";
import type { EvidenceStrength } from "@/lib/data/schema";

export const metadata: Metadata = {
  title: "Companies — Signal Commons",
  description: "Browse the demo company roster across all seven sectors.",
};

interface CompaniesIndexPageProps {
  searchParams: Promise<{
    q?: string;
    sector?: string;
    companyType?: string;
    evidenceStrength?: string;
    sort?: string;
  }>;
}

export default async function CompaniesIndexPage({ searchParams }: CompaniesIndexPageProps) {
  const params = await searchParams;
  const sortKey: CompanySortKey = params.sort === "sector" ? "sector" : "name";
  const hasActiveFilters = Boolean(params.q || params.sector || params.companyType || params.evidenceStrength);

  const [allViews, sectors, companyTypes] = await Promise.all([
    getCompanyViews(),
    getSectors(),
    getAvailableCompanyTypes(),
  ]);
  const filtered = filterCompanyViews(allViews, {
    q: params.q,
    sector: params.sector,
    companyType: params.companyType,
    evidenceStrength: params.evidenceStrength as EvidenceStrength | undefined,
  });
  const sorted = sortCompanyViews(filtered, sortKey);
  const sortExplanation = COMPANY_SORT_OPTIONS.find((option) => option.value === sortKey)?.explanation;

  return (
    <section className="px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-semibold tracking-tight text-indigo-navy">Companies</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-gray">
          The full demo company roster. Company profiles span every evidence stage —
          not every company has a published signal yet.
        </p>

        <div className="mt-6">
          <CompanyFilterForm
            sectors={sectors}
            companyTypes={companyTypes}
            values={{ ...params, sort: sortKey }}
          />
        </div>

        {sortExplanation ? <p className="mt-3 text-xs text-slate-gray">{sortExplanation}</p> : null}
        {hasActiveFilters ? (
          <div className="mt-2">
            <FilterEqualityNote />
          </div>
        ) : null}

        <p className="mt-4 text-xs text-slate-gray">
          {sorted.length} of {allViews.length} companies shown.
        </p>

        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {sorted.length === 0 ? (
            <li className="sm:col-span-2">
              <EmptyState message="No companies match the selected filters." />
            </li>
          ) : (
            sorted.map((view) => (
              <li key={view.company.id}>
                <CompanyListItem view={view} />
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
