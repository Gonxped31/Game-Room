import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Crawlers may read every page except the owner's dashboard and the API.
 * Invite pages stay allowed on purpose: X's card bot obeys robots.txt, and a
 * blocked page gets no preview (their noindex keeps them out of search
 * instead; docs/link-previews.md).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
