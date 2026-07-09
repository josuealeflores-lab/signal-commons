import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteHeader } from "@/components/layout/SiteHeader";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("SiteHeader", () => {
  it("renders Sectors, Companies, Signals, and Methodology as real links (Milestone 2)", () => {
    render(<SiteHeader />);
    for (const [name, href] of [
      ["Sectors", "/sectors"],
      ["Companies", "/companies"],
      ["Signals", "/signals"],
      ["Methodology", "/methodology"],
    ]) {
      const links = screen.getAllByRole("link", { name });
      expect(links[0]).toHaveAttribute("href", href);
    }
  });

  it("does not render a Research Queue or Reports nav item", () => {
    render(<SiteHeader />);
    expect(screen.queryByText(/research queue/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reports/i)).not.toBeInTheDocument();
  });

  it("does not render a search input", () => {
    render(<SiteHeader />);
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
