import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/content/site";

/**
 * Demo-only default is noindex (docs/DECISIONS.md D-099): every public
 * record today is fictional, so nothing on this site should be presented to
 * crawlers as real, indexable content while it remains demo-only -- hence
 * the blanket "/" disallow. Reviewer/research-queue/auth routes are listed
 * as their own separate, explicit disallow entries (not merely implied by
 * the blanket rule) so they can stay in place unchanged once the blanket
 * demo-only disallow is eventually lifted for real public content (M14).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: ["/", "/reviewer", "/research-queue", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
