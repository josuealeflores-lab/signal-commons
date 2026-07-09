import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceList } from "@/components/evidence/SourceList";
import { getSignalView } from "@/lib/data/browse";

describe("SourceList", () => {
  const view = getSignalView("demo-signal-1-1")!;

  it("renders the source title as the visible link text, linking to canonical_url", () => {
    render(<SourceList signal={view.signal} sources={view.sources} />);
    const link = screen.getByRole("link", { name: view.sources[0].source_title });
    expect(link).toHaveAttribute("href", view.sources[0].canonical_url);
  });

  it("opens the source link in a new tab with safe rel attributes", () => {
    render(<SourceList signal={view.signal} sources={view.sources} />);
    const link = screen.getByRole("link", { name: view.sources[0].source_title });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders publisher, source tier, and published date", () => {
    render(<SourceList signal={view.signal} sources={view.sources} />);
    expect(screen.getByText(new RegExp(view.sources[0].publisher))).toBeInTheDocument();
    expect(screen.getByText(/demo source/i)).toBeInTheDocument();
  });

  it("renders claim type and support type from the evidence entry", () => {
    render(<SourceList signal={view.signal} sources={view.sources} />);
    expect(screen.getByText(/analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/supports this signal/i)).toBeInTheDocument();
  });
});
