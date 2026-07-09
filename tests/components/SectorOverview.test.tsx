import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectorOverview } from "@/components/dashboard/SectorOverview";

describe("SectorOverview", () => {
  it("renders exactly 7 sector cards, each showing 3 companies", () => {
    render(<SectorOverview />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(7);

    for (const item of items) {
      expect(item.textContent).toMatch(/3 companies/);
    }
  });

  it("gives every sector name equal heading-level treatment (no featured sector)", () => {
    render(<SectorOverview />);
    const sectorNames = [
      "Politics & Civic Technology",
      "Government Operations",
      "Agriculture",
      "Healthcare",
      "Education",
      "Nonprofits",
      "Climate & Energy",
    ];
    for (const name of sectorNames) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });
});
