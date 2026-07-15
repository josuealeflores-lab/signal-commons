import { describe, expect, it } from "vitest";
import { previewEntityDecision, looksLikePersonName, normalizeName } from "@/lib/connectors/usaspending/entity-resolution-preview";
import type { EntityAliasRecord } from "@/lib/connectors/usaspending/types";

/**
 * Hermetic -- previewEntityDecision is a pure function, no Supabase client
 * involved anywhere (Cowork/Fable's recommended M6B design). Covers every
 * docs/ENTITY_RESOLUTION_POLICY.md §5 branch: MATCH, NEW, AMBIGUOUS
 * (name_collision/no_uei/possible_individual), CONFLICT (duplicate_uei),
 * intra-batch matching, and parent/subsidiary as informational-only.
 */

describe("previewEntityDecision: MATCH", () => {
  it("matches an existing UEI alias (single company)", () => {
    const existing: EntityAliasRecord[] = [{ companyId: "co-1", aliasType: "uei", normalizedAlias: "UEI123" }];
    const result = previewEntityDecision(
      { recipientName: "Acme Corp", recipientUei: "uei123", recipientParentName: null, recipientParentUei: null },
      existing,
      new Map(),
    );
    expect(result.decision).toBe("MATCH");
    expect(result.matchedCompanyId).toBe("co-1");
  });

  it("matches intra-batch: two candidates sharing a UEI in the same run", () => {
    const seenInBatch = new Map<string, string>();
    seenInBatch.set("UEI999", "batch:first-award");

    const result = previewEntityDecision(
      { recipientName: "Beta Systems Inc", recipientUei: "uei999", recipientParentName: null, recipientParentUei: null },
      [],
      seenInBatch,
    );
    expect(result.decision).toBe("MATCH");
    expect(result.matchedCompanyId).toBe("batch:first-award");
  });
});

describe("previewEntityDecision: NEW", () => {
  it("proposes NEW when the UEI matches nothing existing or in-batch", () => {
    const result = previewEntityDecision(
      { recipientName: "Gamma Analytics LLC", recipientUei: "uei777", recipientParentName: null, recipientParentUei: null },
      [],
      new Map(),
    );
    expect(result.decision).toBe("NEW");
    expect(result.matchedCompanyId).toBeNull();
  });
});

describe("previewEntityDecision: AMBIGUOUS (no_uei)", () => {
  it("routes to AMBIGUOUS/no_uei when the recipient has no UEI at all", () => {
    const result = previewEntityDecision(
      { recipientName: "Delta Contracting Co", recipientUei: null, recipientParentName: null, recipientParentUei: null },
      [],
      new Map(),
    );
    expect(result.decision).toBe("AMBIGUOUS");
    expect(result.reason).toBe("no_uei");
    expect(result.matchedCompanyId).toBeNull();
  });
});

describe("previewEntityDecision: AMBIGUOUS (name_collision)", () => {
  it("routes to AMBIGUOUS/name_collision when the name matches an existing alias under a different UEI", () => {
    const existing: EntityAliasRecord[] = [
      { companyId: "co-2", aliasType: "legal_name", normalizedAlias: normalizeName("Epsilon Robotics Inc") },
    ];
    const result = previewEntityDecision(
      { recipientName: "Epsilon Robotics Inc", recipientUei: "uei-different", recipientParentName: null, recipientParentUei: null },
      existing,
      new Map(),
    );
    expect(result.decision).toBe("AMBIGUOUS");
    expect(result.reason).toBe("name_collision");
    expect(result.matchedCompanyId).toBeNull();
  });

  it("never auto-reuses on a name-similar/different-UEI case", () => {
    const existing: EntityAliasRecord[] = [
      { companyId: "co-2", aliasType: "dba", normalizedAlias: normalizeName("Zeta Data Systems") },
    ];
    const result = previewEntityDecision(
      { recipientName: "Zeta Data Systems", recipientUei: "uei-999", recipientParentName: null, recipientParentUei: null },
      existing,
      new Map(),
    );
    expect(result.decision).not.toBe("MATCH");
  });
});

