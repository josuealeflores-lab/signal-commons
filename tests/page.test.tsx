import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Home from "@/app/page";

describe("Home", () => {
  it("renders the Signal Commons placeholder", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { name: /signal commons/i }),
    ).toBeInTheDocument();
  });
});
