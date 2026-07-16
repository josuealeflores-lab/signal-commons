import { describe, expect, it } from "vitest";
import { buildActionNotice, type SubmitReviewActionResult } from "@/lib/review/action-messages";

/**
 * Hermetic (no live DB, no RPC call) — buildActionNotice is a pure function
 * over submit_review_action's jsonb return value (docs/DECISIONS.md D-094).
 * These tests pin the exact messaging contract: an approve/edit_approve
 * result must never imply publication happened when it didn't, and a
 * mark_disputed result must never imply a never-public record was "pulled
 * back" from public view.
 */

function buildResult(overrides: Partial<SubmitReviewActionResult>): SubmitReviewActionResult {
  return {
    action: "approve",
    research_item_id: "ri-1",
    research_item_status: "approved",
    signal_id: "sig-1",
    signal_publication_status: "draft",
    signal_verification_status: "verified",
    company_id: "co-1",
    company_publication_status: "draft",
    published: false,
    private_approval: true,
    ...overrides,
  };
}

describe("buildActionNotice", () => {
  it("returns null when result is null (older callers ignoring data)", () => {
    expect(buildActionNotice("approve", null)).toBeNull();
  });

  it("returns null when result is undefined", () => {
    expect(buildActionNotice("approve", undefined)).toBeNull();
  });

  it("approve with published=true reports a plain publish message", () => {
    const notice = buildActionNotice("approve", buildResult({ action: "approve", published: true }));
    expect(notice).toBe("Approved and published.");
  });

  it("approve with published=false reports private-approval messaging, never implying publication", () => {
    const notice = buildActionNotice("approve", buildResult({ action: "approve", published: false }));
    expect(notice).toContain("private");
    expect(notice).not.toMatch(/published\.$/);
  });

  it("edit_approve follows the same published-vs-private contract as approve", () => {
    const publishedNotice = buildActionNotice(
      "edit_approve",
      buildResult({ action: "edit_approve", published: true }),
    );
    const privateNotice = buildActionNotice(
      "edit_approve",
      buildResult({ action: "edit_approve", published: false }),
    );
    expect(publishedNotice).toBe("Approved and published.");
    expect(privateNotice).toContain("private");
  });

  it("mark_disputed on a never-published (draft) signal never implies it was pulled back from public view", () => {
    const notice = buildActionNotice(
      "mark_disputed",
      buildResult({ action: "mark_disputed", signal_publication_status: "draft" }),
    );
    expect(notice).toContain("never public");
    expect(notice).not.toMatch(/removed from public view/i);
  });

  it("mark_disputed on a previously-published signal (now in_review) reports it was pulled back", () => {
    const notice = buildActionNotice(
      "mark_disputed",
      buildResult({ action: "mark_disputed", signal_publication_status: "in_review" }),
    );
    expect(notice).toMatch(/removed from public view/i);
  });

  it("returns null for reject/request_evidence/reopen (no special messaging needed)", () => {
    expect(buildActionNotice("reject", buildResult({ action: "reject" }))).toBeNull();
    expect(buildActionNotice("request_evidence", buildResult({ action: "request_evidence" }))).toBeNull();
    expect(buildActionNotice("reopen", buildResult({ action: "reopen" }))).toBeNull();
  });
});
