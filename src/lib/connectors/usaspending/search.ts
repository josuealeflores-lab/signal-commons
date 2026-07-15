import type { AwardRequestKind } from "./types.ts";

/**
 * D-086 (extended): USAspending's spending_by_award endpoint rejects any
 * request whose `award_type_codes` span more than one of its own
 * award_type_groups -- originally documented as "never mix contracts and
 * assistance in one request." A live HTTP 422 during M6B's second smoke
 * test revealed this rule is finer-grained: the response body enumerated
 * the real groups as `contracts`, `loans`, `idvs`, `grants`,
 * `other_financial_assistance`, and `direct_payments`. What this connector
 * previously called one "assistance" request kind actually spans THREE
 * separate groups (grants, other_financial_assistance, direct_payments),
 * and mixing them triggered the same "must only contain types from one
 * group" error. M6B now issues one request per award_type_group -- no
 * request may ever mix codes across groups.
 */
export const CONTRACT_AWARD_TYPE_CODES = ["A", "B", "C", "D"] as const;

/**
 * Per the locked Field-Mapping Spec (Decision 6/§1.3), assistance/grants
 * use codes 02-11 overall. This remains the labeling/recall-validation
 * framing (this session's labeling validation only sampled 02-05) --
 * decoupled from which award_type_group each code actually belongs to for
 * live-request purposes (see the group-specific constants below).
 */
export const VALIDATED_ASSISTANCE_AWARD_TYPE_CODES = ["02", "03", "04", "05"] as const;
export const UNVALIDATED_ASSISTANCE_AWARD_TYPE_CODES = ["06", "07", "08", "09", "10", "11"] as const;
export const ASSISTANCE_AWARD_TYPE_CODES = [
  ...VALIDATED_ASSISTANCE_AWARD_TYPE_CODES,
  ...UNVALIDATED_ASSISTANCE_AWARD_TYPE_CODES,
] as const;

/**
 * The three non-loan award_type_groups USAspending's live 422 response
 * confirmed within what was previously called "assistance." `grants`
 * exactly equals the labeling-validated 02-05 range.
 *
 * direct_payments (06, 10) and other_financial_assistance (09, 11) were
 * SWAPPED in M6B's first award_type_group-split patch -- Cowork/Fable's
 * review of the official USAspending spending_by_award contract caught
 * this: 06 ("Direct Payment for Specified Use") and 10 ("Direct Payment
 * with Unrestricted Use") are both `direct_payments`, while 09
 * ("Insurance") and 11 ("Other Financial Assistance") are
 * `other_financial_assistance`. The swap never produced a 422 (each set
 * was still internally single-group, so USAspending accepted both
 * requests) -- it silently mislabeled requestKind/provenance on every
 * candidate from either group, not a request failure. Do not mix codes
 * across these two groups, or across any award_type_group.
 */
export const GRANT_AWARD_TYPE_CODES = VALIDATED_ASSISTANCE_AWARD_TYPE_CODES;
export const DIRECT_PAYMENTS_AWARD_TYPE_CODES = ["06", "10"] as const;
export const OTHER_FINANCIAL_ASSISTANCE_AWARD_TYPE_CODES = ["09", "11"] as const;

/**
 * Loan codes (07 = Direct Loan, 08 = Guaranteed/Insured Loan) -- the live
 * 422 response's `award_type_groups.loans` confirmed these are their own
 * group, distinct from grants/other_financial_assistance/direct_payments.
 * Cowork/Fable flagged that loan awards likely use a different valid
 * `fields` set than grants/cooperative-agreements, and no locally-
 * available doc confirms the exact loan field set. Rather than guess,
 * loans are excluded from every live request entirely -- there is no
 * "loans" AwardRequestKind -- until the loan field shape is confirmed.
 */
export const UNTESTED_LOAN_AWARD_TYPE_CODES = ["07", "08"] as const;
/** @deprecated Use UNTESTED_LOAN_AWARD_TYPE_CODES. Kept as an alias for callers written against the earlier (M6B second-patch) name. */
export const UNTESTED_LOAN_ASSISTANCE_AWARD_TYPE_CODES = UNTESTED_LOAN_AWARD_TYPE_CODES;

/** The full set of codes actually requested live across grants + other_financial_assistance + direct_payments (excludes loans). */
export const REQUESTED_ASSISTANCE_AWARD_TYPE_CODES = [
  ...GRANT_AWARD_TYPE_CODES,
  ...OTHER_FINANCIAL_ASSISTANCE_AWARD_TYPE_CODES,
  ...DIRECT_PAYMENTS_AWARD_TYPE_CODES,
] as const;

/**
 * Fixed priority order the connector plans and (subject to the
 * max_requests cap) attempts requests in: contracts first, then the three
 * non-loan assistance groups. Loans are never included.
 */
export const ALL_REQUEST_KINDS: readonly AwardRequestKind[] = [
  "contracts",
  "grants",
  "other_financial_assistance",
  "direct_payments",
];

export interface TimePeriodWindow {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
}

