import type { MetadataRoute } from "next";

/**
 * The legacy site is a demo with the same products as the enhanced website, so search engines are
 * asked not to index it (every page also sends a "noindex" robots tag from the root layout).
 * Pages stay crawlable so that crawlers can see that tag and drop any page they already know.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] }],
  };
}
