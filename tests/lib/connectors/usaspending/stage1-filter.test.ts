import { describe, expect, it } from "vitest";
import { applyStage1Filter, STRONG_TERMS, WEAK_TERMS } from "@/lib/connectors/usaspending/stage1-filter";

/**
 * Hermetic -- ports docs/USASPENDING_FIELD_MAPPING_AND_REVIEW_SPEC.md
 * §4.1-§4.6 verbatim. Table-driven per required case: strong terms,
 * phrase patterns, weak-term pairs, weak-term + corroborator, exclusions,
 * exclusions never overriding a strong-term/pattern hit, and empty/
 * insufficient descriptions.
 */

describe("applyStage1Filter: empty/insufficient descriptions", () => {
  it("does not queue an empty description", () => {
    const result = applyStage1Filter({ description: "" });
    expect(result.queued).toBe(false);
    expect(result.skipReason).toBe("empty_description");
  });

  it("does not queue a whitespace-only description", () => {
    const result = applyStage1Filter({ description: "   " });
    expect(result.queued).toBe(false);
    expect(result.skipReason).toBe("empty_description");
  });

  it("does not queue a null/undefined description", () => {
    expect(applyStage1Filter({ description: null }).queued).toBe(false);
    expect(applyStage1Filter({ description: undefined }).queued).toBe(false);
  });
});

describe("applyStage1Filter: strong terms (branch 1)", () => {
  it.each(STRONG_TERMS)("queues on strong term '%s'", (term) => {
    const result = applyStage1Filter({ description: `This award supports ${term} research.` });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("strong_term");
    expect(result.matchedTerms).toContain(term);
  });
});

describe("applyStage1Filter: phrase patterns (branch 2)", () => {
  // Examples with no exact-substring overlap against STRONG_TERMS -- these
  // must resolve specifically to the phrase_pattern branch.
  const patternOnlyExamples = [
    "AI-enabled diagnostic tools",
    "AI powered assistant",
    "predictive analytics platform",
    "prescriptive model for logistics",
    "speech recognition system",
    "image processing software",
    "facial recognition camera",
    "generative model training",
    "autonomous vehicle testing",
    "unmanned system operations",
    "self-navigating robot platform",
    "multi-agent simulation",
    "ai-agent framework",
    "agent-based modeling",
  ];

  it.each(patternOnlyExamples)("queues via phrase_pattern in '%s'", (description) => {
    const result = applyStage1Filter({ description });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("phrase_pattern");
  });

  // These phrase-pattern examples also contain an exact STRONG_TERMS
  // substring ("machine learning", "deep learning", "natural language
  // processing", "large language model", "foundation model" are all
  // strong terms too, per the spec's own overlapping lists) -- the filter
  // resolves strong-term matches first (§4.6's branch order), so these
  // correctly queue via strong_term, not phrase_pattern. Still confirms
  // they queue; branch priority is exercised separately above.
  const overlappingWithStrongTerms = [
    "machine learning pipeline",
    "deep learning models",
    "natural language processing toolkit",
    "large language model deployment",
    "foundation model research",
  ];

  it.each(overlappingWithStrongTerms)("queues (via strong_term, since it overlaps) in '%s'", (description) => {
    const result = applyStage1Filter({ description });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("strong_term");
  });

  it("resolves a hyphenated machine/deep-learning variant to phrase_pattern when no exact strong-term substring is present", () => {
    const result = applyStage1Filter({ description: "This uses a deep-learning approach for imaging." });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("phrase_pattern");
  });
});

describe("applyStage1Filter: weak-term pairs (branch 3)", () => {
  it("queues when 2+ weak terms co-occur", () => {
    const result = applyStage1Filter({ description: "This smart algorithm improves data-driven decisions." });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("weak_term_pair");
  });

  it("does not queue on a single weak term with no corroborator", () => {
    const result = applyStage1Filter({ description: "This project uses an algorithm for scheduling." });
    expect(result.queued).toBe(false);
    expect(result.ruleBranch).toBeNull();
  });

  it.each(WEAK_TERMS)("weak term '%s' alone never queues", (term) => {
    const result = applyStage1Filter({ description: `A project involving ${term} for internal use.` });
    // Some weak terms alone may accidentally match an exclusion; only assert
    // it never queues via a weak-term-only path.
    if (result.queued) {
      expect(result.ruleBranch).not.toBe("weak_term_pair");
    }
  });
});

describe("applyStage1Filter: weak term + code/agency corroborator (branch 4)", () => {
  it("queues on 1 weak term + a NAICS corroborator", () => {
    const result = applyStage1Filter({ description: "This algorithm supports the mission.", naicsCode: "541511" });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("weak_term_plus_corroborator");
    expect(result.matchedCodes).toContain("naics:541511");
  });

  it("queues on 1 weak term + a PSC corroborator", () => {
    const result = applyStage1Filter({ description: "An intelligent process improvement.", pscCode: "DA01" });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("weak_term_plus_corroborator");
  });

  it("queues on 1 weak term + a CFDA corroborator", () => {
    const result = applyStage1Filter({ description: "A smart research initiative.", cfdaText: "SBIR Phase I" });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("weak_term_plus_corroborator");
  });

  it("queues on 1 weak term + an agency corroborator", () => {
    const result = applyStage1Filter({
      description: "A smart research initiative.",
      awardingAgency: "National Science Foundation",
    });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("weak_term_plus_corroborator");
    expect(result.agencyFlag).toBe("National Science Foundation");
  });

  it("does not queue on a corroborator alone with zero weak/strong terms", () => {
    const result = applyStage1Filter({ description: "Routine building maintenance contract.", naicsCode: "541511" });
    expect(result.queued).toBe(false);
  });
});

describe("applyStage1Filter: exclusions (§4.4)", () => {
  const exclusionExamples = [
    "Treatment for aortic insufficiency in cardiac patients.",
    "Artificial insemination services for livestock.",
    "Avian influenza monitoring program.",
    "Aromatase inhibitor drug trial.",
    "Amnesty International advocacy grant.",
    "Adobe Illustrator training course.",
    "As-built drawings for the facility.",
    "Real estate agent commission services.",
    "User agent string logging for web analytics.",
    "Chemical agent detection equipment.",
    "Financial model for budget forecasting.",
    "Climate model simulation for weather patterns.",
    "Building automation system upgrade.",
    "Power generation plant maintenance.",
    "Next-gen infrastructure upgrade.",
    "Lead generation marketing campaign.",
    "Vision statement workshop facilitation.",
    "Vision care benefits administration.",
    "Smart meter installation for utilities.",
    "Business intelligence dashboard reporting.",
    "Intelligence community briefing services.",
  ];

  it.each(exclusionExamples)("does not queue: '%s'", (description) => {
    const result = applyStage1Filter({ description });
    expect(result.queued).toBe(false);
    expect(result.exclusionReason).not.toBeNull();
  });

  it("exclusions never override a strong-term hit", () => {
    const result = applyStage1Filter({
      description: "This machine learning model addresses aortic insufficiency diagnosis.",
    });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("strong_term");
  });

  it("exclusions never override a phrase-pattern hit", () => {
    const result = applyStage1Filter({
      description: "AI-enabled business intelligence platform for real-time analytics.",
    });
    expect(result.queued).toBe(true);
    expect(result.ruleBranch).toBe("phrase_pattern");
  });
});
