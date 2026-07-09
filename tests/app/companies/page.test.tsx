import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CompaniesIndexPage from "@/app/companies/page";

describe("CompaniesIndexPage", () => {
  it("renders the full 21-company roster with no filters applied", async () => {
    const jsx = await CompaniesIndexPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText(/21 of 21 companies shown/i)).toBeInTheDocument();
  });

  it("renders a draft-only company in the index (company profiles are public-safe regardless of signal status)", async () => {
    const jsx = await CompaniesIndexPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText("PublicSignal Demo")).toBeInTheDocument();
    // 7 companies (one per sector) have no published signal yet.
    expect(screen.getAllByText(/no published signal yet/i)).toHaveLength(7);
  });

  it("filters by search query via searchParams", async () => {
    const jsx = await CompaniesIndexPage({ searchParams: Promise.resolve({ q: "civiclens" }) });
    render(jsx);
    expect(screen.getByText(/1 of 21 companies shown/i)).toBeInTheDocument();
    expect(screen.getByText("CivicLens Demo")).toBeInTheDocument();
  });

  it("never renders draft signal content", async () => {
    const jsx = await CompaniesIndexPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.queryByText(/demo partnership signal recorded/i)).not.toBeInTheDocument();
  });
});
