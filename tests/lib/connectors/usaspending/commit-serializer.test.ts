import { describe, expect, it } from "vitest";
import { extractAwardFields, buildCandidatePreview, isSkippedRecord } from "@/lib/connectors/usaspending/field-mapping";
import { applyStage1Filter } from "@/lib/connectors/usaspending/stage1-filter";
import { previewEntityDecision } from "@/lib/connectors/usaspending/entity-resolution-preview";
import { serializeCandidateForCommit, CommitSerializationError } from "@/lib/connectors/usaspending/commit-serializer";
import type { CandidatePreview, RawUsaspendingAward } from "@/lib/connectors/usaspending/types";

/**
 * Hermetic -- confirms the serializer converts a real, fully-built
 * CandidatePreview (built the same way the pipeline does, not a hand-rolled
 * fixture) into exactly the pinned RPC DTO shape from
 * supabase/migrations/20260715090000_m6c_commit_usaspending_candidate.sql's
 * header comment, and that every field the migration explicitly says to
 * exclude is actually absent from the serialized output.
 */

const FIXTURE_AWARD: RawUsaspendingAward = {
  generated_internal_id: "CONT_AWD_SERIALIZE_1",
  "Recipient Name": "Acme Robotics LLC",
  "Recipient UEI": "uei-serialize-1",
  "Awarding Agency": "National Science Foundation",
  "Award Amount": 500000,
  "Contract Award Type": "Definitive Contract",
  "Award Type Code": "A",
  "Base Obligation Date": "2026-02-15",
  "Start Date": "2020-01-01",
  NAICS: "541511",
  PSC: "DA01",
  Description: "This project applies machine learning to improve robotics for the Department of Defense.",
  "Last Modified Date": "2026-03-01",
};

function buildRealCandidate(overrides?: Partial<RawUsaspendingAward>): CandidatePreview {
  const raw = { ...FIXTURE_AWARD, ...overrides };
  const fields = extractAwardFields(raw, "contracts");
  const stage1 = applyStage1Filter({ description: fields.description, naicsCode: fields.naicsCode });
  const result = buildCandidatePreview(fields, "contracts", stage1);
  if (isSkippedRecord(result)) throw new Error("unreachable: fixture must not be skipped");

  result.entityPreview = previewEntityDecision(
    {
      recipientName: fields.recipientName,
      recipientUei: fields.recipientUei,
      recipientParentName: fields.recipientParentName,
      recipientParentUei: fields.recipientParentUei,
    },
    [],
    new Map(),
  );

  return result;
}

