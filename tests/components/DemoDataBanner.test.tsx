import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DemoDataBanner } from "@/components/layout/DemoDataBanner";

describe("DemoDataBanner", () => {
  it("renders the user-facing demo-data disclosure", () => {
    render(<DemoDataBanner />);
    expect(screen.getByText(/demo data:/i)).toBeInTheDocument();
    expect(screen.getByText(/fictional and for demonstration only/i)).toBeInTheDocument();
    expect(screen.getByText(/this dashboard is not live monitoring/i)).toBeInTheDocument();
  });
});
