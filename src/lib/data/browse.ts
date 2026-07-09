import { getCompanies, getPublishedSignals, getSectorBySlug, getSectors, getSourceDocumentsByIds } from "./repository";
import type { Company, EvidenceStrength, Sector, Signal, SourceDocument, VerificationStatus } from "./schema";

/**
 * Joined "view" types and filter/sort logic for the browse routes
 * (/sectors, /companies, /signals). Kept separate from dashboard.ts, which
 * is specifically shaped for the dashboard's own widgets.
 *
 * Public-safe rule (docs/DECISIONS.md D-021/D-041): company existence uses
 * the full published-company roster; every signal-derived field is gated
 * to getPublishedSignals() only, which itself can only ever return
 * published rows (RLS-enforced). A company whose only signal is a draft
 * simply has an empty `signals` array here — the draft data structurally
 * never reaches these views, not just hidden by a conditional.
 *
 * Batched by design (docs/DECISIONS.md D-050): every function here fetches
 * each related table at most once per call (companies, published signals,
 * sectors, source_documents), then joins them in memory via lookup maps —
 * never one round trip per company/signal in a loop.
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

export async function getCompanyViews(): Promise<CompanyView[]> {
  const [companies, publishedSignals, sectors] = await Promise.all([getCompanies(), getPublishedSignals(), getSectors()]);

  const sectorsBySlug = new Map(sectors.map((sector) => [sector.slug, sector]));
  const signalsByCompanyId = new Map<string, Signal[]>();
  for (const signal of publishedSignals) {
    const existing = signalsByCompanyId.get(signal.company_id);
    if (existing) {
      existing.push(signal);
    } else {
      signalsByCompanyId.set(signal.company_id, [signal]);
    }
  }

  return companies.map((company) => {
    const signals = (signalsByCompanyId.get(company.id) ?? [])
      .slice()
      .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));
    return {
      company,
      sector: sectorsBySlug.get(company.primary_sector_slug),
      signals,
      primarySignal: signals[0],
    };
  });
}

export async function getCompanyView(slug: string): Promise<CompanyView | undefined> {
  return (await getCompanyViews()).find((view) => view.company.slug === slug);
}

export interface SignalView {
  signal: Signal;
  company: Company;
  sector: Sector | undefined;
  sources: SourceDocument[];
}

/** Published signals only (14) — never includes a draft. */
export async function getSignalViews(): Promise<SignalView[]> {
  const [companies, publishedSignals, sectors] = await Promise.all([getCompanies(), getPublishedSignals(), getSectors()]);
  const companiesById = new Map(companies.map((c) => [c.id, c]));
  const sectorsBySlug = new Map(sectors.map((sector) => [sector.slug, sector]));

  const relevant = publishedSignals.filter((signal) => companiesById.has(signal.company_id));

  const allSourceIds = [
    ...new Set(relevant.flatMap((signal) => signal.evidence.map((evidence) => evidence.source_document_id))),
  ];
  const allSources = await getSourceDocumentsByIds(allSourceIds);
  const sourcesById = new Map(allSources.map((doc) => [doc.id, doc]));

  return relevant.map((signal) => {
    const company = companiesById.get(signal.company_id) as Company;
    const sources = signal.evidence
      .map((evidence) => sourcesById.get(evidence.source_document_id))
      .filter((doc): doc is SourceDocument => doc !== undefined);
    return {
      signal,
      company,
      sector: sectorsBySlug.get(company.primary_sector_slug),
      sources,
    };
  });
}

/**
 * Undefined for both a draft signal id and a nonexistent id — identical
 * behavior, so /signals/[id] can call notFound() in both cases without
 * distinguishing them.
 */
export async function getSignalView(id: string): Promise<SignalView | undefined> {
  return (await getSignalViews()).find((view) => view.signal.id === id);
}

export interface SectorDetailView {
  sector: Sector;
  companies: CompanyView[];
}

export async function getSectorDetailView(slug: string): Promise<SectorDetailView | undefined> {
  const sector = await getSectorBySlug(slug);
  if (!sector) return undefined;

  const allCompanyViews = await getCompanyViews();
  const companies = allCompanyViews.filter((view) => view.company.primary_sector_slug === slug);
  return { sector, companies };
}

export interface CompanyFilters {
  q?: string;
  sector?: string;
  companyType?: string;
  evidenceStrength?: EvidenceStrength;
}

/** Pure — operates only on already-fetched arrays, no data access of its own. */
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

/** Pure — operates only on already-fetched arrays, no data access of its own. */
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
export async function getAvailableSignalTypes(): Promise<string[]> {
  return [...new Set((await getSignalViews()).map((view) => view.signal.signal_type))].sort();
}

/** Derived from the loaded dataset, not hardcoded (docs/DECISIONS.md D-026). */
export async function getAvailableCompanyTypes(): Promise<string[]> {
  return [...new Set((await getCompanies()).map((company) => company.company_type))].sort();
}

/** Derived from the loaded dataset's actual signal months. */
export async function getAvailableMonths(): Promise<string[]> {
  return [...new Set((await getSignalViews()).map((view) => monthBucket(view.signal.occurred_at)))].sort();
}

export type CompanySortKey = "name" | "sector";

/**
 * Pure — operates only on an already-fetched array. Only two options, each
 * with a visible caption in the UI (PRODUCT_REQUIREMENTS "sorting with an
 * explicit explanation").
 */
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
