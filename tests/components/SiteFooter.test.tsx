import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SiteFooter } from "@/components/layout/SiteFooter";

describe("SiteFooter", () => {
  it("renders the platform tagline and domain text", () => {
    render(<SiteFooter />);
    expect(screen.getByText("signalcommons.org")).toBeInTheDocument();
    expect(screen.getByText(/public-interest intelligence platform/i)).toBeInTheDocument();
  });
});
