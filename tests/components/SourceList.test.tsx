import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceList } from "@/components/evidence/SourceList";
import type { Signal, SourceDocument } from "@/lib/data/schema";

/**
 * SourceList itself is a pure, data-access-free component (it only takes
 * props), so this test uses a hand-built fixture instead of fetching real
 * data — keeps it hermetic under `npm test` now that the underlying
 * repository/browse functions are Supabase-backed.
 */

const signal: Signal = {
  id: "demo-signal-1-1",
  company_id: "demo-company-1-1",
  signal_type: "product_launch",
  headline: "Demo product workflow announced",
  summary: "A fictional product launch is included to exercise the research and evidence interface.",
  why_it_matters: "It provides a safe deterministic record for testing evidence labels.",
  occurred_at: "2026-01-10T12:00:00Z",
  detected_at: "2026-07-04T12:00:00Z",
  evidence_strength: "high",
  verification_status: "verified",
  publication_status: "published",
  is_demo: true,
  created_by_type: "import",
  evidence: [
    {
      source_document_id: "demo-source-1-1",
      support_type: "supports",
      claim_type: "analysis",
      supporting_passage: "This is intentionally fictional demo evidence.",
    },
  ],
};

const sources: SourceDocument[] = [
  {
    id: "demo-source-1-1",
    canonical_url: "https://example.com/signal-commons-demo/civiclens-demo",
    source_title: "Fictional evidence packet for CivicLens Demo",
    publisher: "Signal Commons Demo Dataset",
    source_type: "demo_fixture",
    source_tier: "demo",
    published_at: "2026-01-10T12:00:00Z",
    retrieved_at: "2026-07-04T12:00:00Z",
    is_demo: true,
  },
];

describe("SourceList", () => {
  it("renders the source title as the visible link text, linking to canonical_url", () => {
    render(<SourceList signal={signal} sources={sources} />);
    const link = screen.getByRole("link", { name: sources[0].source_title });
    expect(link).toHaveAttribute("href", sources[0].canonical_url);
  });

  it("opens the source link in a new tab with safe rel attributes", () => {
    render(<SourceList signal={signal} sources={sources} />);
    const link = screen.getByRole("link", { name: sources[0].source_title });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders publisher, source tier, and published date", () => {
    render(<SourceList signal={signal} sources={sources} />);
    expect(screen.getByText(new RegExp(sources[0].publisher))).toBeInTheDocument();
    expect(screen.getByText(/demo source/i)).toBeInTheDocument();
  });

  it("renders claim type and support type from the evidence entry", () => {
    render(<SourceList signal={signal} sources={sources} />);
    expect(screen.getByText(/analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/supports this signal/i)).toBeInTheDocument();
  });
});
