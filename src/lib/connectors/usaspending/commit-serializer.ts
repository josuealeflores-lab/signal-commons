import type { CandidatePreview, EntityDecisionKind, EntityMatchReason } from "./types.ts";

/**
 * Converts an M6B CandidatePreview into the exact flat DTO shape pinned in
 * supabase/migrations/20260715090000_m6c_commit_usaspending_candidate.sql's
 * header comment. The RPC does NOT accept CandidatePreview directly --
 * CandidatePreview nests data as sourceDocumentPreview / signalPreview /
 * signalEvidencePreview / researchItemPayloadPreview / fields.recipientName,
 * carries `fields` (the full NormalizedAwardFields bag, including raw
 * description/recipient text), `stage1.exclusionReason`/`skipReason`, and
 * `entityPreview.parentSubsidiaryNote`/`matchedCompanyId` -- none of which
 * the RPC needs or should receive. This module is the one and only place
 * that shape translation happens; nothing else should hand-build the DTO.
 *
 * Pure, hermetic, no Supabase client, no DB, no network.
 */

export interface CommitSourceDocumentDto {
  id: string;
  canonical_url: string;
  source_title: string;
  publisher: string;
  source_type: string;
  event_date: string | null;
  published_at: string | null;
  excerpt: string;
}

export interface CommitSignalDto {
  id: string;
  signal_type: string;
  headline: string;
  summary: string;
  why_it_matters: string;
  occurred_at: string | null;
}

export interface CommitSignalEvidenceDto {
  id: string;
  supporting_passage: string;
}

export interface CommitResearchItemPayloadDto {
  target_table: "signals";
  target_id: string;
  connector_key: string;
  stage1: {
    matched_terms: string[];
    matched_codes: string[];
    agency_flag: string | null;
    rule_branch: string | null;
  };
  suggested_ai_relevance_class: string;
  suggested_award_relevance_case: number;
  confidence: "low" | "medium" | "high";
}

/**
 * Projected down to exactly decision/reason/isPossibleIndividual --
 * parentSubsidiaryNote and matchedCompanyId are deliberately excluded (the
 * RPC rebuilds company linkage itself from its own authoritative lookup;
 * echoing matchedCompanyId back would imply the RPC should trust it, which
 * it never does).
 */
export interface CommitEntityDecisionDto {
  decision: EntityDecisionKind;
  reason: EntityMatchReason | null;
  isPossibleIndividual: boolean;
}

export interface CommitCandidateDto {
  recipientName: string;
  researchItemId: string;
  generatedInternalId?: string;
  requestKind?: string;
  entityDecision?: CommitEntityDecisionDto;
  sourceDocument: CommitSourceDocumentDto;
  signal: CommitSignalDto;
  signalEvidence: CommitSignalEvidenceDto;
  researchItemPayload: CommitResearchItemPayloadDto;
}

export class CommitSerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommitSerializationError";
  }
}

/**
 * Throws (never silently substitutes a placeholder) if recipientName is
 * missing -- the RPC's own validation would reject it anyway, but failing
 * here keeps the error attributable to serialization rather than an opaque
 * RPC skip.
 */
export function serializeCandidateForCommit(candidate: CandidatePreview): CommitCandidateDto {
  const recipientName = candidate.fields.recipientName;
  if (!recipientName || recipientName.trim().length === 0) {
    throw new CommitSerializationError(
      `serializeCandidateForCommit: candidate ${candidate.generatedInternalId} has no recipientName`,
    );
  }

  const dto: CommitCandidateDto = {
    recipientName,
    researchItemId: candidate.researchItemId,
    generatedInternalId: candidate.generatedInternalId,
    requestKind: candidate.requestKind,
    sourceDocument: {
      id: candidate.sourceDocumentPreview.id,
      canonical_url: candidate.sourceDocumentPreview.canonical_url,
      source_title: candidate.sourceDocumentPreview.source_title,
      publisher: candidate.sourceDocumentPreview.publisher,
      source_type: candidate.sourceDocumentPreview.source_type,
      event_date: candidate.sourceDocumentPreview.event_date,
      published_at: candidate.sourceDocumentPreview.published_at,
      excerpt: candidate.sourceDocumentPreview.excerpt,
    },
    signal: {
      id: candidate.signalPreview.id,
      signal_type: candidate.signalPreview.signal_type,
      headline: candidate.signalPreview.headline,
      summary: candidate.signalPreview.summary,
      why_it_matters: candidate.signalPreview.why_it_matters,
      occurred_at: candidate.signalPreview.occurred_at,
    },
    signalEvidence: {
      id: candidate.signalEvidencePreview.id,
      supporting_passage: candidate.signalEvidencePreview.supporting_passage,
    },
    // target_table/target_id are carried through here for shape parity with
    // ResearchItemPayloadPreview, but the RPC never trusts them from the
    // DTO -- it always rebuilds both server-side from values it resolved
    // itself (migration's Cowork note 2). Serializing the correct values
    // here anyway keeps this DTO internally consistent for logging/tests.
    researchItemPayload: {
      target_table: candidate.researchItemPayloadPreview.target_table,
      target_id: candidate.researchItemPayloadPreview.target_id,
      connector_key: candidate.researchItemPayloadPreview.connector_key,
      stage1: {
        matched_terms: candidate.researchItemPayloadPreview.stage1.matched_terms,
        matched_codes: candidate.researchItemPayloadPreview.stage1.matched_codes,
        agency_flag: candidate.researchItemPayloadPreview.stage1.agency_flag,
        rule_branch: candidate.researchItemPayloadPreview.stage1.rule_branch,
      },
      suggested_ai_relevance_class: candidate.researchItemPayloadPreview.suggested_ai_relevance_class,
      suggested_award_relevance_case: candidate.researchItemPayloadPreview.suggested_award_relevance_case,
      confidence: candidate.researchItemPayloadPreview.confidence,
    },
  };

  if (candidate.entityPreview) {
    dto.entityDecision = {
      decision: candidate.entityPreview.decision,
      reason: candidate.entityPreview.reason,
      isPossibleIndividual: candidate.entityPreview.isPossibleIndividual,
    };
  }

  return dto;
}
