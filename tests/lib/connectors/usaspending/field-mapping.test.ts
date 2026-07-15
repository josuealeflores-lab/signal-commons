import { describe, expect, it } from "vitest";
import {
  extractAwardFields,
  buildCandidatePreview,
  isSkippedRecord,
  dedupeAwardsByGeneratedInternalId,
  computeFieldPresenceStats,
  type TaggedRawAward,
} from "@/lib/connectors/usaspending/field-mapping";
import { applyStage1Filter } from "@/lib/connectors/usaspending/stage1-filter";
import type { RawUsaspendingAward } from "@/lib/connectors/usaspending/types";

/**
 * Hermetic -- fixture award record -> exact expected preview object shape
 * (docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md §3/§5.2/§5.3/§5.4),
 * plus the missing-generated_internal_id skip requirement, cross-request
 * dedup, and (after Cowork/Fable's 422-diagnosis review) the award-type-
 * aware field extraction using the confirmed-valid field labels.
 */

const CONTRACT_FIXTURE_AWARD: RawUsaspendingAward = {
  generated_internal_id: "CONT_AWD_TEST123",
  "Award ID": "TEST-CONTRACT-001",
  "Recipient Name": "Acme Robotics LLC",
  "Recipient UEI": "abc123def456",
  "Awarding Agency": "National Science Foundation",
  "Award Amount": 500000,
  "Contract Award Type": "Definitive Contract",
  "Base Obligation Date": "2026-02-15",
  "Start Date": "2020-01-01",
  NAICS: "541511",
  PSC: "DA01",
  Description: "This project applies machine learning to improve robotics.",
  "Last Modified Date": "2026-03-01",
};

const ASSISTANCE_FIXTURE_AWARD: RawUsaspendingAward = {
  generated_internal_id: "ASST_AWD_TEST456",
  "Award ID": "TEST-ASSISTANCE-001",
  "Recipient Name": "Beta Analytics Inc",
  "Recipient UEI": "xyz789ghi012",
  "Awarding Agency": "National Institutes of Health",
  "Award Amount": 250000,
  "Award Type": "Project Grant",
  "Base Obligation Date": "2026-01-10",
  "Start Date": "2020-06-01",
  "CFDA Number": "93.310",
  Description: "A research grant applying predictive analytics to public health data.",
  "Last Modified Date": "2026-02-01",
};

