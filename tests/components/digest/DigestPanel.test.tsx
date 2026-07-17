import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DigestPanel } from "@/components/digest/DigestPanel";
import type { DigestActionState } from "@/lib/digest/actions";

/**
 * DigestPanel accepts its Server Action as a prop (rather than importing
 * generateQueueDigest directly), so this test stays hermetic and never
 * imports a "use server" module (docs/DECISIONS.md D-096). Only the
 * `DigestActionState` *type* is imported, which is erased at compile time.
 */

const INITIAL_STATE: DigestActionState = { digest: null, error: null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("DigestPanel", () => {
  it("always renders the mandatory advisory disclaimer", () => {
    render(<DigestPanel action={async () => INITIAL_STATE} initialState={INITIAL_STATE} />);
    expect(
      screen.getByText("Advisory only. This digest does not approve, reject, publish, or replace reviewer judgment."),
    ).toBeInTheDocument();
  });

  it("renders the manual trigger button and no digest content before it is clicked", () => {
    render(<DigestPanel action={async () => INITIAL_STATE} initialState={INITIAL_STATE} />);
    expect(screen.getByRole("button", { name: /generate queue digest/i })).toBeInTheDocument();
    expect(screen.queryByText(/priority focus items/i)).not.toBeInTheDocument();
  });

  it("shows a disabled, pending-labeled button while the action is in flight, then renders the returned digest", async () => {
    const { promise, resolve } = deferred<DigestActionState>();
    const action = vi.fn(() => promise);

    render(<DigestPanel action={action} initialState={INITIAL_STATE} />);

    fireEvent.click(screen.getByRole("button", { name: /generate queue digest/i }));

    const pendingButton = await screen.findByRole("button", { name: /generating/i });
    expect(pendingButton).toBeDisabled();

    resolve({
      digest: {
        queueSummary: "5 items pending",
        priorityFocusItems: [{ researchItemId: "ri-1", reason: "High priority and low confidence" }],
        missingEvidenceThemes: ["Missing a primary source"],
        riskPatterns: ['<script>alert("xss")</script>'],
        suggestedReviewerFocus: "Start with ri-1",
        limitations: "Point-in-time snapshot only",
      },
      error: null,
    });

    expect(await screen.findByText("5 items pending")).toBeInTheDocument();
    expect(screen.getByText(/high priority and low confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/missing a primary source/i)).toBeInTheDocument();

    // Inert rendering: script content renders as plain text, never a real <script> element.
    expect(screen.getByText(/alert\("xss"\)/)).toBeInTheDocument();
    expect(document.querySelectorAll("script")).toHaveLength(0);

    expect(screen.getByRole("button", { name: /generate queue digest/i })).not.toBeDisabled();
  });

  it("renders an error message when the action returns one, and no digest content", async () => {
    const action = vi.fn(async () => ({ digest: null, error: "Queue digest timed out. Try again." }) as DigestActionState);

    render(<DigestPanel action={action} initialState={INITIAL_STATE} />);
    fireEvent.click(screen.getByRole("button", { name: /generate queue digest/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/timed out/i);
    expect(screen.queryByText(/priority focus items/i)).not.toBeInTheDocument();
  });
});
