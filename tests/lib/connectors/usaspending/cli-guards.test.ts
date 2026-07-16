import { describe, expect, it } from "vitest";
import {
  parseArgs,
  extractProjectRefFromSupabaseUrl,
  assertDevCiProject,
  assertExactlyOneActiveReviewer,
  ALLOWED_COMMIT_PROJECT_REFS,
} from "@/lib/connectors/usaspending/cli-guards";

/**
 * Hermetic -- no DB, no live API, no import of supabase/connector-usaspending.ts
 * (which has a side-effecting top-level main() call and must never be
 * imported by a test). assertExactlyOneActiveReviewer is exercised with a
 * plain mock object satisfying ReviewerCountClient's duck-typed shape --
 * never a real Supabase client -- so these tests never make a DB call.
 */

describe("parseArgs", () => {
  it("defaults to dry-run mode", () => {
    expect(parseArgs([]).mode).toBe("dry-run");
  });

  it("recognizes --commit", () => {
    expect(parseArgs(["--commit"]).mode).toBe("commit");
  });

  it("rejects --commit combined with --diagnostic-keyword", () => {
    expect(() => parseArgs(["--commit", "--diagnostic-keyword", "artificial intelligence"])).toThrow(
      /cannot be combined with --diagnostic-keyword/,
    );
  });

  it("accepts --diagnostic-keyword alone (dry-run mode)", () => {
    const options = parseArgs(["--diagnostic-keyword", "artificial intelligence"]);
    expect(options.mode).toBe("dry-run");
    expect(options.diagnosticKeyword).toBe("artificial intelligence");
  });

  it("requires --confirm-reviewer-control to be passed explicitly to be recognized", () => {
    expect(parseArgs(["--commit"]).confirmReviewerControl).toBe(false);
    expect(parseArgs(["--commit", "--confirm-reviewer-control"]).confirmReviewerControl).toBe(true);
  });

  it("parses --max-requests/--max-candidates with defaults", () => {
    const defaults = parseArgs([]);
    expect(defaults.maxRequests).toBeGreaterThan(0);
    expect(defaults.maxCandidates).toBeGreaterThan(0);
    expect(parseArgs(["--max-requests=3"]).maxRequests).toBe(3);
  });
});

describe("extractProjectRefFromSupabaseUrl", () => {
  it("extracts the project ref from a valid Supabase URL", () => {
    expect(extractProjectRefFromSupabaseUrl("https://isdtiwdfeirgjoaokikg.supabase.co")).toBe("isdtiwdfeirgjoaokikg");
  });

  it("returns null for a malformed URL", () => {
    expect(extractProjectRefFromSupabaseUrl("not-a-url")).toBeNull();
  });
});

describe("assertDevCiProject", () => {
  it("does not throw for the known dev/CI project ref", () => {
    expect(() => assertDevCiProject("https://isdtiwdfeirgjoaokikg.supabase.co")).not.toThrow();
  });

  it("throws for the known production project ref (never on the allow-list)", () => {
    expect(ALLOWED_COMMIT_PROJECT_REFS).not.toContain("cxotknsqqswxxtbquyou");
    expect(() => assertDevCiProject("https://cxotknsqqswxxtbquyou.supabase.co")).toThrow(/not on the dev\/CI commit allow-list/);
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is unset", () => {
    expect(() => assertDevCiProject(undefined)).toThrow(/NEXT_PUBLIC_SUPABASE_URL is not set/);
  });

  it("throws for any unrecognized project ref", () => {
    expect(() => assertDevCiProject("https://some-other-project.supabase.co")).toThrow(/not on the dev\/CI commit allow-list/);
  });
});

describe("assertExactlyOneActiveReviewer", () => {
  /**
   * Takes plain primitives (count/error), not a Supabase client or
   * query-builder shape -- the actual `.from(...).select(...).eq(...)`
   * query lives in supabase/connector-usaspending.ts, the one place a real
   * SupabaseClient is ever constructed. These tests never touch a client,
   * mock or otherwise, and never make a network/DB call of any kind.
   */

  it("does not throw when exactly one active reviewer exists", () => {
    expect(() => assertExactlyOneActiveReviewer(1, null)).not.toThrow();
  });

  it("throws when zero active reviewers exist", () => {
    expect(() => assertExactlyOneActiveReviewer(0, null)).toThrow(/requires exactly one active reviewer_profiles row/);
  });

  it("throws when more than one active reviewer exists", () => {
    expect(() => assertExactlyOneActiveReviewer(3, null)).toThrow(/requires exactly one active reviewer_profiles row/);
  });

  it("throws (does not silently pass) when the query itself errored", () => {
    expect(() => assertExactlyOneActiveReviewer(null, { message: "connection refused" })).toThrow(/preflight query failed/);
  });
});
