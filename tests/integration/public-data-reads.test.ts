import { describe, expect, it } from "vitest";
import { getCompanies, getPublishedSignalById, getSectors } from "@/lib/data/repository";
import { getKpiSummary } from "@/lib/data/dashboard";
import { getCompanyViews, getSignalView } from "@/lib/data/browse";

/**
 * Exercises the real public data-access layer (repository.ts/dashboard.ts/
 * browse.ts) against the live seeded Supabase project, through the same
 * anon/publishable client every public page uses — not raw table queries.
 * Complements rls.test.ts, which asserts the underlying RLS behavior
 * directly against the tables/RPC.
 */

describe("public data-layer reads against the seeded Supabase DB", () => {
  it("getSectors returns all 7 sectors", async () => {
    const sectors = await getSectors();
    expect(sectors).toHaveLength(7);
  });

  it("getCompanies returns published companies only, each with a resolved primary sector", async () => {
    const companies = await getCompanies();
    expect(companies.length).toBeGreaterThan(0);
    for (const company of companies) {
      expect(company.publication_status).toBe("published");
      expect(company.primary_sector_slug).not.toBe("");
    }
  });

  it("getPublishedSignalById resolves a known published signal", async () => {
    const signal = await getPublishedSignalById("demo-signal-1-1");
    expect(signal).toBeDefined();
    expect(signal?.publication_status).toBe("published");
  });

  it("getPublishedSignalById returns undefined for a known draft signal id", async () => {
    const signal = await getPublishedSignalById("demo-signal-1-3");
    expect(signal).toBeUndefined();
  });

  it("getSignalView treats a draft signal id identically to an unknown id", async () => {
    const draftView = await getSignalView("demo-signal-1-3");
    const unknownView = await getSignalView("demo-signal-does-not-exist");
    expect(draftView).toBeUndefined();
    expect(unknownView).toBeUndefined();
  });

  it("getKpiSummary reflects published-signal-gated counts", async () => {
    const kpis = await getKpiSummary();
    expect(kpis.companyProfiles).toBe(21);
    expect(kpis.publishedSignals).toBe(14);
    expect(kpis.sectorsCovered).toBe(7);
  });

  it("getCompanyViews resolves every published company to a sector", async () => {
    const views = await getCompanyViews();
    expect(views).toHaveLength(21);
    for (const view of views) {
      expect(view.sector).toBeDefined();
    }
  });
});
