import type {
  AwardRequestKind,
  CandidatePreview,
  NormalizedAwardFields,
  RawUsaspendingAward,
  ResearchItemPayloadPreview,
  SignalEvidencePreview,
  SignalPreview,
  SkippedRecord,
  SourceDocumentPreview,
  Stage1Result,
} from "./types.ts";

/**
 * Extracts the fields this connector needs from a raw USAspending record.
 * Primary keys match the award-type-aware `fields` arrays actually
 * requested in search.ts (Cowork/Fable-reviewed, confirmed field labels);
 * older snake_case/alternate-label keys remain as defensive fallbacks in
 * case the API response includes them under a different name than
 * requested, not because they're expected to be the primary source.
 *
 * `requestKind` matters because "Contract Award Type" (contracts) and
 * "Award Type" (assistance) are different fields for the same logical
 * award-type-label concept -- reading the wrong one for a given request
 * kind would silently return null instead of the real label.
 */
export function extractAwardFields(raw: RawUsaspendingAward, requestKind: AwardRequestKind): NormalizedAwardFields {
  return {
    generatedInternalId: pickString(raw, ["generated_internal_id"]),
    awardIdDisplay: pickString(raw, ["Award ID", "award_id"]),
    recipientName: pickString(raw, ["Recipient Name", "recipient_name"]),
    recipientUei: pickString(raw, ["Recipient UEI", "recipient_uei"]),
    // Parent fields are NOT available from the spending_by_award search
    // endpoint's `fields` array -- confirmed absent from every
    // Cowork/Fable-validated field list, so search.ts never requests
    // "Recipient Parent Name"/"Recipient Parent UEI" at all. These will
    // therefore always be null under M6B; populating them would require a
    // separate award-detail lookup or a later enrichment step, explicitly
    // out of scope for M6B. Kept here (rather than removed) only as a
    // defensive fallback in case a future field list adds them back.
    recipientParentName: pickString(raw, ["Recipient Parent Name", "recipient_parent_name"]),
    recipientParentUei: pickString(raw, ["Recipient Parent UEI", "recipient_parent_uei"]),
    awardingAgency: pickString(raw, ["Awarding Agency", "awarding_agency"]),
    awardingSubAgency: pickString(raw, ["Awarding Sub Agency", "awarding_sub_agency"]),
    awardAmount: pickNumber(raw, ["Award Amount", "award_amount", "total_obligation"]),
    awardTypeLabel:
      requestKind === "contracts"
        ? pickString(raw, ["Contract Award Type", "Award Type", "award_type"])
        : pickString(raw, ["Award Type", "award_type"]),
    awardTypeCode: pickString(raw, ["Award Type Code", "award_type_code", "type"]),
    // D-087: event_date/occurred_at are read from "Base Obligation Date"
    // (the Cowork/Fable-confirmed valid field for both contract and
    // assistance requests), never derived from Start Date / period-of-
    // performance dates. Older action_date/Action Date keys remain as
    // defensive fallbacks only.
    actionDate: pickString(raw, ["Base Obligation Date", "action_date", "Action Date"]),
    startDate: pickString(raw, ["Start Date", "start_date", "period_of_performance_start_date"]),
    naicsCode: pickString(raw, ["NAICS", "NAICS Code", "naics_code"]),
    pscCode: pickString(raw, ["PSC", "PSC Code", "psc_code"]),
    cfdaNumber: pickString(raw, ["CFDA Number", "cfda_number", "assistance_listing_number"]),
    description: pickString(raw, ["Description", "Award Description", "description"]),
    lastModifiedDate: pickString(raw, ["Last Modified Date", "last_modified_date"]),
  };
}

