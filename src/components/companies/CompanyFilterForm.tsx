import { getCompanyTypeLabel } from "@/lib/content/labels";
import { COMPANY_SORT_OPTIONS, type CompanySortKey } from "@/lib/data/browse";
import type { Sector } from "@/lib/data/schema";

export interface CompanyFilterFormProps {
  sectors: Sector[];
  companyTypes: string[];
  values: {
    q?: string;
    sector?: string;
    companyType?: string;
    evidenceStrength?: string;
    sort?: CompanySortKey;
  };
}

/**
 * Plain GET form — no client JS required. Submitting re-navigates to
 * /companies?... and the page re-filters server-side (docs/DECISIONS.md
 * D-027).
 */
export function CompanyFilterForm({ sectors, companyTypes, values }: CompanyFilterFormProps) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="q" className="text-xs font-medium text-slate-gray">
          Search
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={values.q ?? ""}
          placeholder="Search by name or summary"
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="sector" className="text-xs font-medium text-slate-gray">
          Sector
        </label>
        <select
          id="sector"
          name="sector"
          defaultValue={values.sector ?? ""}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          <option value="">All sectors</option>
          {sectors.map((sector) => (
            <option key={sector.slug} value={sector.slug}>
              {sector.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="companyType" className="text-xs font-medium text-slate-gray">
          Company type
        </label>
        <select
          id="companyType"
          name="companyType"
          defaultValue={values.companyType ?? ""}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          <option value="">All company types</option>
          {companyTypes.map((type) => (
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
          defaultValue={values.evidenceStrength ?? ""}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          <option value="">Any</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="sort" className="text-xs font-medium text-slate-gray">
          Sort
        </label>
        <select
          id="sort"
          name="sort"
          defaultValue={values.sort ?? "name"}
          className="rounded-md border border-border-subtle px-2 py-1.5 text-sm text-ink"
        >
          {COMPANY_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="rounded-md bg-deep-teal px-4 py-1.5 text-sm font-semibold text-white"
      >
        Apply filters
      </button>
    </form>
  );
}
