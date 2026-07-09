import { describe, expect, it } from "vitest";
import {
  getActivitySeries,
  getCompanySpotlight,
  getKpiSummary,
  getRecentlyEmerging,
  getSectorOverview,
} from "@/lib/data/dashboard";

describe("getKpiSummary", () => {
  it("returns the exact expected counts for the fixed demo dataset", () => {
    expect(getKpiSummary()).toEqual({
      companyProfiles: 21,
      publishedSignals: 14,
      highConfidenceSignals: 7,
      sectorsCovered: 7,
    });
  });
});

describe("getSectorOverview", () => {
  it("returns all 7 sectors with 3 companies each", () => {
    const overview = getSectorOverview();
    expect(overview).toHaveLength(7);
    for (const item of overview) {
      expect(item.companyCount).toBe(3);
    }
  });
});

describe("getRecentlyEmerging", () => {
  it("returns the top 5 most recent published signals, drafts excluded", () => {
    const items = getRecentlyEmerging(5);
    expect(items).toHaveLength(5);

    const companyIds = items.map((item) => item.company.id);
    expect(companyIds).toEqual([
      "demo-company-6-2",
      "demo-company-6-1",
      "demo-company-5-2",
      "demo-company-5-1",
      "demo-company-4-2",
    ]);

    for (const item of items) {
      expect(item.signal.publication_status).toBe("published");
    }

    const occurredDates = items.map((item) => item.signal.occurred_at);
    const sorted = [...occurredDates].sort().reverse();
    expect(occurredDates).toEqual(sorted);
  });

  it("returns an empty array (not an error) if there were no published signals", () => {
    expect(getRecentlyEmerging(0)).toEqual([]);
  });
});

describe("getActivitySeries", () => {
  it("buckets published signals by month and sums to 14", () => {
    const series = getActivitySeries();
    const total = series.reduce((sum, bucket) => sum + bucket.count, 0);
    expect(total).toBe(14);
    expect(series).toEqual([
      { month: "2026-01", count: 4 },
      { month: "2026-02", count: 2 },
      { month: "2026-03", count: 2 },
      { month: "2026-04", count: 2 },
      { month: "2026-05", count: 2 },
      { month: "2026-06", count: 2 },
    ]);
  });
});

describe("getCompanySpotlight", () => {
  it("deterministically resolves to a partially_verified published signal", () => {
    const first = getCompanySpotlight();
    const second = getCompanySpotlight();
    expect(first).toEqual(second);

    expect(first).toBeDefined();
    expect(first?.signal.verification_status).toBe("partially_verified");
    expect(first?.signal.publication_status).toBe("published");
    expect(first?.sector?.slug).toBe("healthcare");
    expect(first?.company.id).toBe("demo-company-4-2");
  });
});
