import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import type { Company, Meta, Sector, Signal, SourceDocument } from "./schema";

/**
 * Public-safe data-access rule (docs/DECISIONS.md D-021, D-041):
 * - Company *profiles* are governed by the company record's own
 *   publication_status. RLS on `companies` already restricts anon SELECT
 *   to publication_status = 'published' (the authoritative layer); the
 *   explicit `.eq(...)` filters below are defense-in-depth, not the only
 *   protection.
 * - Anything derived from a *signal* must be gated to published signals
 *   only. RLS on `signals`/`signal_evidence`/`source_documents` already
 *   restricts anon SELECT accordingly — getPublishedSignals() is the only
 *   signal accessor exposed here. There is no draft accessor: the anon
 *   client is structurally incapable of ever seeing a draft row, so a
 *   getDraftSignals()-style function can't be implemented against it
 *   (that's an integration-test/service-role concern, not this module's).
 *
 * Every function in this file uses ONLY getPublicSupabaseClient() (the
 * anon/publishable client) — never the service-role client.
 */

const SECTOR_COLUMNS = "slug, name, icon_key, display_order";
const COMPANY_COLUMNS = "id, slug, name, summary, why_it_matters, company_type, stage, is_demo, publication_status";
const SIGNAL_COLUMNS =
  "id, company_id, signal_type, headline, summary, why_it_matters, occurred_at, detected_at, evidence_strength, verification_status, publication_status, is_demo, created_by_type, signal_evidence(source_document_id, support_type, claim_type, supporting_passage)";
const SOURCE_DOCUMENT_COLUMNS =
  "id, canonical_url, source_title, publisher, source_type, source_tier, published_at, retrieved_at, is_demo";

interface SignalRow {
  id: string;
  company_id: string;
  signal_type: string;
  headline: string;
  summary: string;
  why_it_matters: string;
  occurred_at: string;
  detected_at: string;
  evidence_strength: Signal["evidence_strength"];
  verification_status: Signal["verification_status"];
  publication_status: Signal["publication_status"];
  is_demo: true;
  created_by_type: Signal["created_by_type"];
  signal_evidence: Signal["evidence"];
}

/** Reconstructs the same nested `evidence[]` shape the app already expects. */
function mapSignalRow(row: SignalRow): Signal {
  return {
    id: row.id,
    company_id: row.company_id,
    signal_type: row.signal_type,
    headline: row.headline,
    summary: row.summary,
    why_it_matters: row.why_it_matters,
    occurred_at: row.occurred_at,
    detected_at: row.detected_at,
    evidence_strength: row.evidence_strength,
    verification_status: row.verification_status,
    publication_status: row.publication_status,
    is_demo: true,
    created_by_type: row.created_by_type,
    evidence: row.signal_evidence,
  };
}

interface CompanyRow {
  id: string;
  slug: string;
  name: string;
  summary: string;
  why_it_matters: string;
  company_type: Company["company_type"];
  stage: Company["stage"];
  is_demo: true;
  publication_status: Company["publication_status"];
  company_sectors: { sector_id: string; is_primary: boolean }[];
}

/**
 * `primary_sector_slug` is no longer a flat column (it's derived into the
 * `company_sectors` join table) — this reconstructs the exact same flat
 * `Company` shape the app already expects, so the normalization change is
 * invisible to callers (docs/DECISIONS.md D-040/D-041). Relies on the
 * seed's guarantee that every published company has exactly one primary
 * sector row.
 */
function mapCompanyRow(row: CompanyRow): Company {
  const primary = row.company_sectors.find((cs) => cs.is_primary);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    why_it_matters: row.why_it_matters,
    company_type: row.company_type,
    stage: row.stage,
    is_demo: true,
    publication_status: row.publication_status,
    primary_sector_slug: (primary?.sector_id ?? "") as Company["primary_sector_slug"],
  };
}

export async function getSectors(): Promise<Sector[]> {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from("sectors")
    .select(SECTOR_COLUMNS)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Sector[];
}

export async function getSectorBySlug(slug: string): Promise<Sector | undefined> {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase.from("sectors").select(SECTOR_COLUMNS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return (data as unknown as Sector | null) ?? undefined;
}

export async function getCompanies(): Promise<Company[]> {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from("companies")
    .select(`${COMPANY_COLUMNS}, company_sectors(sector_id, is_primary)`)
    .eq("publication_status", "published");
  if (error) throw error;
  return ((data ?? []) as unknown as CompanyRow[]).map(mapCompanyRow);
}

export async function getCompanyById(id: string): Promise<Company | undefined> {
  return (await getCompanies()).find((company) => company.id === id);
}

export async function getCompanyBySlug(slug: string): Promise<Company | undefined> {
  return (await getCompanies()).find((company) => company.slug === slug);
}

export async function getCompaniesBySector(sectorSlug: string): Promise<Company[]> {
  return (await getCompanies()).filter((company) => company.primary_sector_slug === sectorSlug);
}

export async function getPublishedSignals(): Promise<Signal[]> {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase.from("signals").select(SIGNAL_COLUMNS).eq("publication_status", "published");
  if (error) throw error;
  return ((data ?? []) as unknown as SignalRow[]).map(mapSignalRow);
}

/**
 * Returns undefined for a draft signal's id exactly as it does for a
 * nonexistent id — RLS makes the two indistinguishable (a draft row is
 * never returned to the anon client at all), so a caller (e.g.
 * /signals/[id]) can safely call notFound() either way.
 */
export async function getPublishedSignalById(id: string): Promise<Signal | undefined> {
  return (await getPublishedSignals()).find((signal) => signal.id === id);
}

export async function getSourceDocumentById(id: string): Promise<SourceDocument | undefined> {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from("source_documents")
    .select(SOURCE_DOCUMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as SourceDocument | null) ?? undefined;
}

/**
 * Batched by design: callers with many signals (browse.ts's getSignalViews,
 * the company detail page) collect every needed source_document_id across
 * all their signals first, then call this once, instead of one round trip
 * per signal (docs/DECISIONS.md D-050).
 */
export async function getSourceDocumentsByIds(ids: string[]): Promise<SourceDocument[]> {
  if (ids.length === 0) return [];

  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase.from("source_documents").select(SOURCE_DOCUMENT_COLUMNS).in("id", ids);
  if (error) throw error;
  return (data ?? []) as unknown as SourceDocument[];
}

export async function getMeta(): Promise<Meta> {
  const supabase = getPublicSupabaseClient();
  const { data, error } = await supabase
    .from("app_meta")
    .select("dataset_name, is_demo, warning, generated_for, as_of")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data as unknown as Meta;
}
