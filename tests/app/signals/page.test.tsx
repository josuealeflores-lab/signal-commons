import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SignalsIndexPage from "@/app/signals/page";

describe("SignalsIndexPage", () => {
  it("renders all 14 published signals with no filters applied", async () => {
    const jsx = await SignalsIndexPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.getByText(/14 of 14 published signals shown/i)).toBeInTheDocument();
  });

  it("filters to a single sector's 2 published signals via searchParams", async () => {
    const jsx = await SignalsIndexPage({ searchParams: Promise.resolve({ sector: "healthcare" }) });
    render(jsx);
    expect(screen.getByText(/2 of 14 published signals shown/i)).toBeInTheDocument();
  });

  it("never renders a draft signal", async () => {
    const jsx = await SignalsIndexPage({ searchParams: Promise.resolve({}) });
    render(jsx);
    expect(screen.queryByText(/demo partnership signal recorded/i)).not.toBeInTheDocument();
  });
});
