import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home (dashboard)", () => {
  it("renders the demo-data notice", () => {
    render(<Home />);
    expect(screen.getByText(/demo data:/i)).toBeInTheDocument();
    expect(screen.getByText(/fictional and for demonstration only/i)).toBeInTheDocument();
    expect(screen.getByText(/this dashboard is not live monitoring/i)).toBeInTheDocument();
  });

  it("renders the mission heading", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /emerging ai impact radar/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders all 4 KPI cards with their expected values", () => {
    render(<Home />);
    expect(screen.getByText("Company profiles")).toBeInTheDocument();
    expect(screen.getAllByText("Published signals").length).toBeGreaterThan(0);
    expect(screen.getByText("High-evidence signals")).toBeInTheDocument();
    expect(screen.getByText("Sectors covered")).toBeInTheDocument();
    expect(screen.getByText("21")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("renders all 7 sectors with equal representation", () => {
    render(<Home />);
    expect(screen.getByText("Politics & Civic Technology")).toBeInTheDocument();
    expect(screen.getByText("Climate & Energy")).toBeInTheDocument();
    expect(screen.getAllByText(/3 companies/).length).toBe(7);
  });

  it("renders the footer", () => {
    render(<Home />);
    expect(screen.getByText("signalcommons.org")).toBeInTheDocument();
  });

  it("never renders draft signal content publicly", () => {
    render(<Home />);
    // The one draft-only headline text used in the seed fixtures for
    // low-confidence/unverified signals must never reach the public page.
    expect(screen.queryByText(/demo partnership signal recorded/i)).not.toBeInTheDocument();
  });
});
