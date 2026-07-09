import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SectorDetailPage from "@/app/sectors/[slug]/page";

describe("SectorDetailPage", () => {
  it("renders the sector name and its 3 companies for a valid slug", async () => {
    const jsx = await SectorDetailPage({
      params: Promise.resolve({ slug: "healthcare" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);
    expect(screen.getByRole("heading", { name: "Healthcare", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("filters companies by evidence strength via searchParams", async () => {
    const jsx = await SectorDetailPage({
      params: Promise.resolve({ slug: "healthcare" }),
      searchParams: Promise.resolve({ evidenceStrength: "high" }),
    });
    render(jsx);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("never renders the sector's draft signal content", async () => {
    const jsx = await SectorDetailPage({
      params: Promise.resolve({ slug: "politics-civic-technology" }),
      searchParams: Promise.resolve({}),
    });
    render(jsx);
    expect(screen.queryByText(/demo partnership signal recorded/i)).not.toBeInTheDocument();
  });
});
