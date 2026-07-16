import { getSessionSupabaseClient } from "@/lib/supabase/session-client";
import { isSupportedResearchItem } from "@/lib/review/queue";
import type { SuggestedNextStep } from "./schema";

/**
 * Reviewer-facing reads for the M7 Copilot, using ONLY the session-aware
 * client (session-client.ts) — never the service-role client. RLS's
 * reviewer-only SELECT policies are what actually allow these queries to
 * see draft/in_review content.
 *
 * docs/DECISIONS.md D-095: this file defines a DEDICATED narrow read
 * (getCopilotPromptContext) rather than reusing
 * src/lib/review/queue.ts's getResearchItemById/ResearchItemDetail. That
 * type carries the full review-action audit history (each entry
 * including the reviewer's own note and its snapshot state pair) —
 * fields that must never reach the model. CopilotPromptContext's own
 * TypeScript shape has no field for any of that at all, so the exclusion
 * is a type-level guarantee rather than a convention the prompt builder
 * has to remember to honor.
 *
 * getCopilotAnalyses is a separate concern (displaying past analyses on
 * the detail page) and does not feed the prompt builder — it only reads
 * copilot_analyses's own already-minimized columns.
 */

export interface CopilotSignalContext {
  headline: string;
  summary: string;
  why_it_matters: string;
  evidence_strength: "low" | "medium" | "high";
  verification_status: "unverified" | "partially_verified" | "verified" | "disputed" | "rejected";
}

export interface CopilotCompanyContext {
  name: string;
  publication_status: "draft" | "in_review" | "published" | "archived";
  is_demo: boolean;
}

export interface CopilotSourceDocumentContext {
  source_title: string;
  publisher: string;
  source_type: string;
  published_at: string | null;
  excerpt: string | null;
}

export interface CopilotEvidenceContext {
  supporting_passage: string;
}

export interface CopilotPromptContext {
  researchItemId: string;
  signal: CopilotSignalContext;
  company: CopilotCompanyContext;
  sources: CopilotSourceDocumentContext[];
  evidence: CopilotEvidenceContext[];
}

const SIGNAL_CONTEXT_COLUMNS =
  "company_id, headline, summary, why_it_matters, evidence_strength, verification_status, signal_evidence(source_document_id, supporting_passage)";
const COMPANY_CONTEXT_COLUMNS = "name, publication_status, is_demo";
const SOURCE_DOCUMENT_CONTEXT_COLUMNS = "id, source_title, publisher, source_type, published_at, excerpt";

interface SignalContextRow extends CopilotSignalContext {
  company_id: string;
  signal_evidence: { source_document_id: string; supporting_passage: string }[];
}

/**
 * Narrow read of exactly the fields the Copilot prompt is allowed to see.
 * Returns undefined for a missing item, an unsupported item_type/payload
 * shape (same gate queue.ts's isSupportedResearchItem enforces), a missing
 * target signal, or a missing linked company — never throws for these
 * expected "not analyzable" cases, matching getResearchItemById's own
 * undefined-means-404-or-unsupported convention.
 */
export async function getCopilotPromptContext(researchItemId: string): Promise<CopilotPromptContext | undefined> {
  const supabase = await getSessionSupabaseClient();

  const { data: itemData, error: itemError } = await supabase
    .from("research_items")
    .select("id, item_type, payload")
    .eq("id", researchItemId)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!itemData) return undefined;

  const item = itemData as unknown as {
    id: string;
    item_type: string;
    payload: { target_table: string; target_id: string };
  };
  if (!isSupportedResearchItem(item)) return undefined;

  const targetId = item.payload.target_id;
  if (!targetId) return undefined;

  const { data: signalData, error: signalError } = await supabase
    .from("signals")
    .select(SIGNAL_CONTEXT_COLUMNS)
    .eq("id", targetId)
    .maybeSingle();
  if (signalError) throw signalError;
  if (!signalData) return undefined;

  const signalRow = signalData as unknown as SignalContextRow;

  const { data: companyData, error: companyError } = await supabase
    .from("companies")
    .select(COMPANY_CONTEXT_COLUMNS)
    .eq("id", signalRow.company_id)
    .maybeSingle();
  if (companyError) throw companyError;
  if (!companyData) return undefined;

  const sourceIds = signalRow.signal_evidence.map((e) => e.source_document_id);
  let sources: CopilotSourceDocumentContext[] = [];
  if (sourceIds.length > 0) {
    const { data: sourceRows, error: sourcesError } = await supabase
      .from("source_documents")
      .select(SOURCE_DOCUMENT_CONTEXT_COLUMNS)
      .in("id", sourceIds);
    if (sourcesError) throw sourcesError;
    sources = ((sourceRows ?? []) as unknown as (CopilotSourceDocumentContext & { id: string })[]).map(
      ({ source_title, publisher, source_type, published_at, excerpt }) => ({
        source_title,
        publisher,
        source_type,
        published_at,
        excerpt,
      }),
    );
  }

  return {
    researchItemId,
    signal: {
      headline: signalRow.headline,
      summary: signalRow.summary,
      why_it_matters: signalRow.why_it_matters,
      evidence_strength: signalRow.evidence_strength,
      verification_status: signalRow.verification_status,
    },
    company: companyData as unknown as CopilotCompanyContext,
    sources,
    evidence: signalRow.signal_evidence.map(({ supporting_passage }) => ({ supporting_passage })),
  };
}

export interface CopilotAnalysisRecord {
  id: string;
  research_item_id: string;
  model: string;
  prompt_version: string;
  summary: string;
  risk_flags: string[];
  missing_evidence: string[];
  suggested_next_step: SuggestedNextStep;
  confidence: "low" | "medium" | "high";
  limitations: string | null;
  created_at: string;
}

const COPILOT_ANALYSIS_COLUMNS =
  "id, research_item_id, model, prompt_version, summary, risk_flags, missing_evidence, suggested_next_step, confidence, limitations, created_at";

/** Past Copilot analyses for one research item, newest first — display only, never fed back into the prompt. */
export async function getCopilotAnalyses(researchItemId: string): Promise<CopilotAnalysisRecord[]> {
  const supabase = await getSessionSupabaseClient();
  const { data, error } = await supabase
    .from("copilot_analyses")
    .select(COPILOT_ANALYSIS_COLUMNS)
    .eq("research_item_id", researchItemId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CopilotAnalysisRecord[];
}
