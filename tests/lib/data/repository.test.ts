import { describe, expect, it } from "vitest";
import {
  getCompanies,
  getCompaniesBySector,
  getCompanyBySlug,
  getDraftSignals,
  getPublishedSignalById,
  getPublishedSignals,
  getPublishedSignalsForCompany,
  getSectors,
  getSourceDocumentsForSignal,
} from "@/lib/data/repository";

describe("repository", () => {
  it("returns exactly 7 sectors", () => {
    expect(getSectors()).toHaveLength(7);
  });

  it("returns exactly 21 companies, 3 per sector", () => {
    const companies = getCompanies();
    expect(companies).toHaveLength(21);

    for (const sector of getSectors()) {
      expect(getCompaniesBySector(sector.slug)).toHaveLength(3);
    }
  });

  it("splits signals into 14 published and 7 draft", () => {
    expect(getPublishedSignals()).toHaveLength(14);
    expect(getDraftSignals()).toHaveLength(7);
  });

  it("never returns a draft signal from getPublishedSignals", () => {
    for (const signal of getPublishedSignals()) {
      expect(signal.publication_status).toBe("published");
    }
  });

  describe("getPublishedSignalById", () => {
    it("returns the signal for a known published id", () => {
      const signal = getPublishedSignalById("demo-signal-1-1");
      expect(signal?.publication_status).toBe("published");
    });

    it("returns undefined for a known draft id", () => {
      expect(getPublishedSignalById("demo-signal-1-3")).toBeUndefined();
    });

    it("returns undefined for a nonexistent id, identically to a draft id", () => {
      expect(getPublishedSignalById("demo-signal-does-not-exist")).toBeUndefined();
    });
  });

  describe("getPublishedSignalsForCompany", () => {
    it("returns the published signal for a company that has one", () => {
      const signals = getPublishedSignalsForCompany("demo-company-1-1");
      expect(signals).toHaveLength(1);
      expect(signals[0].publication_status).toBe("published");
    });

    it("returns an empty array for a company whose only signal is a draft", () => {
      expect(getPublishedSignalsForCompany("demo-company-1-3")).toEqual([]);
    });
  });

  describe("getSourceDocumentsForSignal", () => {
    it("resolves the signal's evidence source_document_id to real source documents", () => {
      const signal = getPublishedSignalById("demo-signal-1-1");
      const sources = getSourceDocumentsForSignal(signal!);
      expect(sources).toHaveLength(signal!.evidence.length);
      expect(sources[0].id).toBe(signal!.evidence[0].source_document_id);
    });
  });

  it("getCompanyBySlug still resolves companies whose only signal is a draft", () => {
    // Company existence is public-safe regardless of signal status (D-021).
    expect(getCompanyBySlug("publicsignal-demo")).toBeDefined();
  });
});
