import type { EntityAliasRecord, EntityPreviewInput, EntityPreviewResult } from "./types.ts";

/**
 * Entity-resolution preview per docs/ENTITY_RESOLUTION_POLICY.md §5 --
 * implemented as a PURE function: (input, existingAliases, seenInBatch) ->
 * decision. No Supabase client, no DB read, by design (Cowork/Fable's
 * recommended M6B design): the default dry-run passes an empty
 * `existingAliases` array and relies entirely on intra-batch matching,
 * which is the only thing that's actually meaningful today anyway --
 * company_aliases has 0 rows in dev/CI until M6C's --commit mode exists.
 * If a future milestone adds a real DB-backed `existingAliases` lookup,
 * that's a separately-controlled, explicitly read-only addition -- this
 * function's signature doesn't change either way.
 *
 * Never proposes a merge of two existing companies -- its only outcomes
 * are "reuse this company" (MATCH), "this looks new" (NEW), or "a human
 * must decide" (AMBIGUOUS/CONFLICT).
 */

/** normalizedUei -> synthetic/company id already assigned earlier in this same run. */
export type BatchAliasMap = Map<string, string>;

const PERSON_NAME_COMMA_INVERTED = /^[A-Za-z'-]+,\s*[A-Za-z'-]+(\s+[A-Za-z.'-]+)?$/;
// Deliberately broad: any of these words anywhere in the name is treated
// as a business-entity signal, ruling out the bare-two-token heuristic
// below -- reduces (but does not eliminate) false positives on common
// two-word company names like "Acme Manufacturing" (docs/DECISIONS.md
// D-088 -- this heuristic remains unvalidated by real examples either way).
const BUSINESS_WORD_PATTERN =
  /\b(inc|incorporated|llc|l\.l\.c\.?|ltd|limited|corp|corporation|co|company|lp|llp|plc|gmbh|group|systems|solutions|technologies|technology|labs|laboratories|university|college|foundation|institute|associates|partners|manufacturing|robotics|industries|enterprises|holdings|ventures|capital|consulting|services|analytics|dynamics|innovations|energy|materials|defense|aerospace|pharmaceuticals|biosciences|networks|media|studios)\b/i;
const BARE_TWO_TOKEN_NAME = /^[A-Z][a-z'-]+\s+[A-Z][a-z'-]+$/;

/**
 * R5 person-named-recipient check. Deliberately conservative: this is a
 * safeguard, not a validated heuristic (zero real labeled examples exist
 * per docs/DECISIONS.md D-088) -- biased toward flagging uncertain cases
 * rather than risking a draft company created for an individual.
 */
export function looksLikePersonName(name: string | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length === 0) return false;
  if (PERSON_NAME_COMMA_INVERTED.test(trimmed)) return true;
  if (BUSINESS_WORD_PATTERN.test(trimmed)) return false;
  if (BARE_TWO_TOKEN_NAME.test(trimmed)) return true;
  return false;
}

export function normalizeUei(uei: string): string {
  return uei.trim().toUpperCase();
}

/** Mirrors docs/ENTITY_RESOLUTION_POLICY.md §4's normalization rules (whole-token suffix stripping only -- D-088's normalizer bug fix). */
export function normalizeName(name: string): string {
  let normalized = name.normalize("NFKC").toLowerCase();
  normalized = normalized.replace(/&/g, " and ");
  normalized = normalized.replace(/[^\p{L}\p{N}\s]/gu, " ");

  const noiseTokens = new Set(["the", "dba", "formerly"]);
  const suffixTokens = new Set([
    "inc",
    "incorporated",
    "llc",
    "l l c",
    "ltd",
    "limited",
    "corp",
    "corporation",
    "co",
    "company",
    "lp",
    "llp",
    "plc",
    "gmbh",
  ]);

  let tokens = normalized.split(/\s+/).filter(Boolean);
  tokens = tokens.filter((token) => !noiseTokens.has(token));
  while (tokens.length > 0 && suffixTokens.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  return tokens.join(" ");
}

function buildParentSubsidiaryNote(input: EntityPreviewInput): string | null {
  if (!input.recipientParentName && !input.recipientParentUei) return null;
  return `Parent: ${input.recipientParentName ?? "unknown name"} (${input.recipientParentUei ?? "no UEI"}) -- informational only, never auto-collapsed.`;
}

export function previewEntityDecision(
  input: EntityPreviewInput,
  existingAliases: EntityAliasRecord[],
  seenInBatch: BatchAliasMap,
): EntityPreviewResult {
  const parentSubsidiaryNote = buildParentSubsidiaryNote(input);

  // R5 runs first, before any MATCH/NEW/AMBIGUOUS decision -- never
  // auto-creates a draft company for a suspected individual.
  if (looksLikePersonName(input.recipientName)) {
    return {
      decision: "AMBIGUOUS",
      reason: "possible_individual",
      matchedCompanyId: null,
      isPossibleIndividual: true,
      parentSubsidiaryNote,
    };
  }

  if (!input.recipientUei) {
    return {
      decision: "AMBIGUOUS",
      reason: "no_uei",
      matchedCompanyId: null,
      isPossibleIndividual: false,
      parentSubsidiaryNote,
    };
  }

  const normalizedUei = normalizeUei(input.recipientUei);
  const matchedCompanyIds = new Set(
    existingAliases.filter((alias) => alias.aliasType === "uei" && alias.normalizedAlias === normalizedUei).map((a) => a.companyId),
  );
  const batchCompanyId = seenInBatch.get(normalizedUei) ?? null;
  if (batchCompanyId) matchedCompanyIds.add(batchCompanyId);

  // UEI pointing at more than one company is always a conflict -- never
  // silently resolved, never merged.
  if (matchedCompanyIds.size > 1) {
    return {
      decision: "CONFLICT",
      reason: "duplicate_uei",
      matchedCompanyId: null,
      isPossibleIndividual: false,
      parentSubsidiaryNote,
    };
  }

  if (matchedCompanyIds.size === 1) {
    const [companyId] = [...matchedCompanyIds];
    return {
      decision: "MATCH",
      reason: null,
      matchedCompanyId: companyId,
      isPossibleIndividual: false,
      parentSubsidiaryNote,
    };
  }

  // No UEI match -- check for a name collision against a DIFFERENT UEI on
  // file before proposing NEW. Name-similar/different-UEI always routes
  // to AMBIGUOUS, never auto-reused.
  const normalizedName = input.recipientName ? normalizeName(input.recipientName) : null;
  const nameCollision =
    normalizedName !== null &&
    existingAliases.some(
      (alias) => (alias.aliasType === "legal_name" || alias.aliasType === "dba") && alias.normalizedAlias === normalizedName,
    );

  if (nameCollision) {
    return {
      decision: "AMBIGUOUS",
      reason: "name_collision",
      matchedCompanyId: null,
      isPossibleIndividual: false,
      parentSubsidiaryNote,
    };
  }

  return {
    decision: "NEW",
    reason: null,
    matchedCompanyId: null,
    isPossibleIndividual: false,
    parentSubsidiaryNote,
  };
}
