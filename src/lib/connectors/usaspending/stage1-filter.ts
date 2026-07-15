import type { Stage1Result, Stage1RuleBranch } from "./types.ts";

/**
 * Ported verbatim from docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md
 * §4.1-§4.6 -- the only classifier in Milestone 6. Rule-based, fully
 * logged. Decides "does this award deserve a reviewer's look?", never
 * "this is an AI signal." Per Decision 7 (that doc), every list below is a
 * candidate to validate, not confirmed-correct: this session's own
 * validation (docs/research/usaspending_validation.METRICS.md) found the
 * >=0.90/>=0.80 recall gate has never been evaluated, and that rule branch
 * 4 (weak term + corroborator) produced ZERO true positives in the one
 * labeled window. Branch 4 stays active (disabling it on an n=0 result
 * would be overfitting), but every result records which branch fired so
 * this remains measurable, not asserted as fixed.
 */

export const STRONG_TERMS = [
  "artificial intelligence",
  "machine learning",
  "deep learning",
  "neural network",
  "natural language processing",
  "computer vision",
  "large language model",
  "generative ai",
  "foundation model",
  "reinforcement learning",
  "autonomous system",
  "agentic",
  "mlops",
] as const;

export const WEAK_TERMS = [
  "ai",
  "algorithm",
  "predictive",
  "analytics",
  "automation",
  "intelligent",
  "smart",
  "model",
  "classifier",
  "agent",
  "chatbot",
  "recognition",
  "optimization",
  "data-driven",
] as const;

const PHRASE_PATTERNS: RegExp[] = [
  /\bAI[- ]?(enabled|powered|based|driven|assisted)\b/i,
  /\b(machine|deep)[- ]learning\b/i,
  /\b(predictive|prescriptive)\s+(analytics|model)\b/i,
  /\b(natural[- ]language|speech|image|facial)\s+(processing|recognition|classification)\b/i,
  /\b(large[- ]language|foundation|diffusion|generative)\s+model\b/i,
  /\b(autonomous|unmanned|self[- ]navigating)\s+(vehicle|system|robot|aircraft)\b/i,
  /\b(multi[- ]agent|ai[- ]agent|agent[- ]based)\b/i,
];

/** §4.2 NAICS candidates (contracts). */
export const NAICS_CODE_CORROBORATORS = [
  "541511",
  "541512",
  "541513",
  "541519",
  "518210",
  "541715",
  "541714",
  "541713",
  "541690",
] as const;

/**
 * §4.2 PSC candidates (contracts) -- prefix/pattern matched, since the spec
 * describes these as code families (`D3xx`/`DB0x`, `AC*`/`AR*`) rather than
 * an exhaustive literal list.
 */
const PSC_CODE_PATTERNS: RegExp[] = [/^DA01$/i, /^DA10$/i, /^D3/i, /^DB0/i, /^AC/i, /^AR/i];

/**
 * §4.2 CFDA/Assistance-Listing candidates (assistance) -- the spec
 * describes these categorically (SBIR/STTR listings, NSF CISE-related, NIH
 * data-science, DOE/USDA/ED R&D), not as an exact number list, so this is a
 * keyword approximation against whatever CFDA text is available. This is
 * an explicit approximation, flagged for reconciliation once real CFDA
 * data is available in a live pull.
 */
const CFDA_CORROBORATOR_KEYWORDS = ["sbir", "sttr", "cise", "data science", "data-science"];

/** §4.3 agency corroborator (weight only, never a gate, never excludes a sector). */
const AGENCY_CORROBORATOR_KEYWORDS = [
  "nsf",
  "national science foundation",
  "darpa",
  "department of defense",
  "dod",
  "nih",
  "national institutes of health",
  "doe",
  "department of energy",
  "dhs",
  "department of homeland security",
  "gsa",
  "general services administration",
  "18f",
];

