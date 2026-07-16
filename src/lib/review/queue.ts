import { getSessionSupabaseClient } from "@/lib/supabase/session-client";

/**
 * Reviewer-facing reads, using ONLY the session-aware client
 * (session-client.ts) — never the anon/publishable client (which can't see
 * drafts) and never the service-role client. RLS's reviewer-only SELECT
 * policies (docs/DECISIONS.md migration for Milestone 4) are what actually
 * allow these queries to see draft/in_review content; there is no
 * additional filtering here beyond what the caller's own session is
 * authorized to see.
 *
 * M6D (docs/DECISIONS.md D-094): this file defines its own reviewer
 * view-model types (ReviewSignal/ReviewSourceDocument/ReviewCompany)
 * instead of reusing src/lib/data/schema.ts's Signal/SourceDocument types.
 * Those seed-locked zod schemas type `is_demo` as the literal `true`
 * (correct for validating seed/demo-data.json, where every record really is
 * demo data) — reusing them here previously caused mapSignalRow to
 * hardcode `is_demo: true` on every signal regardless of the row's real
 * value (the exact bug 20260714230602_m6a_schema_rls_and_publish_invariant.sql's
 * own comment named as a "later, separate step"). A real, is_demo=false
 * connector-created signal would have rendered as demo data in this UI.
 */

export interface ReviewSignalEvidence {
  source_document_id: string;
  support_type: string;
  claim_type: string;
  supporting_passage: string;
}

export interface ReviewSignal {
  id: string;
  company_id: string;
  signal_type: string;
  headline: string;
  summary: string;
  why_it_matters: string;
  occurred_at: string | null;
  detected_at: string;
  evidence_strength: "low" | "medium" | "high";
  verification_status: "unverified" | "partially_verified" | "verified" | "disputed" | "rejected";
  publication_status: "draft" | "in_review" | "published" | "archived";
  is_demo: boolean;
  created_by_type: "human" | "ai" | "import";
  evidence: ReviewSignalEvidence[];
}

export interface ReviewSourceDocument {
  id: string;
  canonical_url: string;
  source_title: string;
  publisher: string;
  source_type: string;
  source_tier: string;
  published_at: string | null;
  retrieved_at: string;
  is_demo: boolean;
}

export interface ReviewCompany {
  id: string;
  name: string;
  is_demo: boolean;
  publication_status: "draft" | "in_review" | "published" | "archived";
}

export interface ResearchItem {
  id: string;
  item_type: string;
  payload: { target_table: string; target_id: string };
  status: string;
  priority: string;
  assigned_to: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewActionRecord {
  id: string;
  research_item_id: string;
  reviewer_id: string;
  action: string;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  reviewer_note: string | null;
  created_at: string;
}

export interface ResearchItemDetail {
  item: ResearchItem;
  signal: ReviewSignal;
  company: ReviewCompany;
  sources: ReviewSourceDocument[];
  history: ReviewActionRecord[];
}

const RESEARCH_ITEM_COLUMNS = "id, item_type, payload, status, priority, assigned_to, is_demo, created_at, updated_at";
const SIGNAL_COLUMNS =
  "id, company_id, signal_type, headline, summary, why_it_matters, occurred_at, detected_at, evidence_strength, verification_status, publication_status, is_demo, created_by_type, signal_evidence(source_document_id, support_type, claim_type, supporting_passage)";
const SOURCE_DOCUMENT_COLUMNS =
  "id, canonical_url, source_title, publisher, source_type, source_tier, published_at, retrieved_at, is_demo";
const COMPANY_COLUMNS = "id, name, is_demo, publication_status";
const REVIEW_ACTION_COLUMNS = "id, research_item_id, reviewer_id, action, before_state, after_state, reviewer_note, created_at";

interface SignalRow {
  id: string;
  company_id: string;
  signal_type: string;
  headline: string;
  summary: string;
  why_it_matters: string;
  occurred_at: string | null;
  detected_at: string;
  evidence_strength: ReviewSignal["evidence_strength"];
  verification_status: ReviewSignal["verification_status"];
  publication_status: ReviewSignal["publication_status"];
  is_demo: boolean;
  created_by_type: ReviewSignal["created_by_type"];
  signal_evidence: ReviewSignalEvidence[];
}

/** Pure, exported for hermetic testing — no DB call, just the row-shape mapping. */
export function mapSignalRow(row: SignalRow): ReviewSignal {
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
    is_demo: row.is_demo,
    created_by_type: row.created_by_type,
    evidence: row.signal_evidence,
  };
}

