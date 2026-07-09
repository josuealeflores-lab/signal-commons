import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EvidenceStrengthBadge } from "@/components/evidence/EvidenceStrengthBadge";

describe("EvidenceStrengthBadge", () => {
  it.each([
    ["high", "High"],
    ["medium", "Medium"],
    ["low", "Low"],
  ] as const)("renders visible text for %s", (strength, expectedText) => {
    render(<EvidenceStrengthBadge strength={strength} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("never renders a 'Disputed' label — that is a verification-status value", () => {
    render(
      <>
        <EvidenceStrengthBadge strength="high" />
        <EvidenceStrengthBadge strength="medium" />
        <EvidenceStrengthBadge strength="low" />
      </>,
    );
    expect(screen.queryByText(/disputed/i)).not.toBeInTheDocument();
  });
});
