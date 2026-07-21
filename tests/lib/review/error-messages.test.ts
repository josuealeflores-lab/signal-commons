import { describe, expect, it } from "vitest";
import { errorMessageFor } from "@/lib/review/error-messages";

/**
 * Hermetic -- pure error-to-message mapping, no DB, no live call
 * (docs/DECISIONS.md D-100, M11 Phase B).
 */

describe("review errorMessageFor", () => {
  it("maps the five M11 Phase B idempotency/rate-limit SC00x codes to friendly, distinct messages", () => {
    expect(errorMessageFor({ code: "SC001", message: "idempotency key already used for a different request" })).toBe(
      "This action may have already been submitted. Please refresh the page and try again.",
    );
    expect(errorMessageFor({ code: "SC002", message: "idempotency key was already used for a different endpoint" })).toBe(
      "This action could not be completed. Please refresh the page and try again.",
    );
    expect(errorMessageFor({ code: "SC003", message: "idempotency key belongs to a different reviewer" })).toBe(
      "This action could not be completed. Please refresh the page and try again.",
    );
    expect(errorMessageFor({ code: "SC004", message: "rate limit exceeded: no more than 20 actions per minute" })).toBe(
      "You're submitting too quickly. Please wait a moment and try again.",
    );
    expect(errorMessageFor({ code: "SC005", message: "request with this idempotency key is still being processed" })).toBe(
      "This action is still being processed. Please wait a moment and try again.",
    );
  });

  it("never leaks the raw SQLSTATE code or raw DB message for an SC00x error", () => {
    const message = errorMessageFor({ code: "SC004", message: "rate limit exceeded: no more than 20 actions per minute" });
    expect(message).not.toContain("SC004");
    expect(message).not.toContain("rate limit exceeded: no more than 20 actions per minute");
  });

  it("passes every other existing submit_review_action error message through unchanged (established, intentional behavior, not altered by M11)", () => {
    expect(errorMessageFor({ message: "not an active reviewer" })).toBe("not an active reviewer");
    expect(errorMessageFor({ message: "cannot approve a signal with no linked evidence" })).toBe(
      "cannot approve a signal with no linked evidence",
    );
    expect(errorMessageFor({ code: "P0001", message: "some unrelated PL/pgSQL condition" })).toBe(
      "some unrelated PL/pgSQL condition",
    );
  });
});
