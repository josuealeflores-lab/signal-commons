import { getSessionSupabaseClient } from "@/lib/supabase/session-client";
import type { Signal, SourceDocument } from "@/lib/data/schema";

/**
 * Reviewer-facing reads, using ONLY the session-aware client
 * (session-client.ts) — never the anon/publishable client (which can't see
 * drafts) and never the service-role client. RLS's reviewer-only SELECT
 * policies (docs/DECISIONS.md migration for Milestone 4) are what actually
 * allow these queries to see draft/in_review content; there is no
 * additional filtering here beyond what the caller's own session is
 * authorized to see.
 */

export interface ResearchItem {
  id: string;
  item_type: string;
  payload: { target_table: string; target_id: string };
  status: string;
  priority: string;
  assigned_to: string | null;
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
  signal: Signal;
  sources: SourceDocument[];
  history: ReviewActionRecord[];
}

const RESEARCH_ITEM_COLUMNS = "id, item_type, payload, status, priority, assigned_to, created_at, updated_at";
const SIGNAL_COLUMNS =
  "id, company_id, signal_type, headline, summary, why_it_matters, occurred_at, detected_at, evidence_strength, verification_status, publication_status, is_demo, created_by_type, signal_evidence(source_document_id, support_type, claim_type, supporting_passage)";
const SOURCE_DOCUMENT_COLUMNS =
  "id, canonical_url, source_title, publisher, source_type, source_tier, published_at, retrieved_at, is_demo";
const REVIEW_ACTION_COLUMNS = "id, research_item_id, reviewer_id, action, before_state, after_state, reviewer_note, created_at";

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
 * target signal's full fields, linked source documents, and its full
 * review_actions history (oldest problems first would hide the most
 * relevant recent entry, so newest-first).
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

  const { data: signalData, error: signalError } = await supabase
    .from("signals")
    .select(SIGNAL_COLUMNS)
    .eq("id", item.payload.target_id)
    .maybeSingle();
  if (signalError) throw signalError;
  if (!signalData) return undefined;
  const signal = mapSignalRow(signalData as unknown as SignalRow);

  const sourceIds = signal.evidence.map((evidence) => evidence.source_document_id);
  let sources: SourceDocument[] = [];
  if (sourceIds.length > 0) {
    const { data: sourceRows, error: sourcesError } = await supabase
      .from("source_documents")
      .select(SOURCE_DOCUMENT_COLUMNS)
      .in("id", sourceIds);
    if (sourcesError) throw sourcesError;
    sources = (sourceRows ?? []) as unknown as SourceDocument[];
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
