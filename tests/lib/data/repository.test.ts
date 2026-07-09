import { describe, expect, it } from "vitest";
import {
  getCompanies,
  getCompaniesBySector,
  getDraftSignals,
  getPublishedSignals,
  getSectors,
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
});
