/**
 * Shared types for the Milestone 6B USAspending dry-run connector. Every
 * "preview" type here mirrors the exact target shape from
 * docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md §3/§5.2/§5.3/§5.4 that
 * M6C's --commit mode will eventually insert -- computing it correctly now
 * means M6C reuses this mapping logic rather than redoing it.
 */

/**
 * USAspending's spending_by_award endpoint requires `award_type_codes` in
 * one request to come from exactly one of its own award_type_groups --
 * confirmed by a live HTTP 422 whose body enumerated the real groups
 * (contracts, loans, idvs, grants, other_financial_assistance,
 * direct_payments). D-086 originally described this as "never mix
 * contracts and assistance in one request"; the live response showed the
 * same rule applies *within* what this connector previously called
 * "assistance" too -- grants (02-05), other_financial_assistance (06, 10),
 * and direct_payments (09, 11) are three separate groups, not one. M6B
 * therefore requests one award_type_group per request kind, never mixing
 * codes across groups in a single request. Loans (07/08) remain excluded
 * from every live request until their valid `fields` set is confirmed
 * (search.ts's UNTESTED_LOAN_AWARD_TYPE_CODES) -- there is deliberately no
 * "loans" request kind yet.
 */
export type AwardRequestKind = "contracts" | "grants" | "other_financial_assistance" | "direct_payments";

/**
 * Raw record shape returned by the USAspending Award Search endpoint's
 * `results` array. Exact key names are NOT locked in the Field-Mapping Spec
 * (§16 flags this as "reconcile exact fields at build") -- treated here as
 * an untyped bag and extracted defensively via extractAwardFields().
 */
export type RawUsaspendingAward = Record<string, unknown>;

export interface NormalizedAwardFields {
  generatedInternalId: string | null;
  awardIdDisplay: string | null;
  recipientName: string | null;
  recipientUei: string | null;
  recipientParentName: string | null;
  recipientParentUei: string | null;
  awardingAgency: string | null;
  awardingSubAgency: string | null;
  awardAmount: number | null;
  awardTypeLabel: string | null;
  /** The actual award_type_code value (e.g. "A"/"02") if the API returns it separately from the label -- used for the validated (02-05) vs unvalidated (06-11) assistance-code bucket counting. Null if not present/reconciled yet. */
  awardTypeCode: string | null;
  /** action_date -- never inferred from startDate (D-087). */
  actionDate: string | null;
  /** Context only; never substituted for actionDate (D-087). */
  startDate: string | null;
  naicsCode: string | null;
  pscCode: string | null;
  cfdaNumber: string | null;
  description: string | null;
  lastModifiedDate: string | null;
}

export type Stage1RuleBranch =
  | "strong_term"
  | "phrase_pattern"
  | "weak_term_pair"
  | "weak_term_plus_corroborator";

export interface Stage1Result {
  queued: boolean;
  matchedTerms: string[];
  matchedCodes: string[];
  agencyFlag: string | null;
  ruleBranch: Stage1RuleBranch | null;
  exclusionReason: string | null;
  skipReason: "empty_description" | null;
}

export type EntityDecisionKind = "MATCH" | "NEW" | "AMBIGUOUS" | "CONFLICT";
export type EntityMatchReason = "name_collision" | "duplicate_uei" | "no_uei" | "possible_individual";

/** A company_aliases row shape, read-only input to the entity preview. */
export interface EntityAliasRecord {
  companyId: string;
  aliasType: "uei" | "legal_name" | "dba" | "parent_uei" | "parent_name";
  normalizedAlias: string;
}

export interface EntityPreviewInput {
  recipientName: string | null;
  recipientUei: string | null;
  recipientParentName: string | null;
  recipientParentUei: string | null;
}

export interface EntityPreviewResult {
  decision: EntityDecisionKind;
  reason: EntityMatchReason | null;
  /** Set only for MATCH -- the existing or intra-batch company id reused. */
  matchedCompanyId: string | null;
  isPossibleIndividual: boolean;
  parentSubsidiaryNote: string | null;
}

export interface SourceDocumentPreview {
  id: string;
  canonical_url: string;
  source_title: string;
  publisher: string;
  source_type: string;
  source_tier: number;
  event_date: string | null;
  published_at: string | null;
  excerpt: string;
  is_demo: boolean;
}

export interface SignalPreview {
  id: string;
  company_id: string | null;
  signal_type: string;
  headline: string;
  summary: string;
  why_it_matters: string;
  occurred_at: string | null;
  evidence_strength: "high";
  verification_status: "unverified";
  publication_status: "draft";
  is_demo: boolean;
  created_by_type: "import";
}

export interface SignalEvidencePreview {
  id: string;
  signal_id: string;
  source_document_id: string;
  support_type: "supports";
  claim_type: "official_record";
  supporting_passage: string;
}

export interface ResearchItemPayloadPreview {
  target_table: "signals";
  target_id: string;
  connector_key: "usaspending_award_search";
  stage1: {
    matched_terms: string[];
    matched_codes: string[];
    agency_flag: string | null;
    rule_branch: Stage1RuleBranch | null;
  };
  suggested_ai_relevance_class: string;
  suggested_award_relevance_case: number;
  confidence: "low" | "medium" | "high";
}

export interface CandidatePreview {
  generatedInternalId: string;
  requestKind: AwardRequestKind;
  awardTypeCode: string | null;
  fields: NormalizedAwardFields;
  stage1: Stage1Result;
  researchItemId: string;
  sourceDocumentPreview: SourceDocumentPreview;
  signalPreview: SignalPreview;
  signalEvidencePreview: SignalEvidencePreview;
  researchItemPayloadPreview: ResearchItemPayloadPreview;
  entityPreview: EntityPreviewResult | null;
}

export type SkipReason =
  | "missing_generated_internal_id"
  | "duplicate_generated_internal_id"
  | "excluded"
  | "empty_description";

export interface SkippedRecord {
  reason: SkipReason;
  requestKind: AwardRequestKind;
  generatedInternalId?: string | null;
  detail?: string;
}
