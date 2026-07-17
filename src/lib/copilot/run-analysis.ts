import { getSessionSupabaseClient } from "@/lib/supabase/session-client";
import { getCopilotPromptContext } from "./context";
import { buildAnalysisPrompt, PROMPT_VERSION } from "./prompt";
import { copilotAnalysisOutputSchema } from "./schema";
import {
  callModel,
  resolveModelName,
  ModelNotConfiguredError,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
} from "./client";

export { ModelNotConfiguredError, ModelProviderError, ModelResponseParseError, ModelTimeoutError };

export class UnsupportedResearchItemError extends Error {
  constructor(researchItemId: string) {
    super(`Research item does not support Copilot analysis: ${researchItemId}`);
    this.name = "UnsupportedResearchItemError";
  }
}

export interface RunCopilotAnalysisDeps {
  getContext?: typeof getCopilotPromptContext;
  callModelImpl?: typeof callModel;
  getClient?: typeof getSessionSupabaseClient;
  /** Explicit model override, same precedence slot as ModelCallOptions.model — for injection in tests/callers. */
  model?: string;
}

/**
 * Core, injectable Copilot orchestration — deliberately has no
 * "use server" directive, so it stays hermetically testable under plain
 * `npm test` (mirrors src/lib/review/queue.ts's own separation from
 * actions.ts). src/lib/copilot/actions.ts is a thin "use server" wrapper
 * over this function with real dependencies.
 *
 * Never calls submit_review_action. Never touches research_items,
 * signals, companies, source_documents, signal_evidence, or
 * review_actions — record_copilot_analysis (called here via the session
 * client, never service-role) is the only write, into copilot_analyses
 * only.
 *
 * Model provenance (Cowork/Fable fix, docs/DECISIONS.md D-095): the model
 * name is resolved exactly ONCE here via client.ts's resolveModelName, and
 * that single resolved value is passed both to callModelImpl (so it's the
 * model that actually generates the analysis) and to
 * record_copilot_analysis as p_model (so it's the model actually
 * recorded) — the two can never diverge, because there is no second,
 * independent resolution anywhere in this call path.
 */
export async function runAnalysisAndRecord(researchItemId: string, deps: RunCopilotAnalysisDeps = {}): Promise<string> {
  const getContext = deps.getContext ?? getCopilotPromptContext;
  const callModelImpl = deps.callModelImpl ?? callModel;
  const getClient = deps.getClient ?? getSessionSupabaseClient;
  const resolvedModel = resolveModelName(deps.model);

  const context = await getContext(researchItemId);
  if (!context) {
    throw new UnsupportedResearchItemError(researchItemId);
  }

  const prompt = buildAnalysisPrompt(context);
  const rawText = await callModelImpl(prompt, { model: resolvedModel });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    throw new ModelResponseParseError("Copilot model response was not valid JSON");
  }

  const parsed = copilotAnalysisOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new ModelResponseParseError("Copilot model response did not match the expected schema");
  }

  const supabase = await getClient();
  const { error: rpcError } = await supabase.rpc("record_copilot_analysis", {
    p_research_item_id: researchItemId,
    p_model: resolvedModel,
    p_prompt_version: PROMPT_VERSION,
    p_summary: parsed.data.summary,
    p_risk_flags: parsed.data.riskFlags,
    p_missing_evidence: parsed.data.missingEvidenceQuestions,
    p_suggested_next_step: parsed.data.suggestedNextStep,
    p_confidence: parsed.data.confidence,
    p_limitations: parsed.data.limitations,
  });
  if (rpcError) throw rpcError;

  return "Copilot analysis generated.";
}
