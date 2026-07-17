import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CORRECTIONS_EMAIL } from "@/lib/content/site";

describe("SiteFooter", () => {
  it("renders the platform tagline and confirmed domain text", () => {
    render(<SiteFooter />);
    // Corrected to the confirmed custom domain (docs/DECISIONS.md D-099) --
    // the footer previously showed "signalcommons.org" (no hyphen), which
    // was never a real, owned domain.
    expect(screen.getByText("signal-commons.org")).toBeInTheDocument();
    expect(screen.getByText(/public-interest intelligence platform/i)).toBeInTheDocument();
  });

  it("links to About and to the confirmed corrections mailbox", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    const correctionsLink = screen.getByRole("link", { name: /report an issue/i });
    expect(correctionsLink).toHaveAttribute("href", `mailto:${CORRECTIONS_EMAIL}`);
  });
});
