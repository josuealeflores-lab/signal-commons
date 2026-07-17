import { getSessionSupabaseClient } from "@/lib/supabase/session-client";
import { getCopilotPromptContext, type CopilotPromptContext } from "@/lib/copilot/context";

/**
 * M8A's read-only tool set (docs/DECISIONS.md D-096 §6). Exactly two
 * tools exist; both use ONLY the session client (never service-role),
 * rely entirely on existing reviewer-only RLS SELECT policies, return
 * only explicitly projected minimized fields, and never write anything
 * under any input. Neither tool imports or can reach
 * submit_review_action or record_copilot_analysis. Neither returns
 * research_items.payload, review_actions history, reviewer_note, or
 * either side of review_actions's before/after snapshot pair.
 *
 * tests/lib/digest/tools.test.ts proves the registry contains exactly
 * these two tools and no write/action tool of any kind.
 */

export const LIST_QUEUE_ITEMS_TOOL = "list_queue_items" as const;
export const GET_ITEM_CONTEXT_TOOL = "get_item_context" as const;

export const DIGEST_TOOL_NAMES = [LIST_QUEUE_ITEMS_TOOL, GET_ITEM_CONTEXT_TOOL] as const;
export type DigestToolName = (typeof DIGEST_TOOL_NAMES)[number];

export interface DigestToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/** Anthropic tool-definition shape (name/description/input_schema JSON Schema) per the bundled claude-api skill's typescript/claude-api/tool-use.md. */
export const DIGEST_TOOL_DEFINITIONS: DigestToolDefinition[] = [
  {
    name: LIST_QUEUE_ITEMS_TOOL,
    description:
      "List a minimized, read-only overview of every pending or needs-more-evidence research queue item, including each item's latest Copilot analysis metadata if one exists. Call this first to see the whole queue before deciding whether to look closer at any single item.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: GET_ITEM_CONTEXT_TOOL,
    description:
      "Get minimized, read-only signal/company/source/evidence context for one research item, if it exists and is visible to the current reviewer. Use sparingly -- only for the items that most need a closer look.",
    input_schema: {
      type: "object",
      properties: {
        researchItemId: { type: "string", description: "The research_items.id to look up." },
      },
      required: ["researchItemId"],
      additionalProperties: false,
    },
  },
];

export interface DigestSignalSummary {
  headline: string;
  verificationStatus: string;
  publicationStatus: string;
}

export interface DigestCompanySummary {
  name: string;
  publicationStatus: string;
  isDemo: boolean;
}

export interface DigestAnalysisSummary {
  createdAt: string;
  suggestedNextStep: string;
  confidence: string;
  summarySnippet: string;
}

export interface DigestQueueItemSummary {
  researchItemId: string;
  createdAt: string;
  itemType: string;
  status: string;
  priority: string;
  isDemo: boolean;
  signal?: DigestSignalSummary;
  company?: DigestCompanySummary;
  latestAnalysis?: DigestAnalysisSummary;
}

const SUMMARY_SNIPPET_MAX_LENGTH = 240;

function toSnippet(text: string): string {
  return text.length > SUMMARY_SNIPPET_MAX_LENGTH ? `${text.slice(0, SUMMARY_SNIPPET_MAX_LENGTH)}…` : text;
}

interface ResearchItemRow {
  id: string;
  item_type: string;
  payload: { target_table?: string; target_id?: string } | null;
  status: string;
  priority: string;
  is_demo: boolean;
  created_at: string;
}

interface SignalRow {
  id: string;
  headline: string;
  verification_status: string;
  publication_status: string;
  company_id: string;
}

interface CompanyRow {
  id: string;
  name: string;
  publication_status: string;
  is_demo: boolean;
}

interface CopilotAnalysisRow {
  research_item_id: string;
  created_at: string;
  suggested_next_step: string;
  confidence: string;
  summary: string;
}

export interface ListQueueItemsDeps {
  getClient?: typeof getSessionSupabaseClient;
}

/**
 * Queue overview: research_items (status pending/needs_more_evidence)
 * joined client-side, via a handful of narrow batched queries, with
 * signals, companies, and each item's latest copilot_analyses row --
 * every field individually named and minimized. Never selects
 * research_items.payload beyond target_table/target_id, never touches
 * review_actions, reviewer_note, before_state, or after_state.
 */
