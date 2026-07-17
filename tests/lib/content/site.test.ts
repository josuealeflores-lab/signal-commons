import { describe, expect, it } from "vitest";
import { CORRECTIONS_EMAIL, SITE_URL } from "@/lib/content/site";

/**
 * Guards the corrections-mailbox gate (docs/DECISIONS.md D-099): the
 * shipped address must be the confirmed, monitored, non-personal
 * domain-based alias -- never a personal provider, never a placeholder.
 */
describe("site content constants", () => {
  it("uses the confirmed domain-based corrections alias, never a personal or placeholder address", () => {
    expect(CORRECTIONS_EMAIL).toBe("corrections@signal-commons.org");
    expect(CORRECTIONS_EMAIL).toMatch(/^[a-z0-9._-]+@signal-commons\.org$/);
    expect(CORRECTIONS_EMAIL).not.toMatch(/gmail\.com|yahoo\.com|hotmail\.com|outlook\.com|icloud\.com/i);
    expect(CORRECTIONS_EMAIL).not.toMatch(/example\.(com|org)|todo|placeholder|noreply@/i);
  });

  it("uses the confirmed custom domain for SITE_URL", () => {
    expect(SITE_URL).toBe("https://signal-commons.org");
  });
});
