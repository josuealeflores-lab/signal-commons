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
});