export async function listQueueItems(deps: ListQueueItemsDeps = {}): Promise<DigestQueueItemSummary[]> {
  const getClient = deps.getClient ?? getSessionSupabaseClient;
  const supabase = await getClient();

  const { data: itemRows, error: itemsError } = await supabase
    .from("research_items")
    .select("id, item_type, payload, status, priority, is_demo, created_at")
    .in("status", ["pending", "needs_more_evidence"])
    .order("created_at", { ascending: false });
  if (itemsError) throw itemsError;

  const items = (itemRows ?? []) as unknown as ResearchItemRow[];

  const signalTargets = items
    .filter((item) => item.item_type === "new_signal" && item.payload?.target_table === "signals" && item.payload.target_id)
    .map((item) => ({ researchItemId: item.id, signalId: item.payload!.target_id as string }));

  const signalsById = new Map<string, SignalRow>();
  const companiesById = new Map<string, CompanyRow>();

  const signalIds = [...new Set(signalTargets.map((t) => t.signalId))];
  if (signalIds.length > 0) {
    const { data: signalRows, error: signalsError } = await supabase
      .from("signals")
      .select("id, headline, verification_status, publication_status, company_id")
      .in("id", signalIds);
    if (signalsError) throw signalsError;
    for (const row of (signalRows ?? []) as unknown as SignalRow[]) {
      signalsById.set(row.id, row);
    }

    const companyIds = [...new Set([...signalsById.values()].map((s) => s.company_id))];
    if (companyIds.length > 0) {
      const { data: companyRows, error: companiesError } = await supabase
        .from("companies")
        .select("id, name, publication_status, is_demo")
        .in("id", companyIds);
      if (companiesError) throw companiesError;
      for (const row of (companyRows ?? []) as unknown as CompanyRow[]) {
        companiesById.set(row.id, row);
      }
    }
  }

  const latestAnalysisByItem = new Map<string, DigestAnalysisSummary>();
  if (items.length > 0) {
    const { data: analysisRows, error: analysesError } = await supabase
      .from("copilot_analyses")
      .select("research_item_id, created_at, suggested_next_step, confidence, summary")
      .in(
        "research_item_id",
        items.map((item) => item.id),
      )
      .order("created_at", { ascending: false });
    if (analysesError) throw analysesError;

    for (const row of (analysisRows ?? []) as unknown as CopilotAnalysisRow[]) {
      if (!latestAnalysisByItem.has(row.research_item_id)) {
        latestAnalysisByItem.set(row.research_item_id, {
          createdAt: row.created_at,
          suggestedNextStep: row.suggested_next_step,
          confidence: row.confidence,
          summarySnippet: toSnippet(row.summary),
        });
      }
    }
  }

  const signalIdByItem = new Map(signalTargets.map((t) => [t.researchItemId, t.signalId]));

  return items.map((item) => {
    const signalId = signalIdByItem.get(item.id);
    const signalRow = signalId ? signalsById.get(signalId) : undefined;
    const companyRow = signalRow ? companiesById.get(signalRow.company_id) : undefined;

    return {
      researchItemId: item.id,
      createdAt: item.created_at,
      itemType: item.item_type,
      status: item.status,
      priority: item.priority,
      isDemo: item.is_demo,
      signal: signalRow
        ? {
            headline: signalRow.headline,
            verificationStatus: signalRow.verification_status,
            publicationStatus: signalRow.publication_status,
          }
        : undefined,
      company: companyRow
        ? { name: companyRow.name, publicationStatus: companyRow.publication_status, isDemo: companyRow.is_demo }
        : undefined,
      latestAnalysis: latestAnalysisByItem.get(item.id),
    };
  });
}

export type DigestItemContextResult = { found: true; context: CopilotPromptContext } | { found: false };

export interface GetItemContextDeps {
  getContextImpl?: typeof getCopilotPromptContext;
}

/**
 * Thin, graceful wrapper over M7's own narrow read (getCopilotPromptContext)
 * -- never throws for a missing, unsupported, or not-visible-under-RLS
 * item; returns { found: false } instead, so an invalid/inaccessible id
 * requested by the model cannot break the loop.
 */
export async function getItemContext(researchItemId: string, deps: GetItemContextDeps = {}): Promise<DigestItemContextResult> {
  const getContextImpl = deps.getContextImpl ?? getCopilotPromptContext;
  const context = await getContextImpl(researchItemId);
  if (!context) return { found: false };
  return { found: true, context };
}
