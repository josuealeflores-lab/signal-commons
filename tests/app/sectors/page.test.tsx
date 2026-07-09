import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SectorsIndexPage from "@/app/sectors/page";

describe("SectorsIndexPage", () => {
  it("renders all 7 sectors, each linking to its detail page", () => {
    render(<SectorsIndexPage />);
    expect(screen.getByRole("link", { name: /politics & civic technology/i })).toHaveAttribute(
      "href",
      "/sectors/politics-civic-technology",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(7);
  });
});