describe("extractAwardFields", () => {
  it("extracts contract fields using the Cowork/Fable-confirmed contract field labels", () => {
    const fields = extractAwardFields(CONTRACT_FIXTURE_AWARD, "contracts");
    expect(fields.generatedInternalId).toBe("CONT_AWD_TEST123");
    expect(fields.recipientName).toBe("Acme Robotics LLC");
    expect(fields.recipientUei).toBe("abc123def456");
    expect(fields.awardingAgency).toBe("National Science Foundation");
    expect(fields.awardAmount).toBe(500000);
    expect(fields.awardTypeLabel).toBe("Definitive Contract");
    expect(fields.actionDate).toBe("2026-02-15");
    expect(fields.startDate).toBe("2020-01-01");
    expect(fields.naicsCode).toBe("541511");
    expect(fields.pscCode).toBe("DA01");
    expect(fields.description).toBe("This project applies machine learning to improve robotics.");
    expect(fields.lastModifiedDate).toBe("2026-03-01");
  });

  it("extracts assistance fields using the Cowork/Fable-confirmed assistance field labels", () => {
    const fields = extractAwardFields(ASSISTANCE_FIXTURE_AWARD, "grants");
    expect(fields.generatedInternalId).toBe("ASST_AWD_TEST456");
    expect(fields.recipientName).toBe("Beta Analytics Inc");
    expect(fields.awardTypeLabel).toBe("Project Grant");
    expect(fields.actionDate).toBe("2026-01-10");
    expect(fields.startDate).toBe("2020-06-01");
    expect(fields.cfdaNumber).toBe("93.310");
    expect(fields.description).toBe("A research grant applying predictive analytics to public health data.");
    expect(fields.lastModifiedDate).toBe("2026-02-01");
  });

  it("reads awardTypeLabel from 'Contract Award Type' for contracts, never from 'Award Type'", () => {
    const fields = extractAwardFields(
      { generated_internal_id: "X", "Contract Award Type": "Delivery Order", "Award Type": "WRONG" },
      "contracts",
    );
    expect(fields.awardTypeLabel).toBe("Delivery Order");
  });

  it("reads awardTypeLabel from 'Award Type' for assistance, not 'Contract Award Type'", () => {
    const fields = extractAwardFields(
      { generated_internal_id: "X", "Award Type": "Cooperative Agreement", "Contract Award Type": "WRONG" },
      "grants",
    );
    expect(fields.awardTypeLabel).toBe("Cooperative Agreement");
  });

  it("falls back to 'Award Type' for a contract record missing 'Contract Award Type' (defensive fallback only)", () => {
    const fields = extractAwardFields({ generated_internal_id: "X", "Award Type": "Fallback Label" }, "contracts");
    expect(fields.awardTypeLabel).toBe("Fallback Label");
  });

  it("returns null for fields that are absent, never fabricating a value", () => {
    const fields = extractAwardFields({ generated_internal_id: "X" }, "contracts");
    expect(fields.recipientName).toBeNull();
    expect(fields.recipientUei).toBeNull();
    expect(fields.actionDate).toBeNull();
    expect(fields.awardAmount).toBeNull();
  });

  it("never infers event_date/occurred_at from Start Date (D-087)", () => {
    const fields = extractAwardFields(
      {
        generated_internal_id: "X",
        "Start Date": "2020-01-01",
        // Base Obligation Date deliberately absent
      },
      "contracts",
    );
    expect(fields.actionDate).toBeNull();
    expect(fields.startDate).toBe("2020-01-01");
  });

  it("recipient parent fields are always null -- never requested from spending_by_award", () => {
    const fields = extractAwardFields(CONTRACT_FIXTURE_AWARD, "contracts");
    expect(fields.recipientParentName).toBeNull();
    expect(fields.recipientParentUei).toBeNull();
  });

  it("still supports old fallback keys defensively (action_date, NAICS Code, PSC Code, last_modified_date, Award Description)", () => {
    const fields = extractAwardFields(
      {
        generated_internal_id: "X",
        action_date: "2026-05-01",
        "NAICS Code": "541512",
        "PSC Code": "DA10",
        last_modified_date: "2026-05-02",
        "Award Description": "Legacy-key fallback description.",
      },
      "contracts",
    );
    expect(fields.actionDate).toBe("2026-05-01");
    expect(fields.naicsCode).toBe("541512");
    expect(fields.pscCode).toBe("DA10");
    expect(fields.lastModifiedDate).toBe("2026-05-02");
    expect(fields.description).toBe("Legacy-key fallback description.");
  });
});

