import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders the provided message as real text content", () => {
    render(<EmptyState message="No published signal is available for this demo company yet." />);
    expect(
      screen.getByText("No published signal is available for this demo company yet."),
    ).toBeInTheDocument();
  });
});