describe("serializeCandidateForCommit", () => {
  it("produces exactly the pinned DTO shape (recipientName, researchItemId, sourceDocument, signal, signalEvidence, researchItemPayload)", () => {
    const candidate = buildRealCandidate();
    const dto = serializeCandidateForCommit(candidate);

    expect(dto.recipientName).toBe("Acme Robotics LLC");
    expect(dto.researchItemId).toBe(candidate.researchItemId);
    expect(dto.generatedInternalId).toBe(candidate.generatedInternalId);
    expect(dto.requestKind).toBe("contracts");

    expect(dto.sourceDocument).toEqual({
      id: candidate.sourceDocumentPreview.id,
      canonical_url: candidate.sourceDocumentPreview.canonical_url,
      source_title: candidate.sourceDocumentPreview.source_title,
      publisher: candidate.sourceDocumentPreview.publisher,
      source_type: candidate.sourceDocumentPreview.source_type,
      event_date: candidate.sourceDocumentPreview.event_date,
      published_at: candidate.sourceDocumentPreview.published_at,
      excerpt: candidate.sourceDocumentPreview.excerpt,
    });

    expect(dto.signal).toEqual({
      id: candidate.signalPreview.id,
      signal_type: candidate.signalPreview.signal_type,
      headline: candidate.signalPreview.headline,
      summary: candidate.signalPreview.summary,
      why_it_matters: candidate.signalPreview.why_it_matters,
      occurred_at: candidate.signalPreview.occurred_at,
    });

    expect(dto.signalEvidence).toEqual({
      id: candidate.signalEvidencePreview.id,
      supporting_passage: candidate.signalEvidencePreview.supporting_passage,
    });

    expect(dto.researchItemPayload.target_table).toBe("signals");
    expect(dto.researchItemPayload.target_id).toBe(candidate.signalPreview.id);
    expect(dto.researchItemPayload.connector_key).toBe("usaspending_award_search");
    expect(dto.researchItemPayload.confidence).toBe(candidate.researchItemPayloadPreview.confidence);
  });

  it("projects entityDecision to exactly decision/reason/isPossibleIndividual, excluding parentSubsidiaryNote and matchedCompanyId", () => {
    const candidate = buildRealCandidate();
    candidate.entityPreview = {
      decision: "MATCH",
      reason: null,
      matchedCompanyId: "co-should-not-leak",
      isPossibleIndividual: false,
      parentSubsidiaryNote: "Parent: Should Not Leak Inc (uei-parent) -- informational only, never auto-collapsed.",
    };

    const dto = serializeCandidateForCommit(candidate);

    expect(dto.entityDecision).toEqual({
      decision: "MATCH",
      reason: null,
      isPossibleIndividual: false,
    });
    expect(dto.entityDecision).not.toHaveProperty("matchedCompanyId");
    expect(dto.entityDecision).not.toHaveProperty("parentSubsidiaryNote");

    const serialized = JSON.stringify(dto);
    expect(serialized).not.toContain("co-should-not-leak");
    expect(serialized).not.toContain("Should Not Leak Inc");
    expect(serialized).not.toContain("never auto-collapsed");
  });

  it("omits entityDecision entirely when the candidate has none", () => {
    const candidate = buildRealCandidate();
    candidate.entityPreview = null;
    const dto = serializeCandidateForCommit(candidate);
    expect(dto.entityDecision).toBeUndefined();
  });

  it("never includes the full raw award record, awardTypeCode, or the raw NormalizedAwardFields bag", () => {
    const candidate = buildRealCandidate();
    const dto = serializeCandidateForCommit(candidate);

    // awardTypeCode and the full NormalizedAwardFields bag (candidate.fields)
    // are candidate-level data the DTO must never carry at the top level --
    // only the named sourceDocument/signal/signalEvidence/researchItemPayload
    // sub-shapes are serialized. researchItemPayload.stage1.matched_codes
    // (e.g. "naics:541511") is a deliberate exception -- it's the already-
    // locked M6B Stage-1 rule-match summary (docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md),
    // not raw award content, so it's expected to appear there.
    expect(dto).not.toHaveProperty("fields");
    expect(dto).not.toHaveProperty("awardTypeCode");
    expect(dto).not.toHaveProperty("stage1");
    // PSC ("DA01") never contributed to this fixture's Stage-1 match, so it
    // must not appear anywhere in the serialized DTO.
    expect(JSON.stringify(dto)).not.toContain("DA01");
  });

  it("does not duplicate the raw description or recipient name anywhere outside the two fields the RPC actually needs (sourceDocument.excerpt / signal.summary and recipientName)", () => {
    const candidate = buildRealCandidate();
    const dto = serializeCandidateForCommit(candidate);
    const payloadSerialized = JSON.stringify(dto.researchItemPayload);

    // The full award description must appear only in sourceDocument.excerpt/
    // signal.summary (both already part of the locked M6B preview shape),
    // never re-duplicated into researchItemPayload.
    expect(payloadSerialized).not.toContain("This project applies machine learning");
    expect(payloadSerialized).not.toContain("Acme Robotics LLC");
  });

  it("throws CommitSerializationError rather than silently substituting a placeholder when recipientName is missing", () => {
    const candidate = buildRealCandidate({ "Recipient Name": undefined });
    expect(candidate.fields.recipientName).toBeNull();
    expect(() => serializeCandidateForCommit(candidate)).toThrow(CommitSerializationError);
  });
});
