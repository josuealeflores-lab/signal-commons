import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import MethodologyPage from "@/app/methodology/page";
import { CORRECTIONS_EMAIL } from "@/lib/content/site";

describe("MethodologyPage", () => {
  it("renders the demo-data, source-tier, evidence-strength, and verification-status sections", () => {
    render(<MethodologyPage />);
    expect(screen.getByRole("heading", { name: /this dashboard uses demo data/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /source tiers/i })).toBeInTheDocument();
    expect(screen.getByText(/tier 1 — primary or authoritative/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^evidence strength$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /verification status/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /human review/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^limitations$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^corrections$/i })).toBeInTheDocument();
  });

  it("states the no-rankings / funding-does-not-equal-success / attention-does-not-equal-adoption limitations", () => {
    render(<MethodologyPage />);
    expect(screen.getByText(/does not rank companies/i)).toBeInTheDocument();
    expect(screen.getByText(/not treated as proof of impact/i)).toBeInTheDocument();
    expect(screen.getByText(/not treated as evidence of real-world adoption/i)).toBeInTheDocument();
  });

  it("renders the AI-assisted review section (docs/DECISIONS.md D-097)", () => {
    render(<MethodologyPage />);
    expect(screen.getByRole("heading", { name: /ai-assisted review/i })).toBeInTheDocument();
  });

  it("frames the Copilot/queue-digest features as advisory and human-in-the-loop, never deciding on their own", () => {
    render(<MethodologyPage />);
    expect(screen.getByText(/advisory only/i)).toBeInTheDocument();
    expect(
      screen.getByText(/never decide, approve, reject, publish, or verify any public content on their own/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/require an authenticated,\s*active reviewer account/i)).toBeInTheDocument();
    expect(screen.getByText(/neither is a public chatbot/i)).toBeInTheDocument();
  });

  it("prominently discloses that live AI is not enabled in the deployed production environment", () => {
    render(<MethodologyPage />);
    expect(screen.getByText(/live ai is not enabled in this deployed environment/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no published or draft content on this site was ever ai-decided, ai-approved, ai-verified/i),
    ).toBeInTheDocument();
  });

  it("makes the Corrections section actionable with the confirmed, monitored, non-personal mailto address (docs/DECISIONS.md D-099)", () => {
    render(<MethodologyPage />);
    const link = screen.getByRole("link", { name: CORRECTIONS_EMAIL });
    expect(link).toHaveAttribute("href", `mailto:${CORRECTIONS_EMAIL}`);
    expect(CORRECTIONS_EMAIL).toBe("corrections@signal-commons.org");
    expect(screen.queryByText(/gmail/i)).not.toBeInTheDocument();
    expect(screen.getByText(/corrections are reviewed manually/i)).toBeInTheDocument();
  });
});
