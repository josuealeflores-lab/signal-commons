import { demoData } from "./demo-data";
import type { Company, Sector, Signal, SourceDocument } from "./schema";

/**
 * Public-safe data-access rule (docs/DECISIONS.md D-021):
 * - Company *profiles* are governed by the company record's own
 *   publication_status (all 21 demo companies are "published" at the
 *   company level, independent of their signal's status), so getCompanies()
 *   returns the full roster.
 * - Anything derived from a *signal* must be gated to published signals
 *   only. getPublishedSignals() is the only signal accessor exposed for
 *   public rendering; getDraftSignals() exists solely for internal
 *   consistency checks (e.g. tests) and must never back public UI.
 */

export function getSectors(): Sector[] {
  return [...demoData.sectors].sort((a, b) => a.display_order - b.display_order);
}

export function getSectorBySlug(slug: string): Sector | undefined {
  return demoData.sectors.find((sector) => sector.slug === slug);
}

export function getCompanies(): Company[] {
  return demoData.companies.filter((company) => company.publication_status === "published");
}

export function getCompanyById(id: string): Company | undefined {
  return getCompanies().find((company) => company.id === id);
}

export function getCompanyBySlug(slug: string): Company | undefined {
  return getCompanies().find((company) => company.slug === slug);
}

export function getCompaniesBySector(sectorSlug: string): Company[] {
  return getCompanies().filter((company) => company.primary_sector_slug === sectorSlug);
}

export function getPublishedSignals(): Signal[] {
  return demoData.signals.filter((signal) => signal.publication_status === "published");
}

/** Internal use only (tests/consistency checks) — never render publicly. */
export function getDraftSignals(): Signal[] {
  return demoData.signals.filter((signal) => signal.publication_status === "draft");
}

/**
 * Returns undefined for a draft signal's id exactly as it does for a
 * nonexistent id — the two are indistinguishable from the outside, so a
 * caller (e.g. /signals/[id]) can safely call notFound() either way
 * without leaking which case it was.
 */
export function getPublishedSignalById(id: string): Signal | undefined {
  return getPublishedSignals().find((signal) => signal.id === id);
}

export function getPublishedSignalsForCompany(companyId: string): Signal[] {
  return getPublishedSignals().filter((signal) => signal.company_id === companyId);
}

export function getSourceDocumentById(id: string): SourceDocument | undefined {
  return demoData.source_documents.find((doc) => doc.id === id);
}

export function getSourceDocumentsForSignal(signal: Signal): SourceDocument[] {
  return signal.evidence
    .map((evidence) => getSourceDocumentById(evidence.source_document_id))
    .filter((doc): doc is SourceDocument => doc !== undefined);
}

export function getCompanySector(company: Company): Sector | undefined {
  return getSectorBySlug(company.primary_sector_slug);
}

export function getMeta() {
  return demoData.meta;
}