function pickString(raw: RawUsaspendingAward, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

function pickNumber(raw: RawUsaspendingAward, keys: string[]): number | null {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

const EXCERPT_MAX_LENGTH = 2000;
const SUMMARY_MAX_LENGTH = 500;

/**
 * Builds the proposed source_documents/signals/signal_evidence/
 * research_items.payload preview objects for a single award, per Field-
 * Mapping Spec §3/§5.2/§5.3/§5.4. Returns a SkippedRecord instead if
 * `generated_internal_id` is missing -- this id must come from the API
 * response and is never constructed/fabricated; a record without one is
 * skipped and logged, not silently dropped.
 */
export function buildCandidatePreview(
  fields: NormalizedAwardFields,
  requestKind: AwardRequestKind,
  stage1: Stage1Result,
): CandidatePreview | SkippedRecord {
  const awardTypeCode = fields.awardTypeCode;
  if (!fields.generatedInternalId) {
    return {
      reason: "missing_generated_internal_id",
      requestKind,
      generatedInternalId: null,
      detail: "USAspending record had no generated_internal_id; skipped rather than assigning a fabricated id.",
    };
  }

  const id = fields.generatedInternalId;
  const sourceDocumentId = `usasp-${id}`;
  const signalId = `sig-usasp-${id}`;
  const researchItemId = `ri-sig-usasp-${id}`;

  const recipientName = fields.recipientName ?? "Unknown Recipient";
  const awardingAgency = fields.awardingAgency ?? "Unknown Agency";
  const awardTypeLabel = fields.awardTypeLabel ?? (requestKind === "contracts" ? "Award" : "Assistance Award");
  const description = fields.description ?? "";

  const sourceTitle = `${awardTypeLabel} to ${recipientName} — ${awardingAgency}`;

  const sourceDocumentPreview: SourceDocumentPreview = {
    id: sourceDocumentId,
    canonical_url: `https://www.usaspending.gov/award/${id}/`,
    source_title: sourceTitle,
    publisher: "USAspending.gov (U.S. Department of the Treasury)",
    source_type: "government_award",
    // Text, not number (docs/DECISIONS.md D-092) -- matches
    // source_documents.source_tier's DB column type and the
    // commit_usaspending_candidate migration's hardcoded real-record value.
    source_tier: "1",
    // D-087: event_date is action_date, never inferred from Start Date.
    event_date: fields.actionDate,
    published_at: fields.lastModifiedDate,
    excerpt: description.slice(0, EXCERPT_MAX_LENGTH),
    is_demo: false,
  };

  const signalPreview: SignalPreview = {
    id: signalId,
    company_id: null,
    signal_type: requestKind === "contracts" ? "government contract" : "grant or research award",
    headline: sourceTitle,
    summary: description.slice(0, SUMMARY_MAX_LENGTH),
    why_it_matters: "Reviewer to assess and complete -- not an invented impact claim.",
    // D-087: occurred_at is action_date, never inferred from Start Date.
    occurred_at: fields.actionDate,
    evidence_strength: "high",
    verification_status: "unverified",
    publication_status: "draft",
    is_demo: false,
    created_by_type: "import",
  };

  const signalEvidencePreview: SignalEvidencePreview = {
    id: `${signalId}-ev-0`,
    signal_id: signalId,
    source_document_id: sourceDocumentId,
    support_type: "supports",
    claim_type: "official_record",
    supporting_passage: sourceDocumentPreview.excerpt,
  };

  const researchItemPayloadPreview: ResearchItemPayloadPreview = {
    target_table: "signals",
    target_id: signalId,
    connector_key: "usaspending_award_search",
    stage1: {
      matched_terms: stage1.matchedTerms,
      matched_codes: stage1.matchedCodes,
      agency_flag: stage1.agencyFlag,
      rule_branch: stage1.ruleBranch,
    },
    suggested_ai_relevance_class: "ai_adjacent_insufficient",
    suggested_award_relevance_case: 4,
    confidence: "low",
  };

  return {
    generatedInternalId: id,
    requestKind,
    awardTypeCode,
    fields,
    stage1,
    researchItemId,
    sourceDocumentPreview,
    signalPreview,
    signalEvidencePreview,
    researchItemPayloadPreview,
    entityPreview: null,
  };
}

export function isSkippedRecord(value: CandidatePreview | SkippedRecord): value is SkippedRecord {
  return "reason" in value;
}

export interface TaggedRawAward {
  raw: RawUsaspendingAward;
  requestKind: AwardRequestKind;
}

/**
 * Deduplicates raw award records by `generated_internal_id`, first-seen-
 * wins, across the contracts and assistance sub-requests (D-086's
 * dedup rule -- the same award must never be processed twice just because
 * both sub-queries happened to return it). Records with a missing/blank
 * `generated_internal_id` are never deduped here -- they pass through
 * unchanged and are caught later by buildCandidatePreview's own
 * missing-id skip, since fabricating a dedup key for them would risk
 * silently dropping distinct records that both lack an id.
 */
export function dedupeAwardsByGeneratedInternalId(records: TaggedRawAward[]): TaggedRawAward[] {
  const seenIds = new Set<string>();
  const result: TaggedRawAward[] = [];

  for (const record of records) {
    const rawId = record.raw["generated_internal_id"];
    if (typeof rawId === "string" && rawId.trim().length > 0) {
      if (seenIds.has(rawId)) continue;
      seenIds.add(rawId);
    }
    result.push(record);
  }

  return result;
}

/**
 * Aggregate, non-sensitive field-presence counts only -- how many fetched/
 * deduped raw records (including ones Stage-1 will go on to exclude) had a
 * given mapped field populated. Never stores a raw value, recipient name,
 * award description, or example record -- every field below is a plain
 * count. Uses the real extractAwardFields() so these stats validate
 * exactly the same keys the candidate-preview path reads, not a
 * reimplementation that could silently drift from it.
 *
 * "Contract Award Type" and "Award Type" presence are counted separately
 * (not merged into one generic "award type label" count) because
 * extractAwardFields reads a different source key depending on
 * requestKind -- collapsing them would hide a regression in either path.
 */
export interface FieldPresenceStats {
  totalRecordsInspected: number;
  byRequestKind: Record<AwardRequestKind, number>;
  generatedInternalIdPresentCount: number;
  descriptionPresentCount: number;
  baseObligationDatePresentCount: number;
  /** Context only per D-087 -- never used to derive event_date/occurred_at. */
  startDatePresentCount: number;
  lastModifiedDatePresentCount: number;
  /** awardTypeLabel presence for requestKind === "contracts" (sourced from "Contract Award Type"). */
  contractAwardTypePresentCount: number;
  /** awardTypeLabel presence for non-contracts kinds (sourced from "Award Type"). */
  awardTypePresentCount: number;
  naicsPresentCount: number;
  pscPresentCount: number;
  cfdaNumberPresentCount: number;
  awardTypeCodePresentCount: number;
}

export function computeFieldPresenceStats(taggedAwards: TaggedRawAward[]): FieldPresenceStats {
  const stats: FieldPresenceStats = {
    totalRecordsInspected: taggedAwards.length,
    byRequestKind: { contracts: 0, grants: 0, other_financial_assistance: 0, direct_payments: 0 },
    generatedInternalIdPresentCount: 0,
    descriptionPresentCount: 0,
    baseObligationDatePresentCount: 0,
    startDatePresentCount: 0,
    lastModifiedDatePresentCount: 0,
    contractAwardTypePresentCount: 0,
    awardTypePresentCount: 0,
    naicsPresentCount: 0,
    pscPresentCount: 0,
    cfdaNumberPresentCount: 0,
    awardTypeCodePresentCount: 0,
  };

  for (const { raw, requestKind } of taggedAwards) {
    const fields = extractAwardFields(raw, requestKind);
    stats.byRequestKind[requestKind] += 1;

    if (fields.generatedInternalId) stats.generatedInternalIdPresentCount += 1;
    if (fields.description) stats.descriptionPresentCount += 1;
    if (fields.actionDate) stats.baseObligationDatePresentCount += 1;
    if (fields.startDate) stats.startDatePresentCount += 1;
    if (fields.lastModifiedDate) stats.lastModifiedDatePresentCount += 1;
    if (fields.naicsCode) stats.naicsPresentCount += 1;
    if (fields.pscCode) stats.pscPresentCount += 1;
    if (fields.cfdaNumber) stats.cfdaNumberPresentCount += 1;
    if (fields.awardTypeCode) stats.awardTypeCodePresentCount += 1;

    if (fields.awardTypeLabel) {
      if (requestKind === "contracts") {
        stats.contractAwardTypePresentCount += 1;
      } else {
        stats.awardTypePresentCount += 1;
      }
    }
  }

  return stats;
}
