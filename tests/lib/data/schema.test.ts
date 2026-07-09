import { describe, expect, it } from "vitest";
import rawDemoData from "../../../seed/demo-data.json";
import { demoDataSchema, signalSchema } from "@/lib/data/schema";

describe("demoDataSchema", () => {
  it("validates the real seed/demo-data.json without throwing", () => {
    expect(() => demoDataSchema.parse(rawDemoData)).not.toThrow();
  });

  it("rejects a malformed fixture with a missing required field", () => {
    const malformed = {
      meta: { ...rawDemoData.meta },
      sectors: rawDemoData.sectors,
      companies: rawDemoData.companies,
      source_documents: rawDemoData.source_documents,
      // signals intentionally omitted
    };
    expect(() => demoDataSchema.parse(malformed)).toThrow();
  });
});

describe("signalSchema", () => {
  it("rejects a signal with an invalid evidence_strength value", () => {
    const badSignal = {
      ...rawDemoData.signals[0],
      evidence_strength: "extreme",
    };
    expect(() => signalSchema.parse(badSignal)).toThrow();
  });

  it("rejects a signal with an empty evidence array", () => {
    const badSignal = { ...rawDemoData.signals[0], evidence: [] };
    expect(() => signalSchema.parse(badSignal)).toThrow();
  });
});