describe("buildCandidatePreview", () => {
  it("builds the exact preview shape for a well-formed contract award", () => {
    const fields = extractAwardFields(CONTRACT_FIXTURE_AWARD, "contracts");
    const stage1 = applyStage1Filter({ description: fields.description, naicsCode: fields.naicsCode });
    const result = buildCandidatePreview(fields, "contracts", stage1);

    expect(isSkippedRecord(result)).toBe(false);
    if (isSkippedRecord(result)) throw new Error("unreachable");

    expect(result.generatedInternalId).toBe("CONT_AWD_TEST123");
    expect(result.researchItemId).toBe("ri-sig-usasp-CONT_AWD_TEST123");
    expect(result.sourceDocumentPreview.id).toBe("usasp-CONT_AWD_TEST123");
    expect(result.sourceDocumentPreview.canonical_url).toBe(
      "https://www.usaspending.gov/award/CONT_AWD_TEST123/",
    );
    expect(result.sourceDocumentPreview.is_demo).toBe(false);
    expect(result.sourceDocumentPreview.event_date).toBe("2026-02-15");
    expect(result.signalPreview.id).toBe("sig-usasp-CONT_AWD_TEST123");
    expect(result.signalPreview.occurred_at).toBe("2026-02-15");
    expect(result.signalPreview.publication_status).toBe("draft");
    expect(result.signalPreview.verification_status).toBe("unverified");
    expect(result.signalPreview.evidence_strength).toBe("high");
    expect(result.signalPreview.is_demo).toBe(false);
    expect(result.signalPreview.created_by_type).toBe("import");
    expect(result.signalEvidencePreview.id).toBe("sig-usasp-CONT_AWD_TEST123-ev-0");
    expect(result.signalEvidencePreview.signal_id).toBe("sig-usasp-CONT_AWD_TEST123");
    expect(result.signalEvidencePreview.source_document_id).toBe("usasp-CONT_AWD_TEST123");
    expect(result.researchItemPayloadPreview.target_table).toBe("signals");
    expect(result.researchItemPayloadPreview.target_id).toBe("sig-usasp-CONT_AWD_TEST123");
    expect(result.researchItemPayloadPreview.connector_key).toBe("usaspending_award_search");
    // stage1 sub-object fields are siblings of suggested_*/confidence, not nested under them.
    expect(result.researchItemPayloadPreview.stage1).toEqual({
      matched_terms: stage1.matchedTerms,
      matched_codes: stage1.matchedCodes,
      agency_flag: stage1.agencyFlag,
      rule_branch: stage1.ruleBranch,
    });
    expect(result.researchItemPayloadPreview.confidence).toBeDefined();
    expect(result.entityPreview).toBeNull();
  });

  it("builds the exact preview shape for a well-formed assistance award", () => {
    const fields = extractAwardFields(ASSISTANCE_FIXTURE_AWARD, "grants");
    const stage1 = applyStage1Filter({ description: fields.description, cfdaText: fields.cfdaNumber });
    const result = buildCandidatePreview(fields, "grants", stage1);

    expect(isSkippedRecord(result)).toBe(false);
    if (isSkippedRecord(result)) throw new Error("unreachable");

    expect(result.generatedInternalId).toBe("ASST_AWD_TEST456");
    expect(result.sourceDocumentPreview.event_date).toBe("2026-01-10");
    expect(result.signalPreview.occurred_at).toBe("2026-01-10");
    expect(result.signalPreview.signal_type).toBe("grant or research award");
  });

  it("never substitutes Start Date for a missing Base Obligation Date in the preview", () => {
    const fields = extractAwardFields(
      {
        generated_internal_id: "NOACTIONDATE",
        "Start Date": "2020-01-01",
        Description: "An artificial intelligence research award.",
      },
      "contracts",
    );
    const stage1 = applyStage1Filter({ description: fields.description });
    const result = buildCandidatePreview(fields, "contracts", stage1);
    if (isSkippedRecord(result)) throw new Error("unreachable");

    expect(result.signalPreview.occurred_at).toBeNull();
    expect(result.sourceDocumentPreview.event_date).toBeNull();
  });

  it("skips a record with a missing generated_internal_id, logging the reason", () => {
    const fields = extractAwardFields({ Description: "Some AI research." }, "contracts");
    const stage1 = applyStage1Filter({ description: fields.description });
    const result = buildCandidatePreview(fields, "contracts", stage1);

    expect(isSkippedRecord(result)).toBe(true);
    if (!isSkippedRecord(result)) throw new Error("unreachable");
    expect(result.reason).toBe("missing_generated_internal_id");
  });

  it("never constructs/fabricates a generated_internal_id when absent", () => {
    const fields = extractAwardFields({}, "contracts");
    expect(fields.generatedInternalId).toBeNull();
  });
});

describe("dedupeAwardsByGeneratedInternalId", () => {
  it("keeps the first occurrence and drops later duplicates by generated_internal_id", () => {
    const records = [
      { raw: { generated_internal_id: "A" }, requestKind: "contracts" as const },
      { raw: { generated_internal_id: "B" }, requestKind: "contracts" as const },
      { raw: { generated_internal_id: "A" }, requestKind: "grants" as const },
    ];
    const deduped = dedupeAwardsByGeneratedInternalId(records);

    expect(deduped).toHaveLength(2);
    expect(deduped[0].raw.generated_internal_id).toBe("A");
    expect(deduped[0].requestKind).toBe("contracts");
    expect(deduped[1].raw.generated_internal_id).toBe("B");
  });

  it("passes through records with a missing id unchanged (never deduped away)", () => {
    const records = [
      { raw: {}, requestKind: "contracts" as const },
      { raw: {}, requestKind: "grants" as const },
    ];
    const deduped = dedupeAwardsByGeneratedInternalId(records);
    expect(deduped).toHaveLength(2);
  });
});