describe("previewEntityDecision: CONFLICT (duplicate_uei)", () => {
  it("flags CONFLICT when a UEI matches two different existing companies", () => {
    const existing: EntityAliasRecord[] = [
      { companyId: "co-3", aliasType: "uei", normalizedAlias: "UEIDUP" },
      { companyId: "co-4", aliasType: "uei", normalizedAlias: "UEIDUP" },
    ];
    const result = previewEntityDecision(
      { recipientName: "Eta Manufacturing Corp", recipientUei: "ueidup", recipientParentName: null, recipientParentUei: null },
      existing,
      new Map(),
    );
    expect(result.decision).toBe("CONFLICT");
    expect(result.reason).toBe("duplicate_uei");
  });

  it("flags CONFLICT when an existing alias and an intra-batch entry disagree on company for the same UEI", () => {
    const existing: EntityAliasRecord[] = [{ companyId: "co-5", aliasType: "uei", normalizedAlias: "UEICONF" }];
    const seenInBatch = new Map<string, string>([["UEICONF", "batch:other-award"]]);

    const result = previewEntityDecision(
      { recipientName: "Theta Labs", recipientUei: "ueiconf", recipientParentName: null, recipientParentUei: null },
      existing,
      seenInBatch,
    );
    expect(result.decision).toBe("CONFLICT");
    expect(result.reason).toBe("duplicate_uei");
  });

  it("never auto-merges on a duplicate_uei conflict", () => {
    const existing: EntityAliasRecord[] = [
      { companyId: "co-6", aliasType: "uei", normalizedAlias: "UEIX" },
      { companyId: "co-7", aliasType: "uei", normalizedAlias: "UEIX" },
    ];
    const result = previewEntityDecision(
      { recipientName: "Iota Group", recipientUei: "ueix", recipientParentName: null, recipientParentUei: null },
      existing,
      new Map(),
    );
    expect(result.matchedCompanyId).toBeNull();
  });
});

describe("previewEntityDecision: possible_individual (R5)", () => {
  it("routes a comma-inverted name to possible_individual, never NEW", () => {
    const result = previewEntityDecision(
      { recipientName: "Smith, John", recipientUei: "uei-person-1", recipientParentName: null, recipientParentUei: null },
      [],
      new Map(),
    );
    expect(result.decision).toBe("AMBIGUOUS");
    expect(result.reason).toBe("possible_individual");
    expect(result.isPossibleIndividual).toBe(true);
    expect(result.decision).not.toBe("NEW");
  });

  it("routes a bare two-token capitalized name to possible_individual", () => {
    const result = previewEntityDecision(
      { recipientName: "Jane Doe", recipientUei: "uei-person-2", recipientParentName: null, recipientParentUei: null },
      [],
      new Map(),
    );
    expect(result.isPossibleIndividual).toBe(true);
    expect(result.decision).not.toBe("NEW");
  });

  it("does not flag a business name with a common suffix as a possible individual", () => {
    const result = previewEntityDecision(
      { recipientName: "Jane Doe Consulting LLC", recipientUei: "uei-biz-1", recipientParentName: null, recipientParentUei: null },
      [],
      new Map(),
    );
    expect(result.isPossibleIndividual).toBe(false);
  });

  it("R5 runs before MATCH -- a person-shaped name never proceeds to NEW/MATCH even if the UEI has an existing alias", () => {
    const existing: EntityAliasRecord[] = [{ companyId: "co-8", aliasType: "uei", normalizedAlias: "UEIPERSON" }];
    const result = previewEntityDecision(
      { recipientName: "Doe, Jane", recipientUei: "ueiperson", recipientParentName: null, recipientParentUei: null },
      existing,
      new Map(),
    );
    expect(result.decision).toBe("AMBIGUOUS");
    expect(result.reason).toBe("possible_individual");
  });
});

describe("previewEntityDecision: parent/subsidiary is informational only", () => {
  it("includes a parent note but never changes the decision", () => {
    const withParent = previewEntityDecision(
      {
        recipientName: "Kappa Subsidiary Corp",
        recipientUei: "uei-kappa",
        recipientParentName: "Kappa Holdings",
        recipientParentUei: "uei-parent",
      },
      [],
      new Map(),
    );
    expect(withParent.parentSubsidiaryNote).not.toBeNull();
    expect(withParent.decision).toBe("NEW");

    const withoutParent = previewEntityDecision(
      { recipientName: "Lambda Standalone Inc", recipientUei: "uei-lambda", recipientParentName: null, recipientParentUei: null },
      [],
      new Map(),
    );
    expect(withoutParent.parentSubsidiaryNote).toBeNull();
    expect(withoutParent.decision).toBe("NEW");
  });
});

describe("looksLikePersonName", () => {
  it("returns false for null/empty names", () => {
    expect(looksLikePersonName(null)).toBe(false);
    expect(looksLikePersonName("")).toBe(false);
  });

  it("returns false for names with common business suffixes", () => {
    expect(looksLikePersonName("Acme Systems Inc")).toBe(false);
    expect(looksLikePersonName("Beta University")).toBe(false);
  });
});
