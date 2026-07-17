/**
 * Confirmed, monitored, non-personal corrections alias (docs/DECISIONS.md
 * D-099's corrections-mailbox gate) -- never a personal address, never a
 * placeholder. SITE_URL is the confirmed custom domain, used for
 * robots.ts/sitemap.ts/OpenGraph metadata (Metadata's metadataBase and
 * absolute URLs all require a real origin, not a relative path).
 */
export const SITE_URL = "https://signal-commons.org";
export const CORRECTIONS_EMAIL = "corrections@signal-commons.org";
