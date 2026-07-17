import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SectorDetailPage from "@/app/sectors/[slug]/page";
import { getSectorDetailView } from "@/lib/data/browse";
import type { SectorDetailView, CompanyView } from "@/lib/data/browse";
import type { Company, Sector } from "@/lib/data/schema";

/**
 * Regression coverage for docs/DECISIONS.md D-097's sector-count fix: the
 * sector detail page previously hardcoded "this sector has 3 companies in
 * total" regardless of the actual count. getSectorDetailView is mocked;
 * filterCompanyViews stays the REAL implementation (via importActual), so
 * the displayed count is proven derived from actual filtering, not a
 * literal. The fixture's real total (7) and filtered counts (2 and 3) are
 * both deliberately not 3, so a reintroduced hardcoded "3" could not
 * accidentally pass.
 */

vi.mock("@/lib/data/browse", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data/browse")>("@/lib/data/browse");
  return { ...actual, getSectorDetailView: vi.fn() };
});

const SECTOR: Sector = { slug: "agriculture", name: "Agriculture", icon_key: "sprout", display_order: 3 };

function makeCompany(id: string, companyType: Company["company_type"]): Company {
  return {
    id,
    slug: id,
    name: `Company ${id}`,
    summary: "Summary.",
    why_it_matters: "Why it matters.",
    company_type: companyType,
    stage: "discovery",
    primary_sector_slug: "agriculture",
    is_demo: true,
    publication_status: "published",
  };
}

function makeCompanyView(id: string, companyType: Company["company_type"]): CompanyView {
  return { company: makeCompany(id, companyType), sector: SECTOR, signals: [], primarySignal: undefined };
}

const VIEW: SectorDetailView = {
  sector: SECTOR,
  companies: [
    makeCompanyView("c1", "agent_native"),
    makeCompanyView("c2", "agent_native"),
    makeCompanyView("c3", "agent_product"),
    makeCompanyView("c4", "agent_product"),
    makeCompanyView("c5", "agent_product"),
    makeCompanyView("c6", "agent_enabled"),
    makeCompanyView("c7", "agent_enabled"),
  ],
};

describe("SectorDetailPage company count", () => {
  it("shows the real filtered and total counts, worded as 'Showing X of Y', when a filter is applied", async () => {
    vi.mocked(getSectorDetailView).mockResolvedValue(VIEW);

    const jsx = await SectorDetailPage({
      params: Promise.resolve({ slug: "agriculture" }),
      searchParams: Promise.resolve({ companyType: "agent_native" }),
    });
    render(jsx);

    expect(screen.getByText("Showing 2 of 7 companies in this sector.")).toBeInTheDocument();
  });

  it("derives the count from a different filter, proving the value is computed, not hardcoded", async () => {
    vi.mocked(getSectorDetailView).mockResolvedValue(VIEW);

    const jsx = await SectorDetailPage({
      params: Promise.resolve({ slug: "agriculture" }),
      searchParams: Promise.resolve({ companyType: "agent_product" }),
    });
    render(jsx);

    expect(screen.getByText(`Showing 3 of ${VIEW.companies.length} companies in this sector.`)).toBeInTheDocument();
  });

  it("does not render any company-count line when no filter is active", async () => {
    vi.mocked(getSectorDetailView).mockResolvedValue(VIEW);

    const jsx = await SectorDetailPage({
      params: Promise.resolve({ slug: "agriculture" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);

    expect(screen.queryByText(/companies in this sector/i)).not.toBeInTheDocument();
  });
});
