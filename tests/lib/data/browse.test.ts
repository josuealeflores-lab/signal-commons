import { describe, expect, it } from "vitest";
import {
  filterCompanyViews,
  filterSignalViews,
  getAvailableCompanyTypes,
  getAvailableMonths,
  getAvailableSignalTypes,
  getCompanyView,
  getCompanyViews,
  getSectorDetailView,
  getSignalView,
  getSignalViews,
  sortCompanyViews,
} from "@/lib/data/browse";

describe("getCompanyViews", () => {
  it("returns all 21 companies", () => {
    expect(getCompanyViews()).toHaveLength(21);
  });

  it("gives a company with a published signal a non-empty signals array", () => {
    const view = getCompanyView("civiclens-demo");
    expect(view?.signals).toHaveLength(1);
    expect(view?.primarySignal?.publication_status).toBe("published");
  });

  it("gives a draft-only company an empty signals array — the draft never reaches the view", () => {
    const view = getCompanyView("publicsignal-demo");
    expect(view?.signals).toEqual([]);
    expect(view?.primarySignal).toBeUndefined();
  });

  it("getCompanyView returns undefined for an unknown slug", () => {
    expect(getCompanyView("does-not-exist")).toBeUndefined();
  });
});

describe("getSignalViews / getSignalView", () => {
  it("returns exactly 14 published signals, zero drafts", () => {
    const views = getSignalViews();
    expect(views).toHaveLength(14);
    for (const view of views) {
      expect(view.signal.publication_status).toBe("published");
    }
  });

  it("getSignalView returns undefined for a draft id and for a nonexistent id alike", () => {
    expect(getSignalView("demo-signal-1-3")).toBeUndefined();
    expect(getSignalView("demo-signal-does-not-exist")).toBeUndefined();
  });

  it("getSignalView returns the joined view for a known published id, with resolved sources", () => {
    const view = getSignalView("demo-signal-1-1");
    expect(view?.company.id).toBe("demo-company-1-1");
    expect(view?.sector?.slug).toBe("politics-civic-technology");
    expect(view?.sources.length).toBeGreaterThan(0);
  });
});

describe("getSectorDetailView", () => {
  it("returns 3 companies for every sector", () => {
    const view = getSectorDetailView("healthcare");
    expect(view?.companies).toHaveLength(3);
  });

  it("returns undefined for an unknown sector slug", () => {
    expect(getSectorDetailView("not-a-sector")).toBeUndefined();
  });
});

describe("filterCompanyViews", () => {
  const all = getCompanyViews();

  it("filters by sector", () => {
    const filtered = filterCompanyViews(all, { sector: "healthcare" });
    expect(filtered).toHaveLength(3);
    expect(filtered.every((v) => v.company.primary_sector_slug === "healthcare")).toBe(true);
  });

  it("filters by search query against name/summary", () => {
    const filtered = filterCompanyViews(all, { q: "civiclens" });
    expect(filtered.map((v) => v.company.slug)).toEqual(["civiclens-demo"]);
  });

  it("filters by evidence strength, excluding companies with no published signal", () => {
    const filtered = filterCompanyViews(all, { evidenceStrength: "high" });
    // one "high" company per sector = 7
    expect(filtered).toHaveLength(7);
    expect(filtered.some((v) => v.company.slug === "publicsignal-demo")).toBe(false);
  });
});

describe("filterSignalViews", () => {
  const all = getSignalViews();

  it("filters signals to a single sector's 2 published signals", () => {
    const filtered = filterSignalViews(all, { sector: "healthcare" });
    expect(filtered).toHaveLength(2);
  });

  it("filters by verification status", () => {
    const filtered = filterSignalViews(all, { verificationStatus: "verified" });
    expect(filtered).toHaveLength(7);
  });
});

describe("getAvailableSignalTypes / getAvailableCompanyTypes / getAvailableMonths", () => {
  it("only returns values actually present in the published dataset", () => {
    // "partnership" only ever occurs on the N-3 (always-draft) signal position,
    // so it correctly never appears here — getAvailableSignalTypes is derived
    // from getSignalViews(), which is published-only.
    expect(getAvailableSignalTypes()).toEqual(["pilot_program", "product_launch"]);
    expect(getAvailableCompanyTypes()).toEqual([
      "agent_enabled",
      "agent_native",
      "agent_product",
      "ai_application",
    ]);
    expect(getAvailableMonths()).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
  });
});

describe("sortCompanyViews", () => {
  const all = getCompanyViews();

  it("sorts alphabetically by name", () => {
    const sorted = sortCompanyViews(all, "name");
    const names = sorted.map((v) => v.company.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("sorts by sector display_order, then name within sector", () => {
    const sorted = sortCompanyViews(all, "sector");
    expect(sorted[0].sector?.slug).toBe("politics-civic-technology");
    expect(sorted[sorted.length - 1].sector?.slug).toBe("climate-energy");
  });
});
