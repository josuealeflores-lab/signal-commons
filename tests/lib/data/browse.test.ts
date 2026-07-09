import { describe, expect, it } from "vitest";
import { filterCompanyViews, filterSignalViews, sortCompanyViews } from "@/lib/data/browse";
import type { CompanyView, SignalView } from "@/lib/data/browse";
import type { Company, Sector, Signal } from "@/lib/data/schema";

/**
 * These tests exercise only the pure, synchronous functions in browse.ts
 * (filterCompanyViews, filterSignalViews, sortCompanyViews) — the ones
 * that never touch Supabase — using small hand-built fixture arrays, so
 * they stay fully hermetic under `npm test`. Every other function in
 * browse.ts now queries the live database and is covered by
 * `npm run test:db` integration tests instead.
 */

const healthcareSector: Sector = {
  slug: "healthcare",
  name: "Healthcare",
  icon_key: "medical-cross",
  display_order: 4,
};

const educationSector: Sector = {
  slug: "education",
  name: "Education",
  icon_key: "graduation-cap",
  display_order: 5,
};

function makeCompany(overrides: Partial<Company>): Company {
  return {
    id: "demo-company-x",
    slug: "demo-company-x",
    name: "Demo Company X",
    summary: "A fictional demo company summary.",
    why_it_matters: "A fictional why-it-matters statement.",
    company_type: "ai_application",
    stage: "discovery",
    primary_sector_slug: "healthcare",
    is_demo: true,
    publication_status: "published",
    ...overrides,
  };
}

function makeSignal(overrides: Partial<Signal>): Signal {
  return {
    id: "demo-signal-x",
    company_id: "demo-company-x",
    signal_type: "product_launch",
    headline: "Demo headline",
    summary: "Demo summary",
    why_it_matters: "Demo why it matters",
    occurred_at: "2026-01-10T12:00:00Z",
    detected_at: "2026-07-04T12:00:00Z",
    evidence_strength: "high",
    verification_status: "verified",
    publication_status: "published",
    is_demo: true,
    created_by_type: "import",
    evidence: [
      {
        source_document_id: "demo-source-x",
        support_type: "supports",
        claim_type: "analysis",
        supporting_passage: "Demo passage.",
      },
    ],
    ...overrides,
  };
}

function makeCompanyView(overrides: Partial<CompanyView> & { company: Company }): CompanyView {
  return {
    sector: healthcareSector,
    signals: [],
    primarySignal: undefined,
    ...overrides,
  };
}

function makeSignalView(overrides: Partial<SignalView> & { signal: Signal; company: Company }): SignalView {
  return {
    sector: healthcareSector,
    sources: [],
    ...overrides,
  };
}

describe("filterCompanyViews", () => {
  const civicLens = makeCompanyView({
    company: makeCompany({ id: "c1", slug: "civiclens-demo", name: "CivicLens Demo", primary_sector_slug: "healthcare" }),
    primarySignal: makeSignal({ evidence_strength: "high" }),
  });
  const agriScout = makeCompanyView({
    company: makeCompany({ id: "c2", slug: "agriscout-demo", name: "AgriScout Demo", primary_sector_slug: "education" }),
    sector: educationSector,
    primarySignal: makeSignal({ evidence_strength: "medium" }),
  });
  const noSignalYet = makeCompanyView({
    company: makeCompany({ id: "c3", slug: "no-signal-demo", name: "No Signal Demo", primary_sector_slug: "healthcare" }),
    primarySignal: undefined,
  });
  const all = [civicLens, agriScout, noSignalYet];

  it("filters by sector", () => {
    const filtered = filterCompanyViews(all, { sector: "healthcare" });
    expect(filtered.map((v) => v.company.slug)).toEqual(["civiclens-demo", "no-signal-demo"]);
  });

  it("filters by search query against name/summary", () => {
    const filtered = filterCompanyViews(all, { q: "civiclens" });
    expect(filtered.map((v) => v.company.slug)).toEqual(["civiclens-demo"]);
  });

  it("filters by evidence strength, excluding companies with no published signal", () => {
    const filtered = filterCompanyViews(all, { evidenceStrength: "high" });
    expect(filtered.map((v) => v.company.slug)).toEqual(["civiclens-demo"]);
    expect(filtered.some((v) => v.company.slug === "no-signal-demo")).toBe(false);
  });
});

describe("filterSignalViews", () => {
  const healthcareSignal = makeSignalView({
    signal: makeSignal({ id: "s1", verification_status: "verified" }),
    company: makeCompany({ id: "c1", primary_sector_slug: "healthcare" }),
    sector: healthcareSector,
  });
  const educationSignal = makeSignalView({
    signal: makeSignal({ id: "s2", verification_status: "partially_verified" }),
    company: makeCompany({ id: "c2", primary_sector_slug: "education" }),
    sector: educationSector,
  });
  const all = [healthcareSignal, educationSignal];

  it("filters signals by sector", () => {
    const filtered = filterSignalViews(all, { sector: "healthcare" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].signal.id).toBe("s1");
  });

  it("filters by verification status", () => {
    const filtered = filterSignalViews(all, { verificationStatus: "verified" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].signal.id).toBe("s1");
  });
});

describe("sortCompanyViews", () => {
  const zCompany = makeCompanyView({
    company: makeCompany({ id: "c1", slug: "z-demo", name: "Z Demo", primary_sector_slug: "education" }),
    sector: educationSector,
  });
  const aCompany = makeCompanyView({
    company: makeCompany({ id: "c2", slug: "a-demo", name: "A Demo", primary_sector_slug: "healthcare" }),
    sector: healthcareSector,
  });
  const all = [zCompany, aCompany];

  it("sorts alphabetically by name", () => {
    const sorted = sortCompanyViews(all, "name");
    expect(sorted.map((v) => v.company.name)).toEqual(["A Demo", "Z Demo"]);
  });

  it("sorts by sector display_order, then name within sector", () => {
    const sorted = sortCompanyViews(all, "sector");
    // healthcare (display_order 4) comes before education (display_order 5)
    expect(sorted.map((v) => v.sector?.slug)).toEqual(["healthcare", "education"]);
  });
});
