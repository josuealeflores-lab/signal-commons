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
});