/** §4.4 exclusion terms/phrases -- never override a strong-term or §4.1 pattern hit. */
const EXCLUSION_PATTERNS: RegExp[] = [
  /\baortic insufficiency\b/i,
  /\bartificial insemination\b/i,
  /\bavian influenza\b/i,
  /\baromatase inhibitor\b/i,
  /\bAmnesty International\b/i,
  /\bAdobe Illustrator\b/i,
  /\bas-built\b/i,
  /\b(real estate|insurance|field|procurement|contracting)\s+agent\b/i,
  /\buser agent\b/i,
  /\b(chemical|contrast|cleaning)\s+agent\b/i,
  /\bfinancial model\b/i,
  /\bclimate model\b/i,
  /\b(building|office)\s+automation\b/i,
  /\bpower generation\b/i,
  /\bnext[- ]gen(eration)?\b/i,
  /\blead generation\b/i,
  /\bvision statement\b/i,
  /\bvision care\b/i,
  /\bsmart\s+(building|meter|card)\b/i,
  /\bbusiness intelligence\b/i,
  /\bintelligence community\b/i,
];

function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryMatches(text: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(text);
}

export interface Stage1Input {
  description: string | null | undefined;
  naicsCode?: string | null;
  pscCode?: string | null;
  cfdaText?: string | null;
  awardingAgency?: string | null;
}

export function applyStage1Filter(input: Stage1Input): Stage1Result {
  const description = (input.description ?? "").trim();

  if (!description) {
    return {
      queued: false,
      matchedTerms: [],
      matchedCodes: [],
      agencyFlag: null,
      ruleBranch: null,
      exclusionReason: null,
      skipReason: "empty_description",
    };
  }

  const matchedStrongTerms = STRONG_TERMS.filter((term) => wordBoundaryMatches(description, term));
  const matchedPatterns = PHRASE_PATTERNS.filter((pattern) => pattern.test(description));
  const matchedWeakTerms = WEAK_TERMS.filter((term) => wordBoundaryMatches(description, term));

  const matchedCodes: string[] = [];
  if (input.naicsCode && (NAICS_CODE_CORROBORATORS as readonly string[]).includes(input.naicsCode)) {
    matchedCodes.push(`naics:${input.naicsCode}`);
  }
  if (input.pscCode && PSC_CODE_PATTERNS.some((pattern) => pattern.test(input.pscCode as string))) {
    matchedCodes.push(`psc:${input.pscCode}`);
  }
  if (input.cfdaText && CFDA_CORROBORATOR_KEYWORDS.some((kw) => input.cfdaText!.toLowerCase().includes(kw))) {
    matchedCodes.push(`cfda:${input.cfdaText}`);
  }

  const agencyFlag =
    input.awardingAgency && AGENCY_CORROBORATOR_KEYWORDS.some((kw) => input.awardingAgency!.toLowerCase().includes(kw))
      ? input.awardingAgency
      : null;

  const hasCorroborator = matchedCodes.length > 0 || agencyFlag !== null;
  const hasStrongOrPattern = matchedStrongTerms.length > 0 || matchedPatterns.length > 0;
  const exclusionHit = EXCLUSION_PATTERNS.find((pattern) => pattern.test(description));

  // §4.4: exclusions never override a strong-term or §4.1 pattern hit.
  if (exclusionHit && !hasStrongOrPattern) {
    return {
      queued: false,
      matchedTerms: [],
      matchedCodes,
      agencyFlag,
      ruleBranch: null,
      exclusionReason: exclusionHit.source,
      skipReason: null,
    };
  }

  const branch = decideBranch(matchedStrongTerms.length, matchedPatterns.length, matchedWeakTerms.length, hasCorroborator);

  if (!branch) {
    return {
      queued: false,
      matchedTerms: [...matchedStrongTerms, ...matchedWeakTerms],
      matchedCodes,
      agencyFlag,
      ruleBranch: null,
      exclusionReason: null,
      skipReason: null,
    };
  }

  return {
    queued: true,
    matchedTerms: branch === "strong_term" ? matchedStrongTerms : matchedWeakTerms,
    matchedCodes,
    agencyFlag,
    ruleBranch: branch,
    exclusionReason: null,
    skipReason: null,
  };
}

/** §4.6 triage decision rule, exact branch order. */
function decideBranch(
  strongCount: number,
  patternCount: number,
  weakCount: number,
  hasCorroborator: boolean,
): Stage1RuleBranch | null {
  if (strongCount > 0) return "strong_term";
  if (patternCount > 0) return "phrase_pattern";
  if (weakCount >= 2) return "weak_term_pair";
  if (weakCount === 1 && hasCorroborator) return "weak_term_plus_corroborator";
  return null;
}
