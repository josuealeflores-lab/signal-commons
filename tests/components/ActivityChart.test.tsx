import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityChart } from "@/components/dashboard/ActivityChart";
import { getActivitySeries } from "@/lib/data/dashboard";

describe("ActivityChart", () => {
  it("renders an accessible table with one row per month bucket", () => {
    render(<ActivityChart />);
    const table = screen.getByRole("table");
    const rows = table.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(getActivitySeries().length);
  });

  it("renders an SVG with an accessible name summarizing the data", () => {
    render(<ActivityChart />);
    expect(screen.getByRole("img")).toHaveAccessibleName(/published signal activity/i);
  });
});
