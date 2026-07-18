import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/**
 * Regression coverage for the (reviewer) layout's auth-gate behavior after
 * extracting the decision into src/lib/review/access.ts
 * (docs/DECISIONS.md D-100 Phase A). Hermetic -- next/navigation's
 * `redirect` and the session client are both mocked; no live Supabase
 * project is used. `redirect()` is mocked to throw, mirroring Next's real
 * runtime behavior of interrupting rendering via a thrown redirect signal.
 */

const redirectMock = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));

vi.mock("@/lib/supabase/session-client", () => ({
  getSessionSupabaseClient: vi.fn(),
}));

import ReviewerLayout from "@/app/(reviewer)/layout";
import { getSessionSupabaseClient } from "@/lib/supabase/session-client";

function fakeClient(user: { id: string } | null, profile: { is_active: boolean } | null) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile }),
        }),
      }),
    }),
  };
}

describe("ReviewerLayout auth gate", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects to /auth/login with no error message when there is no session (unchanged behavior)", async () => {
    vi.mocked(getSessionSupabaseClient).mockResolvedValue(fakeClient(null, null) as never);

    await expect(ReviewerLayout({ children: null })).rejects.toThrow("NEXT_REDIRECT:/auth/login");
    expect(redirectMock).toHaveBeenCalledWith("/auth/login");
  });

  it("redirects with the honest, specific 'not active' message for an inactive reviewer (unchanged regression)", async () => {
    vi.mocked(getSessionSupabaseClient).mockResolvedValue(
      fakeClient({ id: "u1" }, { is_active: false }) as never,
    );

    await expect(ReviewerLayout({ children: null })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith(
      `/auth/login?error=${encodeURIComponent("Your reviewer access is not active.")}`,
    );
  });

  it("redirects with the same message for a non-reviewer (authenticated, no reviewer_profiles row)", async () => {
    vi.mocked(getSessionSupabaseClient).mockResolvedValue(fakeClient({ id: "u2" }, null) as never);

    await expect(ReviewerLayout({ children: null })).rejects.toThrow(/NEXT_REDIRECT/);
    expect(redirectMock).toHaveBeenCalledWith(
      `/auth/login?error=${encodeURIComponent("Your reviewer access is not active.")}`,
    );
  });

  it("renders children and the reviewer nav for an active reviewer, without redirecting", async () => {
    vi.mocked(getSessionSupabaseClient).mockResolvedValue(
      fakeClient({ id: "u3" }, { is_active: true }) as never,
    );

    const jsx = await ReviewerLayout({ children: <p>CHILD_MARKER</p> });
    render(jsx);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByText("CHILD_MARKER")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Research queue" })).toHaveAttribute("href", "/research-queue");
    expect(screen.getByRole("link", { name: "Reviewer dashboard" })).toHaveAttribute("href", "/reviewer");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });
});