/**
 * Pure, exported for hermetic testing. The current reviewer detail view
 * only knows how to render a `new_signal` item pointing at a `signals` row
 * (Milestone 4/6D scope, matching submit_review_action's own item_type
 * gate) -- this guards against blindly treating `payload.target_id` as a
 * signal id for any other item_type/target_table shape, which would
 * previously either mismatch a query or silently resolve an unrelated row.
 */
export function isSupportedResearchItem(item: Pick<ResearchItem, "item_type" | "payload">): boolean {
  return item.item_type === "new_signal" && item.payload?.target_table === "signals";
}

/** Every pending/needs_more_evidence/approved/rejected/disputed item a reviewer can see. */
export async function getResearchQueue(): Promise<ResearchItem[]> {
  const supabase = await getSessionSupabaseClient();
  const { data, error } = await supabase
    .from("research_items")
    .select(RESEARCH_ITEM_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ResearchItem[];
}

/**
 * The evidence-packet view for one research item: the item itself, its
 * target signal's full fields, the signal's linked company, linked source
 * documents, and its full review_actions history (newest first).
 *
 * Returns undefined (leading to a 404, same as a genuinely missing id) both
 * when the item doesn't exist and when its item_type/payload shape isn't
 * one this detail view supports yet -- see isSupportedResearchItem.
 */
export async function getResearchItemById(id: string): Promise<ResearchItemDetail | undefined> {
  const supabase = await getSessionSupabaseClient();

  const { data: itemData, error: itemError } = await supabase
    .from("research_items")
    .select(RESEARCH_ITEM_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!itemData) return undefined;
  const item = itemData as unknown as ResearchItem;

  if (!isSupportedResearchItem(item)) return undefined;

  const { data: signalData, error: signalError } = await supabase
    .from("signals")
    .select(SIGNAL_COLUMNS)
    .eq("id", item.payload.target_id)
    .maybeSingle();
  if (signalError) throw signalError;
  if (!signalData) return undefined;
  const signal = mapSignalRow(signalData as unknown as SignalRow);

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select(COMPANY_COLUMNS)
    .eq("id", signal.company_id)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!companyData) return undefined;
  const company = companyData as unknown as ReviewCompany;

  const sourceIds = signal.evidence.map((evidence) => evidence.source_document_id);
  let sources: ReviewSourceDocument[] = [];
  if (sourceIds.length > 0) {
    const { data: sourceRows, error: sourcesError } = await supabase
      .from("source_documents")
      .select(SOURCE_DOCUMENT_COLUMNS)
      .in("id", sourceIds);
    if (sourcesError) throw sourcesError;
    sources = (sourceRows ?? []) as unknown as ReviewSourceDocument[];
  }

  const { data: historyData, error: historyError } = await supabase
    .from("review_actions")
    .select(REVIEW_ACTION_COLUMNS)
    .eq("research_item_id", id)
    .order("created_at", { ascending: false });
  if (historyError) throw historyError;

  return {
    item,
    signal,
    company,
    sources,
    history: (historyData ?? []) as unknown as ReviewActionRecord[],
  };
}

export interface QueueCounts {
  pending: number;
  needsMoreEvidence: number;
  approved: number;
  rejected: number;
  disputed: number;
}

/** Queue counts by status, for the reviewer dashboard (docs/PRODUCT_REQUIREMENTS.md §9). */
export async function getQueueCounts(): Promise<QueueCounts> {
  const items = await getResearchQueue();
  return {
    pending: items.filter((i) => i.status === "pending").length,
    needsMoreEvidence: items.filter((i) => i.status === "needs_more_evidence").length,
    approved: items.filter((i) => i.status === "approved").length,
    rejected: items.filter((i) => i.status === "rejected").length,
    disputed: items.filter((i) => i.status === "disputed").length,
  };
}

/** This reviewer's own recent review_actions, for the reviewer dashboard. */
export async function getRecentReviewActions(limit = 10): Promise<ReviewActionRecord[]> {
  const supabase = await getSessionSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("review_actions")
    .select(REVIEW_ACTION_COLUMNS)
    .eq("reviewer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReviewActionRecord[];
}
