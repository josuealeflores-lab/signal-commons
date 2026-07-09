import {
  getCompanies,
  getCompaniesBySector,
  getCompanySector,
  getPublishedSignals,
  getPublishedSignalsForCompany,
  getSectorBySlug,
  getSourceDocumentsForSignal,
} from "./repository";
import type { Company, EvidenceStrength, Sector, Signal, SourceDocument, VerificationStatus } from "./schema";

/**
 * Joined "view" types and filter/sort logic for the browse routes
 * (/sectors, /companies, /signals). Kept separate from dashboard.ts, which
 * is specifically shaped for the dashboard's own widgets.
 *
 * Public-safe rule (docs/DECISIONS.md D-021, unchanged from Milestone 1):
 * company existence uses the full published-company roster; every
 * signal-derived field is gated to getPublishedSignals() only. A company
 * whose only signal is a draft simply has an empty `signals` array here —
 * the draft data structurally never reaches these views, not just hidden
 * by a conditional.
 */

function monthBucket(isoDate: string): string {
  const date = new Date(isoDate);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface CompanyView {
  company: Company;
  sector: Sector | undefined;
  /** Published signals only, sorted most-recent-first. Empty if none yet. */
  signals: Signal[];
  /** signals[0], provided for convenience in list rendering/filtering. */
  primarySignal: Signal | undefined;
}

export function getCompanyViews(): CompanyView[] {
  return getCompanies().map((company) => {
    const signals = getPublishedSignalsForCompany(company.id)
      .slice()
      .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
    return {
      company,
      sector: getCompanySector(company),
      signals,
      primarySignal: signals[0],
    };
  });
}

export function getCompanyView(slug: string): CompanyView | undefined {
  return getCompanyViews().find((view) => view.company.slug === slug);
}

export interface SignalView {
  signal: Signal;
  company: Company;
  sector: Sector | undefined;
  sources: SourceDocument[];
}

/** Published signals only (14) — never includes a draft. */
export function getSignalViews(): SignalView[] {
  const companiesById = new Map(getCompanies().map((c) => [c.id, c]));

  return getPublishedSignals()
    .filter((signal) => companiesById.has(signal.company_id))
    .map((signal) => {
      const company = companiesById.get(signal.company_id) as Company;
      return {
        signal,
        company,
        sector: getCompanySector(company),
        sources: getSourceDocumentsForSignal(signal),
      };
    });
}

/**
 * Undefined for both a draft signal id and a nonexistent id — identical
 * behavior, so /signals/[id] can call notFound() in both cases without
 * distinguishing them.
 */
export function getSignalView(id: string): SignalView | undefined {
  return getSignalViews().find((view) => view.signal.id === id);
}

export interface SectorDetailView {
  sector: Sector;
  companies: CompanyView[];
}

export function getSectorDetailView(slug: string): SectorDetailView | undefined {
  const sector = getSectorBySlug(slug);
  if (!sector) return undefined;

  const companyIds = new Set(getCompaniesBySector(slug).map((c) => c.id));
  const companies = getCompanyViews().filter((view) => companyIds.has(view.company.id));
  return { sector, companies };
}

export interface CompanyFilters {
  q?: string;
  sector?: string;
  companyType?: string;
  evidenceStrength?: EvidenceStrength;
}

export function filterCompanyViews(views: CompanyView[], filters: CompanyFilters): CompanyView[] {
  const q = filters.q?.trim().toLowerCase();
  return views.filter((view) => {
    if (q) {
      const haystack = `${view.company.name} ${view.company.summary}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.sector && view.company.primary_sector_slug !== filters.sector) return false;
    if (filters.companyType && view.company.company_type !== filters.companyType) return false;
    if (filters.evidenceStrength && view.primarySignal?.evidence_strength !== filters.evidenceStrength) {
      return false;
    }
    return true;
  });
}

export interface SignalFilters {
  sector?: string;
  signalType?: string;
  month?: string;
  evidenceStrength?: EvidenceStrength;
  verificationStatus?: VerificationStatus;
}

export function filterSignalViews(views: SignalView[], filters: SignalFilters): SignalView[] {
  return views.filter((view) => {
    if (filters.sector && view.company.primary_sector_slug !== filters.sector) return false;
    if (filters.signalType && view.signal.signal_type !== filters.signalType) return false;
    if (filters.month && monthBucket(view.signal.occurred_at) !== filters.month) return false;
    if (filters.evidenceStrength && view.signal.evidence_strength !== filters.evidenceStrength) return false;
    if (filters.verificationStatus && view.signal.verification_status !== filters.verificationStatus) {
      return false;
    }
    return true;
  });
}

/** Derived from the loaded dataset, not hardcoded (docs/DECISIONS.md D-026). */
export function getAvailableSignalTypes(): string[] {
  return [...new Set(getSignalViews().map((view) => view.signal.signal_type))].sort();
}

/** Derived from the loaded dataset, not hardcoded (docs/DECISIONS.md D-026). */
export function getAvailableCompanyTypes(): string[] {
  return [...new Set(getCompanies().map((company) => company.company_type))].sort();
}

/** Derived from the loaded dataset's actual signal months. */
export function getAvailableMonths(): string[] {
  return [...new Set(getSignalViews().map((view) => monthBucket(view.signal.occurred_at)))].sort();
}

export type CompanySortKey = "name" | "sector";

/** Only two options, each with a visible caption in the UI (PRODUCT_REQUIREMENTS "sorting with an explicit explanation"). */
export function sortCompanyViews(views: CompanyView[], sortKey: CompanySortKey): CompanyView[] {
  const sorted = [...views];
  if (sortKey === "sector") {
    sorted.sort((a, b) => {
      const orderA = a.sector?.display_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sector?.display_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.company.name.localeCompare(b.company.name);
    });
  } else {
    sorted.sort((a, b) => a.company.name.localeCompare(b.company.name));
  }
  return sorted;
}

/** Only two options, matching sortCompanyViews's sortKey, for the filter form's <select>. */
export const COMPANY_SORT_OPTIONS: { value: CompanySortKey; label: string; explanation: string }[] = [
  { value: "name", label: "Name (A–Z)", explanation: "Companies are sorted alphabetically by name." },
  {
    value: "sector",
    label: "Sector order",
    explanation: "Companies are grouped by sector in the same fixed order shown on the dashboard, then by name.",
  },
];
