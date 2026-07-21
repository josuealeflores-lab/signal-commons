import { describe, expect, it } from "vitest";
import { errorMessageFor } from "@/lib/copilot/error-messages";
import {
  ModelNotConfiguredError,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
  UnsupportedResearchItemError,
} from "@/lib/copilot/run-analysis";

/**
 * Hermetic -- pure error-to-message mapping, no DB, no live call
 * (docs/DECISIONS.md D-097).
 */

describe("copilot errorMessageFor", () => {
  it("maps ModelNotConfiguredError to a fixed, honest not-configured message", () => {
    expect(errorMessageFor(new ModelNotConfiguredError())).toBe("AI features are not configured in this environment.");
  });

  it("the not-configured message never includes the literal ANTHROPIC_API_KEY name", () => {
    expect(errorMessageFor(new ModelNotConfiguredError())).not.toContain("ANTHROPIC_API_KEY");
  });

  it("the not-configured message never includes the underlying error's raw internal text", () => {
    const err = new ModelNotConfiguredError();
    expect(errorMessageFor(err)).not.toContain(err.message);
  });

  it("maps a genuine provider/network error to the existing retryable provider-error message, not the not-configured message", () => {
    const message = errorMessageFor(new ModelProviderError("Copilot model request failed with HTTP 500", 500));
    expect(message).toBe("Copilot analysis failed (provider error). Try again.");
    expect(message).not.toBe("AI features are not configured in this environment.");
  });

  it("maps ModelTimeoutError, ModelResponseParseError, UnsupportedResearchItemError, and an unknown error to their existing messages", () => {
    expect(errorMessageFor(new ModelTimeoutError())).toBe("Copilot analysis timed out. Try again.");
    expect(errorMessageFor(new ModelResponseParseError("bad shape"))).toBe(
      "Copilot analysis returned an unexpected response. Try again.",
    );
    expect(errorMessageFor(new UnsupportedResearchItemError("ri-1"))).toBe("Copilot analysis is not available for this item.");
    expect(errorMessageFor(new Error("boom"))).toBe("Copilot analysis failed. Try again.");
  });

  it("maps the five M11 Phase B idempotency/rate-limit SC00x codes to friendly, distinct messages (docs/DECISIONS.md D-100)", () => {
    expect(errorMessageFor({ code: "SC001", message: "idempotency key already used for a different request" })).toBe(
      "This action may have already been submitted. Please refresh the page and try again.",
    );
    expect(errorMessageFor({ code: "SC002", message: "idempotency key was already used for a different endpoint" })).toBe(
      "This action could not be completed. Please refresh the page and try again.",
    );
    expect(errorMessageFor({ code: "SC003", message: "idempotency key belongs to a different reviewer" })).toBe(
      "This action could not be completed. Please refresh the page and try again.",
    );
    expect(errorMessageFor({ code: "SC004", message: "rate limit exceeded: no more than 10 actions per minute" })).toBe(
      "You're submitting too quickly. Please wait a moment and try again.",
    );
    expect(errorMessageFor({ code: "SC005", message: "request with this idempotency key is still being processed" })).toBe(
      "This action is still being processed. Please wait a moment and try again.",
    );
  });

  it("never leaks the raw SQLSTATE code or raw DB message for an SC00x error", () => {
    const message = errorMessageFor({ code: "SC004", message: "rate limit exceeded: no more than 10 actions per minute" });
    expect(message).not.toContain("SC004");
    expect(message).not.toContain("rate limit exceeded: no more than 10 actions per minute");
  });

  it("does not confuse a P0001-class code (or any other unmapped code) with an SC00x code", () => {
    expect(errorMessageFor({ code: "P0001", message: "not an active reviewer" })).toBe("Copilot analysis failed. Try again.");
  });
});