export interface UsaspendingSearchRequestBody {
  filters: {
    award_type_codes: string[];
    time_period: Array<{ start_date: string; end_date: string }>;
    /**
     * DIAGNOSTIC ONLY, omitted unless explicitly requested. `description`
     * is USAspending's request-side keyword filter -- confirmed against a
     * real 200 response in this session's earlier validated pull
     * (docs/research/usaspending_pull_log.md, e.g. Request 2:
     * `"description": "artificial intelligence"`), not a guessed field
     * name. Biases the sample toward keyword matches -- never representative,
     * never used for recall/precision estimation, never the default
     * request path (see buildSearchRequestBody's `diagnosticKeyword` param).
     */
    description?: string;
  };
  fields: string[];
  page: number;
  limit: number;
  subawards: boolean;
}

/**
 * Contract-request `fields` array. Award-type-aware: contracts and
 * assistance expose different valid field labels for the same
 * spending_by_award endpoint. "Contract Award Type" (not "Award Type"),
 * "Base Obligation Date" (not "action_date"), "NAICS"/"PSC" (not
 * "NAICS Code"/"PSC Code"), and no "CFDA Number" (assistance-only) or
 * parent-company fields (see field-mapping.ts's header comment on why
 * parent fields are never requested at all). Confirmed against a real 200
 * response in M6B's second live smoke test.
 */
const CONTRACT_REQUEST_FIELDS = [
  "generated_internal_id",
  "Award ID",
  "Recipient Name",
  "Recipient UEI",
  "Awarding Agency",
  "Awarding Sub Agency",
  "Award Amount",
  "Contract Award Type",
  "Base Obligation Date",
  "Start Date",
  "NAICS",
  "PSC",
  "Description",
  "Last Modified Date",
] as const;

/**
 * Assistance-request `fields` array, shared by all three non-loan
 * assistance groups (grants, other_financial_assistance, direct_payments)
 * -- their display-field labels are not known to differ from one another,
 * only from contracts. Not yet confirmed against a real 200 response
 * (M6B's second smoke test failed on award_type_codes grouping before
 * fields were ever validated) -- re-verify on the next live attempt.
 */
const ASSISTANCE_REQUEST_FIELDS = [
  "generated_internal_id",
  "Award ID",
  "Recipient Name",
  "Recipient UEI",
  "Awarding Agency",
  "Awarding Sub Agency",
  "Award Amount",
  "Award Type",
  "Base Obligation Date",
  "Start Date",
  "CFDA Number",
  "Description",
  "Last Modified Date",
] as const;

export function awardTypeCodesForRequestKind(requestKind: AwardRequestKind): string[] {
  switch (requestKind) {
    case "contracts":
      return [...CONTRACT_AWARD_TYPE_CODES];
    case "grants":
      return [...GRANT_AWARD_TYPE_CODES];
    case "other_financial_assistance":
      return [...OTHER_FINANCIAL_ASSISTANCE_AWARD_TYPE_CODES];
    case "direct_payments":
      return [...DIRECT_PAYMENTS_AWARD_TYPE_CODES];
  }
}

export function requestFieldsForRequestKind(requestKind: AwardRequestKind): string[] {
  return requestKind === "contracts" ? [...CONTRACT_REQUEST_FIELDS] : [...ASSISTANCE_REQUEST_FIELDS];
}

/**
 * `diagnosticKeyword`: DIAGNOSTIC ONLY. When provided, adds USAspending's
 * `filters.description` keyword filter to bias the sample toward matches
 * -- purely to exercise the candidate-preview path on live data when a
 * representative sample produces zero candidates. Omit (the default) for
 * every normal dry-run; passing it must never become the default request
 * path, and results from a keyword-biased run are never representative
 * and must never be used for recall/precision estimation (see
 * connector-usaspending.ts's --diagnostic-keyword flag and the report's
 * required DIAGNOSTIC KEYWORD-BIASED RUN warning).
 */
export function buildSearchRequestBody(
  requestKind: AwardRequestKind,
  window: TimePeriodWindow,
  page: number,
  limit: number,
  diagnosticKeyword?: string,
): UsaspendingSearchRequestBody {
  return {
    filters: {
      // D-086 (extended): never a request mixing codes from more than one
      // USAspending award_type_group -- see this file's header comment.
      award_type_codes: awardTypeCodesForRequestKind(requestKind),
      // D-087: time_period is the *operational* sampling frame -- whatever
      // USAspending's own filter returns for this window is the candidate
      // set. A record is never rejected afterward because its own Start
      // Date falls outside this window, and event_date/occurred_at are
      // never inferred from Start Date (see field-mapping.ts).
      time_period: [{ start_date: window.startDate, end_date: window.endDate }],
      ...(diagnosticKeyword ? { description: diagnosticKeyword } : {}),
    },
    fields: requestFieldsForRequestKind(requestKind),
    page,
    limit,
    subawards: false,
  };
}

/** True for the assistance codes this session's labeling validation never sampled. */
export function isUnvalidatedAssistanceCode(code: string): boolean {
  return (UNVALIDATED_ASSISTANCE_AWARD_TYPE_CODES as readonly string[]).includes(code);
}

/** True for loan codes (07/08) excluded from every live request pending field-shape confirmation. */
export function isUntestedLoanAssistanceCode(code: string): boolean {
  return (UNTESTED_LOAN_AWARD_TYPE_CODES as readonly string[]).includes(code);
}
