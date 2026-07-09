import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MethodologyPage from "@/app/methodology/page";

describe("MethodologyPage", () => {
  it("renders the demo-data, source-tier, evidence-strength, and verification-status sections", () => {
    render(<MethodologyPage />);
    expect(screen.getByRole("heading", { name: /this dashboard uses demo data/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /source tiers/i })).toBeInTheDocument();
    expect(screen.getByText(/tier 1 — primary or authoritative/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^evidence strength$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /verification status/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /human review/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^limitations$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^corrections$/i })).toBeInTheDocument();
  });

  it("states the no-rankings / funding-does-not-equal-success / attention-does-not-equal-adoption limitations", () => {
    render(<MethodologyPage />);
    expect(screen.getByText(/does not rank companies/i)).toBeInTheDocument();
    expect(screen.getByText(/not treated as proof of impact/i)).toBeInTheDocument();
    expect(screen.getByText(/not treated as evidence of real-world adoption/i)).toBeInTheDocument();
  });
});
