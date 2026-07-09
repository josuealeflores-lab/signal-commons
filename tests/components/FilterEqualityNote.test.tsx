import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilterEqualityNote } from "@/components/ui/FilterEqualityNote";

describe("FilterEqualityNote", () => {
  it("explains that filtering may break equal sector representation", () => {
    render(<FilterEqualityNote />);
    expect(screen.getByText(/all seven sectors equally/i)).toBeInTheDocument();
  });
});
