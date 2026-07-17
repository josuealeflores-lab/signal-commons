import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VerificationStatusBadge } from "@/components/evidence/VerificationStatusBadge";

describe("VerificationStatusBadge", () => {
  it.each([
    ["verified", "Verified"],
    ["partially_verified", "Partially verified"],
    ["unverified", "Unverified"],
    ["disputed", "Disputed"],
    ["rejected", "Rejected"],
  ] as const)("renders visible text for %s", (status, expectedText) => {
    render(<VerificationStatusBadge status={status} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it("renders as a plain, unlinked badge by default", () => {
    render(<VerificationStatusBadge status="verified" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links to its methodology definition when linked (docs/DECISIONS.md D-099)", () => {
    render(<VerificationStatusBadge status="verified" linked />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/methodology#verification-status-heading");
  });
});
