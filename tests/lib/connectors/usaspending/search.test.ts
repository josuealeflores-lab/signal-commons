import { describe, expect, it } from "vitest";
import {
  buildSearchRequestBody,
  ALL_REQUEST_KINDS,
  CONTRACT_AWARD_TYPE_CODES,
  GRANT_AWARD_TYPE_CODES,
  OTHER_FINANCIAL_ASSISTANCE_AWARD_TYPE_CODES,
  DIRECT_PAYMENTS_AWARD_TYPE_CODES,
  ASSISTANCE_AWARD_TYPE_CODES,
  REQUESTED_ASSISTANCE_AWARD_TYPE_CODES,
  VALIDATED_ASSISTANCE_AWARD_TYPE_CODES,
  UNVALIDATED_ASSISTANCE_AWARD_TYPE_CODES,
  UNTESTED_LOAN_AWARD_TYPE_CODES,
  isUnvalidatedAssistanceCode,
  isUntestedLoanAssistanceCode,
} from "@/lib/connectors/usaspending/search";

/**
 * Hermetic (no live API, no DB) -- exercises D-086 (extended): USAspending
 * requires award_type_codes in one request to come from exactly one of its
 * own award_type_groups. A live HTTP 422 during M6B's second smoke test
 * revealed this applies not just to contracts-vs-assistance but *within*
 * assistance too (grants/other_financial_assistance/direct_payments are
 * three separate groups) -- this connector now issues one request per
 * group, never mixing codes across groups. Also covers D-087 (time_period
 * is the operational sampling frame) and the 07/08 loan-code exclusion.
 */

const WINDOW = { startDate: "2026-01-01", endDate: "2026-03-31" };

describe("buildSearchRequestBody: award_type_codes per group", () => {
  it("contracts request uses A-D", () => {
    const body = buildSearchRequestBody("contracts", WINDOW, 1, 100);
    expect(body.filters.award_type_codes).toEqual(["A", "B", "C", "D"]);
  });

  it("grants request uses exactly 02-05", () => {
    const body = buildSearchRequestBody("grants", WINDOW, 1, 100);
    expect(body.filters.award_type_codes).toEqual(["02", "03", "04", "05"]);
  });

  it("direct_payments request uses exactly 06 and 10", () => {
    const body = buildSearchRequestBody("direct_payments", WINDOW, 1, 100);
    expect(body.filters.award_type_codes).toEqual(["06", "10"]);
  });

  it("other_financial_assistance request uses exactly 09 and 11", () => {
    const body = buildSearchRequestBody("other_financial_assistance", WINDOW, 1, 100);
    expect(body.filters.award_type_codes).toEqual(["09", "11"]);
  });

  it("no request kind's award_type_codes ever mixes with another's (no award_type_group is ever split across two kinds)", () => {
    const allCodes = ALL_REQUEST_KINDS.map((kind) => new Set(buildSearchRequestBody(kind, WINDOW, 1, 100).filters.award_type_codes));
    for (let i = 0; i < allCodes.length; i += 1) {
      for (let j = i + 1; j < allCodes.length; j += 1) {
        const intersection = [...allCodes[i]].filter((code) => allCodes[j].has(code));
        expect(intersection).toEqual([]);
      }
    }
  });

  it("07/08 are excluded from every request kind's award_type_codes", () => {
    for (const kind of ALL_REQUEST_KINDS) {
      const body = buildSearchRequestBody(kind, WINDOW, 1, 100);
      expect(body.filters.award_type_codes).not.toContain("07");
      expect(body.filters.award_type_codes).not.toContain("08");
    }
  });

  it("uses time_period as the operational sampling frame (D-087)", () => {
    const body = buildSearchRequestBody("contracts", WINDOW, 1, 100);
    expect(body.filters.time_period).toEqual([{ start_date: "2026-01-01", end_date: "2026-03-31" }]);
  });

  it("includes page and limit as requested", () => {
    const body = buildSearchRequestBody("contracts", WINDOW, 3, 50);
    expect(body.page).toBe(3);
    expect(body.limit).toBe(50);
  });
});

