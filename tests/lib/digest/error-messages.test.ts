import { describe, expect, it } from "vitest";
import { errorMessageFor } from "@/lib/digest/error-messages";
import {
  DigestLoopBoundsExceededError,
  ModelNotConfiguredError,
  ModelProviderError,
  ModelResponseParseError,
  ModelTimeoutError,
} from "@/lib/digest/run-digest";

/**
 * Hermetic -- pure error-to-message mapping, no DB, no live call
 * (docs/DECISIONS.md D-097).
 */

describe("digest errorMessageFor", () => {
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
    const message = errorMessageFor(new ModelProviderError("Queue digest model request failed with HTTP 500", 500));
    expect(message).toBe("Queue digest failed (provider error). Try again.");
    expect(message).not.toBe("AI features are not configured in this environment.");
  });

  it("maps ModelTimeoutError, DigestLoopBoundsExceededError, ModelResponseParseError, and an unknown error to their existing messages", () => {
    expect(errorMessageFor(new ModelTimeoutError())).toBe("Queue digest timed out. Try again.");
    expect(errorMessageFor(new DigestLoopBoundsExceededError("max model turns exceeded"))).toBe(
      "Queue digest could not finish within its bounds. Try again.",
    );
    expect(errorMessageFor(new ModelResponseParseError("bad shape"))).toBe("Queue digest returned an unexpected response. Try again.");
    expect(errorMessageFor(new Error("boom"))).toBe("Queue digest failed. Try again.");
  });
});
