import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavLink } from "@/components/layout/NavLink";

const mockUsePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("NavLink", () => {
  it("marks itself active with aria-current when the pathname matches", () => {
    mockUsePathname.mockReturnValue("/companies");
    render(<NavLink href="/companies">Companies</NavLink>);
    expect(screen.getByRole("link", { name: "Companies" })).toHaveAttribute("aria-current", "page");
  });

  it("marks itself active for a nested route under its href", () => {
    mockUsePathname.mockReturnValue("/companies/civiclens-demo");
    render(<NavLink href="/companies">Companies</NavLink>);
    expect(screen.getByRole("link", { name: "Companies" })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark itself active for an unrelated route", () => {
    mockUsePathname.mockReturnValue("/signals");
    render(<NavLink href="/companies">Companies</NavLink>);
    expect(screen.getByRole("link", { name: "Companies" })).not.toHaveAttribute("aria-current");
  });

  it("the root '/' link only matches the exact dashboard route, not every route", () => {
    mockUsePathname.mockReturnValue("/companies");
    render(<NavLink href="/">Dashboard</NavLink>);
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });
});