describe("buildSearchRequestBody: diagnosticKeyword (DIAGNOSTIC ONLY)", () => {
  it("omits filters.description entirely when diagnosticKeyword is not passed (normal, non-diagnostic path)", () => {
    const body = buildSearchRequestBody("contracts", WINDOW, 1, 100);
    expect(body.filters).not.toHaveProperty("description");
  });

  it("omits filters.description when diagnosticKeyword is passed as undefined", () => {
    const body = buildSearchRequestBody("contracts", WINDOW, 1, 100, undefined);
    expect(body.filters).not.toHaveProperty("description");
  });

  it("adds filters.description only when diagnosticKeyword is explicitly provided -- the exact key confirmed against a real 200 response in docs/research/usaspending_pull_log.md", () => {
    const body = buildSearchRequestBody("contracts", WINDOW, 1, 100, "artificial intelligence");
    expect(body.filters.description).toBe("artificial intelligence");
  });

  it("does not otherwise change the request body when diagnosticKeyword is provided", () => {
    const withoutKeyword = buildSearchRequestBody("grants", WINDOW, 1, 100);
    const withKeyword = buildSearchRequestBody("grants", WINDOW, 1, 100, "machine learning");

    expect(withKeyword.filters.award_type_codes).toEqual(withoutKeyword.filters.award_type_codes);
    expect(withKeyword.filters.time_period).toEqual(withoutKeyword.filters.time_period);
    expect(withKeyword.fields).toEqual(withoutKeyword.fields);
    expect(withKeyword.page).toBe(withoutKeyword.page);
    expect(withKeyword.limit).toBe(withoutKeyword.limit);
  });

  it("applies diagnosticKeyword consistently across every request kind", () => {
    for (const kind of ALL_REQUEST_KINDS) {
      const body = buildSearchRequestBody(kind, WINDOW, 1, 100, "autonomous");
      expect(body.filters.description).toBe("autonomous");
    }
  });
});

describe("buildSearchRequestBody: fields per group", () => {
  it("contracts requests use contract-specific fields (Contract Award Type, Base Obligation Date, NAICS, PSC, Description, Last Modified Date)", () => {
    const body = buildSearchRequestBody("contracts", WINDOW, 1, 100);
    expect(body.fields).toEqual([
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
    ]);
  });

  it("contracts requests never include assistance-only or unverified fields", () => {
    const body = buildSearchRequestBody("contracts", WINDOW, 1, 100);
    for (const forbidden of [
      "Award Type",
      "CFDA Number",
      "Recipient Parent Name",
      "Recipient Parent UEI",
      "action_date",
      "last_modified_date",
      "NAICS Code",
      "PSC Code",
      "Award Description",
    ]) {
      expect(body.fields).not.toContain(forbidden);
    }
  });

  it("grants/other_financial_assistance/direct_payments all use the same assistance fields (Award Type, Base Obligation Date, CFDA Number, Description, Last Modified Date)", () => {
    const expected = [
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
    ];
    expect(buildSearchRequestBody("grants", WINDOW, 1, 100).fields).toEqual(expected);
    expect(buildSearchRequestBody("other_financial_assistance", WINDOW, 1, 100).fields).toEqual(expected);
    expect(buildSearchRequestBody("direct_payments", WINDOW, 1, 100).fields).toEqual(expected);
  });

  it("assistance-family requests never include parent fields or unverified snake_case fields", () => {
    for (const kind of ["grants", "other_financial_assistance", "direct_payments"] as const) {
      const body = buildSearchRequestBody(kind, WINDOW, 1, 100);
      for (const forbidden of [
        "Recipient Parent Name",
        "Recipient Parent UEI",
        "action_date",
        "last_modified_date",
        "Award Description",
      ]) {
        expect(body.fields).not.toContain(forbidden);
      }
    }
  });

  it("contract and assistance-family fields arrays are distinct, not a shared array", () => {
    const contractBody = buildSearchRequestBody("contracts", WINDOW, 1, 100);
    const grantsBody = buildSearchRequestBody("grants", WINDOW, 1, 100);
    expect(contractBody.fields).not.toEqual(grantsBody.fields);
  });
});