describe("computeFieldPresenceStats", () => {
  /**
   * Cowork/Fable's observability request: the cap=4 live smoke test
   * produced zero candidates (everything Stage-1-excluded), leaving no
   * way to check field-mapping coverage. These stats must therefore be
   * computed from every fetched/deduped record BEFORE Stage-1 filtering,
   * using the same extractAwardFields() the candidate path reads, so a
   * regression in either path shows up here even on an all-excluded run.
   */

  it("counts totalRecordsInspected and byRequestKind across all records, including ones Stage-1 would go on to exclude", () => {
    const records: TaggedRawAward[] = [
      { raw: { generated_internal_id: "A", Description: "Routine facilities maintenance." }, requestKind: "contracts" },
      { raw: { generated_internal_id: "B", Description: "Another non-AI record." }, requestKind: "grants" },
    ];
    const stats = computeFieldPresenceStats(records);

    expect(stats.totalRecordsInspected).toBe(2);
    expect(stats.byRequestKind).toEqual({ contracts: 1, grants: 1, other_financial_assistance: 0, direct_payments: 0 });
  });

  it("counts generated_internal_id and Description presence using the real extractAwardFields keys", () => {
    const records: TaggedRawAward[] = [
      { raw: { generated_internal_id: "A", Description: "Has both fields." }, requestKind: "contracts" },
      { raw: { Description: "Missing id." }, requestKind: "contracts" },
      { raw: { generated_internal_id: "C" }, requestKind: "contracts" },
    ];
    const stats = computeFieldPresenceStats(records);

    expect(stats.generatedInternalIdPresentCount).toBe(2);
    expect(stats.descriptionPresentCount).toBe(2);
  });

  it("counts Base Obligation Date, Last Modified Date, NAICS, PSC, CFDA Number, and awardTypeCode presence", () => {
    const records: TaggedRawAward[] = [
      {
        raw: {
          generated_internal_id: "A",
          "Base Obligation Date": "2026-01-01",
          "Last Modified Date": "2026-02-01",
          NAICS: "541511",
          PSC: "DA01",
          award_type_code: "A",
        },
        requestKind: "contracts",
      },
      {
        raw: {
          generated_internal_id: "B",
          "CFDA Number": "93.310",
        },
        requestKind: "grants",
      },
    ];
    const stats = computeFieldPresenceStats(records);

    expect(stats.baseObligationDatePresentCount).toBe(1);
    expect(stats.lastModifiedDatePresentCount).toBe(1);
    expect(stats.naicsPresentCount).toBe(1);
    expect(stats.pscPresentCount).toBe(1);
    expect(stats.cfdaNumberPresentCount).toBe(1);
    expect(stats.awardTypeCodePresentCount).toBe(1);
  });

  it("counts Start Date presence as context only -- never conflated with Base Obligation Date (D-087)", () => {
    const records: TaggedRawAward[] = [
      { raw: { generated_internal_id: "A", "Start Date": "2020-01-01" }, requestKind: "contracts" },
    ];
    const stats = computeFieldPresenceStats(records);

    expect(stats.startDatePresentCount).toBe(1);
    expect(stats.baseObligationDatePresentCount).toBe(0);
  });

  it("counts Contract Award Type and Award Type presence separately by requestKind, per the same award-type-aware key selection extractAwardFields uses", () => {
    const records: TaggedRawAward[] = [
      { raw: { generated_internal_id: "A", "Contract Award Type": "Definitive Contract" }, requestKind: "contracts" },
      { raw: { generated_internal_id: "B", "Award Type": "Project Grant" }, requestKind: "grants" },
      // A grants record with only "Contract Award Type" (wrong key for its kind) must NOT count as awardTypePresent.
      { raw: { generated_internal_id: "C", "Contract Award Type": "Wrong Key For Grants" }, requestKind: "grants" },
    ];
    const stats = computeFieldPresenceStats(records);

    expect(stats.contractAwardTypePresentCount).toBe(1);
    expect(stats.awardTypePresentCount).toBe(1);
  });

  it("returns all-zero stats for an empty input", () => {
    const stats = computeFieldPresenceStats([]);
    expect(stats.totalRecordsInspected).toBe(0);
    expect(stats.generatedInternalIdPresentCount).toBe(0);
    expect(stats.descriptionPresentCount).toBe(0);
  });

  it("never includes a raw value, recipient name, description text, or example record -- only counts", () => {
    const records: TaggedRawAward[] = [
      {
        raw: {
          generated_internal_id: "SENSITIVE-ID-1",
          "Recipient Name": "A Real Company Name LLC",
          Description: "A detailed award description that must never leak into aggregate stats.",
        },
        requestKind: "contracts",
      },
    ];
    const stats = computeFieldPresenceStats(records);
    const serialized = JSON.stringify(stats);

    expect(serialized).not.toContain("SENSITIVE-ID-1");
    expect(serialized).not.toContain("A Real Company Name LLC");
    expect(serialized).not.toContain("A detailed award description");
    // Every value in the stats object must be a number or a nested record of numbers.
    const isAllNumeric = (value: unknown): boolean =>
      typeof value === "number" || (typeof value === "object" && value !== null && Object.values(value).every((v) => typeof v === "number"));
    expect(Object.values(stats).every(isAllNumeric)).toBe(true);
  });
});
