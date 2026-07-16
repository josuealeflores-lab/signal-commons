import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CopilotCard } from "@/components/copilot/CopilotCard";
import type { CopilotAnalysisRecord } from "@/lib/copilot/context";

/**
 * CopilotCard is a pure, data-access-free component that accepts its
 * Server Action as a prop (rather than importing runCopilotAnalysis
 * directly), so this test stays hermetic and never imports a "use server"
 * module (docs/DECISIONS.md D-095).
 */

const ANALYSIS: CopilotAnalysisRecord = {
  id: "ca-1",
  research_item_id: "ri-1",
  model: "claude-opus-4-8",
  prompt_version: "m7-copilot-v1",
  summary: '<script>alert("xss")</script> **bold markdown** _italic_',
  risk_flags: ["<img src=x onerror=alert(1)>"],
  missing_evidence: ["# heading-like markdown question?"],
  suggested_next_step: "leans_approve",
  confidence: "medium",
  limitations: null,
  created_at: "2026-07-17T00:00:00Z",
};

const noopAction = async () => {};

describe("CopilotCard", () => {
  it("always renders the mandatory disclaimer", () => {
    render(<CopilotCard analyses={[]} action={noopAction} />);
    expect(
      screen.getByText("Advisory only. Verify sources independently. Not publication-ready. Does not replace reviewer judgment."),
    ).toBeInTheDocument();
  });

  it("renders an empty state when there are no past analyses", () => {
    render(<CopilotCard analyses={[]} action={noopAction} />);
    expect(screen.getByText(/no copilot analysis has been run/i)).toBeInTheDocument();
  });

  it("renders script-tag and markdown-like model output as inert plain text, never as real HTML elements", () => {
    render(<CopilotCard analyses={[ANALYSIS]} action={noopAction} />);
    expect(screen.getByText(/alert\("xss"\)/)).toBeInTheDocument();
    expect(document.querySelectorAll("script")).toHaveLength(0);
    expect(document.querySelectorAll("img")).toHaveLength(0);
    expect(screen.getByText(/\*\*bold markdown\*\* _italic_/)).toBeInTheDocument();
  });

  it("renders risk flags and missing-evidence questions", () => {
    render(<CopilotCard analyses={[ANALYSIS]} action={noopAction} />);
    expect(screen.getByText(/onerror=alert\(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/heading-like markdown question\?/)).toBeInTheDocument();
  });

  it("does not render suggestedNextStep as a button -- the only button is the trigger", () => {
    render(<CopilotCard analyses={[ANALYSIS]} action={noopAction} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent(/run copilot analysis/i);
  });

  it("renders the suggested-next-step lean as plain advisory text", () => {
    render(<CopilotCard analyses={[ANALYSIS]} action={noopAction} />);
    expect(screen.getByText(/leans toward approval/i)).toBeInTheDocument();
    expect(screen.getByText(/advisory only, not a decision/i)).toBeInTheDocument();
  });

  it("renders the manual trigger button", () => {
    render(<CopilotCard analyses={[]} action={noopAction} />);
    expect(screen.getByRole("button", { name: /run copilot analysis/i })).toBeInTheDocument();
  });
});