describe("assistance code buckets (labeling/recall-validation framing, independent of request grouping)", () => {
  it("validated bucket is exactly 02-05", () => {
    expect(VALIDATED_ASSISTANCE_AWARD_TYPE_CODES).toEqual(["02", "03", "04", "05"]);
  });

  it("unvalidated bucket is exactly 06-11", () => {
    expect(UNVALIDATED_ASSISTANCE_AWARD_TYPE_CODES).toEqual(["06", "07", "08", "09", "10", "11"]);
  });

  it("the two buckets together equal the full 02-11 assistance code list", () => {
    expect([...VALIDATED_ASSISTANCE_AWARD_TYPE_CODES, ...UNVALIDATED_ASSISTANCE_AWARD_TYPE_CODES]).toEqual([
      ...ASSISTANCE_AWARD_TYPE_CODES,
    ]);
  });

  it("isUnvalidatedAssistanceCode is true only for 06-11", () => {
    for (const code of VALIDATED_ASSISTANCE_AWARD_TYPE_CODES) {
      expect(isUnvalidatedAssistanceCode(code)).toBe(false);
    }
    for (const code of UNVALIDATED_ASSISTANCE_AWARD_TYPE_CODES) {
      expect(isUnvalidatedAssistanceCode(code)).toBe(true);
    }
  });

  it("contract codes are never flagged as unvalidated assistance codes", () => {
    for (const code of CONTRACT_AWARD_TYPE_CODES) {
      expect(isUnvalidatedAssistanceCode(code)).toBe(false);
    }
  });
});

describe("award_type_group split constants", () => {
  it("grants equals the validated 02-05 range", () => {
    expect(GRANT_AWARD_TYPE_CODES).toEqual(["02", "03", "04", "05"]);
  });

  it("direct_payments is exactly 06 and 10", () => {
    expect(DIRECT_PAYMENTS_AWARD_TYPE_CODES).toEqual(["06", "10"]);
  });

  it("other_financial_assistance is exactly 09 and 11", () => {
    expect(OTHER_FINANCIAL_ASSISTANCE_AWARD_TYPE_CODES).toEqual(["09", "11"]);
  });

  it("loan codes 07/08 are excluded from REQUESTED_ASSISTANCE_AWARD_TYPE_CODES", () => {
    expect(UNTESTED_LOAN_AWARD_TYPE_CODES).toEqual(["07", "08"]);
    for (const code of UNTESTED_LOAN_AWARD_TYPE_CODES) {
      expect(REQUESTED_ASSISTANCE_AWARD_TYPE_CODES).not.toContain(code);
    }
  });

  it("REQUESTED_ASSISTANCE_AWARD_TYPE_CODES is exactly the union of grants + other_financial_assistance + direct_payments", () => {
    expect(REQUESTED_ASSISTANCE_AWARD_TYPE_CODES).toEqual(["02", "03", "04", "05", "09", "11", "06", "10"]);
  });

  it("isUntestedLoanAssistanceCode is true only for 07/08", () => {
    expect(isUntestedLoanAssistanceCode("07")).toBe(true);
    expect(isUntestedLoanAssistanceCode("08")).toBe(true);
    for (const code of REQUESTED_ASSISTANCE_AWARD_TYPE_CODES) {
      expect(isUntestedLoanAssistanceCode(code)).toBe(false);
    }
  });

  it("ALL_REQUEST_KINDS is exactly the four non-loan kinds, contracts first", () => {
    expect(ALL_REQUEST_KINDS).toEqual(["contracts", "grants", "other_financial_assistance", "direct_payments"]);
  });
});

describe("regression: official award_type_group mapping (Cowork/Fable caught a direct_payments/other_financial_assistance swap)", () => {
  /**
   * M6B's first award_type_group-split patch had these two groups
   * SWAPPED: other_financial_assistance was requesting 06/10 and
   * direct_payments was requesting 09/11 -- backwards from the official
   * USAspending spending_by_award contract. Both requests were still
   * internally single-group (so neither ever 422'd), which is exactly why
   * disjointness-only tests (award_type_codes never mixing across kinds)
   * passed the whole time and did NOT catch this -- the bug was a
   * provenance/labeling error, not a request-validity error. This test
   * pins each requestKind to its official, specific code set (not just
   * "distinct from the others") so a future swap of this kind fails here
   * immediately.
   */
  it("pins every requestKind's award_type_codes to the official expected set, not merely to being distinct", () => {
    const expectedCodesByKind: Record<string, string[]> = {
      contracts: ["A", "B", "C", "D"],
      grants: ["02", "03", "04", "05"],
      direct_payments: ["06", "10"],
      other_financial_assistance: ["09", "11"],
    };

    for (const kind of ALL_REQUEST_KINDS) {
      const body = buildSearchRequestBody(kind, WINDOW, 1, 100);
      expect(body.filters.award_type_codes).toEqual(expectedCodesByKind[kind]);
    }
  });
});
