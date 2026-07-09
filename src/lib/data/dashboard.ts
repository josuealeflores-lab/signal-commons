import { getCompanies, getCompaniesBySector, getMeta, getPublishedSignals, getSectors } from "./repository";
import type { Company, Sector, Signal } from "./schema";

function dayOfYear(isoDate: string): number {
  const date = new Date(isoDate);
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - startOfYear) / msPerDay) + 1;
}

function monthBucket(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface KpiSummary {
  companyProfiles: number;
  publishedSignals: number;
  highConfidenceSignals: number;
  sectorsCovered: number;
}

/**
 * companyProfiles counts the full published company roster (21) — company
 * records are independently "published" regardless of their signal's
 * status. The other three KPIs are strictly gated to published signals
 * only (docs/DECISIONS.md D-021).
 */
export async function getKpiSummary(): Promise<KpiSummary> {
  const [companies, publishedSignals, sectors] = await Promise.all([
    getCompanies(),
    getPublishedSignals(),
    getSectors(),
  ]);
  return {
    companyProfiles: companies.length,
    publishedSignals: publishedSignals.length,
    highConfidenceSignals: publishedSignals.filter((s) => s.evidence_strength === "high").length,
    sectorsCovered: sectors.length,
  };
}

export interface SectorOverviewItem {
  sector: Sector;
  companyCount: number;
}

/** Uses the full company roster, not signal-gated — see getKpiSummary doc comment. */
export async function getSectorOverview(): Promise<SectorOverviewItem[]> {
  const [sectors, companies] = await Promise.all([getSectors(), getCompanies()]);

  const countBySectorSlug = new Map<string, number>();
  for (const company of companies) {
    countBySectorSlug.set(company.primary_sector_slug, (countBySectorSlug.get(company.primary_sector_slug) ?? 0) + 1);
  }

  return sectors.map((sector) => ({
    sector,
    companyCount: countBySectorSlug.get(sector.slug) ?? 0,
  }));
}

export interface EmergingSignalView {
  signal: Signal;
  company: Company;
  sector: Sector | undefined;
}

/**
 * Top N most recent PUBLISHED signals, sorted by occurred_at descending.
 * Draft signals are never included. Reframed from "Emerging This Week" to
 * "Recently Emerging" (D-018) since the fixed seed dates don't fall within
 * a literal trailing-7-day window of meta.as_of.
 */
export async function getRecentlyEmerging(limit = 5): Promise<EmergingSignalView[]> {
  const [companies, publishedSignals, sectors] = await Promise.all([getCompanies(), getPublishedSignals(), getSectors()]);
  const companiesById = new Map(companies.map((c) => [c.id, c]));
  const sectorsBySlug = new Map(sectors.map((sector) => [sector.slug, sector]));

  const sorted = publishedSignals
    .filter((signal) => companiesById.has(signal.company_id))
    .slice()
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))
    .slice(0, limit);

  return sorted.map((signal) => {
    const company = companiesById.get(signal.company_id) as Company;
    return {
      signal,
      company,
      sector: sectorsBySlug.get(company.primary_sector_slug),
    };
  });
}

export interface ActivityBucket {
  month: string;
  count: number;
}

/** Monthly counts of PUBLISHED signals only, sorted chronologically. */
export async function getActivitySeries(): Promise<ActivityBucket[]> {
  const publishedSignals = await getPublishedSignals();
  const counts = new Map<string, number>();
  for (const signal of publishedSignals) {
    const bucket = monthBucket(signal.occurred_at);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, count]) => ({ month, count }));
}

export interface CompanySpotlightView {
  company: Company;
  sector: Sector | undefined;
  signal: Signal;
  stillMissingNote: string;
}

const STILL_MISSING_NOTES: Partial<Record<string, string>> = {
  partially_verified: "Independent corroboration is limited in this demo record.",
  unverified: "The demo source supports the event, but not broader adoption or impact.",
};

/**
 * Deterministic selection based on meta.as_of (not real time, not random),
 * so server-rendered output is stable. Picks the sector at
 * dayOfYear(as_of) % 7, then that sector's company whose PUBLISHED signal
 * has verification_status "partially_verified" (D-006/D-021: never a draft
 * company). "What's still missing" uses a generic, source-grounded
 * template — never invented per-company specifics (D-024 review point 6).
 */
export async function getCompanySpotlight(): Promise<CompanySpotlightView | undefined> {
  const [sectors, meta] = await Promise.all([getSectors(), getMeta()]);
  const sectorIndex = dayOfYear(meta.as_of) % sectors.length;
  const sector = sectors[sectorIndex];

  const [sectorCompanies, publishedSignals] = await Promise.all([
    getCompaniesBySector(sector.slug),
    getPublishedSignals(),
  ]);

  for (const company of sectorCompanies) {
    const signal = publishedSignals.find(
      (s) => s.company_id === company.id && s.verification_status === "partially_verified",
    );
    if (signal) {
      return {
        company,
        sector,
        signal,
        stillMissingNote:
          STILL_MISSING_NOTES[signal.verification_status] ??
          "Independent corroboration is limited in this demo record.",
      };
    }
  }
  return undefined;
}
