import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileNavToggle } from "@/components/layout/MobileNavToggle";

describe("MobileNavToggle", () => {
  it("toggles aria-expanded and reveals its content on click", () => {
    render(
      <MobileNavToggle>
        <p>Nav content</p>
      </MobileNavToggle>,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Nav content").closest("div")).toHaveAttribute("hidden");

    fireEvent.click(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("mobile-nav-panel")).not.toHaveAttribute("hidden");
  });

  it("closes and returns focus to the button on Escape", () => {
    render(
      <MobileNavToggle>
        <p>Nav content</p>
      </MobileNavToggle>,
    );

    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(button);
  });
});
