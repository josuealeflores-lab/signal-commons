import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CompanyDetailPage from "@/app/companies/[slug]/page";

describe("CompanyDetailPage", () => {
  it("renders profile fields and the published signal for a company that has one", async () => {
    const jsx = await CompanyDetailPage({ params: Promise.resolve({ slug: "civiclens-demo" }) });
    render(jsx);
    expect(screen.getByRole("heading", { name: "CivicLens Demo", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Demo product workflow announced")).toBeInTheDocument();
  });

  it("renders public-safe profile fields but an honest empty state for a draft-only company", async () => {
    const jsx = await CompanyDetailPage({ params: Promise.resolve({ slug: "publicsignal-demo" }) });
    render(jsx);
    // Company-level fields are public-safe regardless of signal status.
    expect(screen.getByRole("heading", { name: "PublicSignal Demo", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText("No published signal is available for this demo company yet."),
    ).toBeInTheDocument();
    // The draft signal's actual content must never render.
    expect(screen.queryByText(/demo partnership signal recorded/i)).not.toBeInTheDocument();
  });

  it("renders an honest empty state for 'what to watch next' (no company_watch_items data exists)", async () => {
    const jsx = await CompanyDetailPage({ params: Promise.resolve({ slug: "civiclens-demo" }) });
    render(jsx);
    expect(
      screen.getByText("No watch items are recorded for this demo company yet."),
    ).toBeInTheDocument();
  });
});
