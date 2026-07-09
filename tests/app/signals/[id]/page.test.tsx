import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SignalDetailPage from "@/app/signals/[id]/page";

describe("SignalDetailPage", () => {
  it("renders a published signal's headline, badges, and sources", async () => {
    const jsx = await SignalDetailPage({ params: Promise.resolve({ id: "demo-signal-1-1" }) });
    render(jsx);
    expect(
      screen.getByRole("heading", { name: "Demo product workflow announced", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("links back to the signal's company", async () => {
    const jsx = await SignalDetailPage({ params: Promise.resolve({ id: "demo-signal-1-1" }) });
    render(jsx);
    expect(screen.getByRole("link", { name: "CivicLens Demo" })).toHaveAttribute(
      "href",
      "/companies/civiclens-demo",
    );
  });
});
