import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AboutPage from "@/app/about/page";
import { CORRECTIONS_EMAIL } from "@/lib/content/site";

describe("AboutPage", () => {
  it("renders all required FAQ/About sections", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { name: /what is signal commons\?/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what is a signal\?/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what does evidence strength mean\?/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what does verification status mean\?/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /why demo data\?/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /what is ai-assisted review\?/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /how can someone report an issue\?/i })).toBeInTheDocument();
  });

  it("discloses that current public content is fictional demo data and this is not live monitoring", () => {
    render(<AboutPage />);
    expect(screen.getByText(/fictional demo data/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not live monitoring/i).length).toBeGreaterThan(0);
  });

  it("states AI never decides, approves, rejects, publishes, or verifies public content on its own, and human review remains the decision point", () => {
    render(<AboutPage />);
    expect(
      screen.getByText(/ai never decides, approves, rejects, publishes, or verifies any public content on its own/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/human review remains the decision point/i)).toBeInTheDocument();
    expect(screen.getByText(/live ai is not enabled in this deployed environment/i)).toBeInTheDocument();
  });

  it("uses the confirmed corrections mailto address, with no placeholder or personal address", () => {
    render(<AboutPage />);
    const link = screen.getByRole("link", { name: CORRECTIONS_EMAIL });
    expect(link).toHaveAttribute("href", `mailto:${CORRECTIONS_EMAIL}`);
    expect(CORRECTIONS_EMAIL).toBe("corrections@signal-commons.org");
    expect(screen.queryByText(/gmail/i)).not.toBeInTheDocument();
  });

  it("links to the methodology page's evidence-strength, verification-status, and AI-assisted-review anchors", () => {
    render(<AboutPage />);
    expect(screen.getByRole("link", { name: /full evidence-strength definitions/i })).toHaveAttribute(
      "href",
      "/methodology#evidence-strength-heading",
    );
    expect(screen.getByRole("link", { name: /full verification-status definitions/i })).toHaveAttribute(
      "href",
      "/methodology#verification-status-heading",
    );
    expect(screen.getByRole("link", { name: /full ai-assisted review disclosure/i })).toHaveAttribute(
      "href",
      "/methodology#ai-assisted-review-heading",
    );
  });
});
