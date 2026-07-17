import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/content/site";

/**
 * Stable public structural routes only (docs/DECISIONS.md D-099) -- no
 * per-sector, per-company, or per-signal detail route is included yet.
 * Signal detail URLs use raw UUID ids today and must wait for the
 * signal-slug strategy to actually be implemented before they could safely
 * appear here; sector/company detail routes are excluded for this
 * milestone too, per D-099's "keep sitemap minimal and structural only if
 * uncertain" guidance -- a more specific safe list can be added in a later
 * implementation review. This list requires no data fetch at all, so it can
 * never accidentally include a draft/private/reviewer-only record.
 */
const STATIC_ROUTES = ["/", "/about", "/methodology", "/sectors", "/companies", "/signals"];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified,
  }));
}
