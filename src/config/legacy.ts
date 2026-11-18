/**
 * What the legacy website shows from the inRiver export.
 *
 * Both websites import the same Excel file. The legacy site keeps only the basic fields below,
 * the way older product sites did; the enhanced website shows everything. Change these values
 * to show more or less on the legacy site.
 */
export const legacyConfig = {
  /** Images per product (the rest of the export's images are not shown). */
  maxImages: 1,
  /** Specifications shown per product, in export order. */
  maxSpecs: 4,
  /** Documents per product (the first drawing or datasheet). */
  maxDocuments: 1,
  /** Paragraphs of the description. */
  maxDescriptionParagraphs: 1,
  /** Fields the legacy site does not display at all. */
  hidden: ["Features", "Videos", "Certifications", "Related products", "Compatible products", "Variants"] as const,
  /**
   * The enhanced website, for the "See everything on the enhanced website" link on product pages.
   * Product URLs are the same on both sites (/product/<slug>).
   */
  enhancedUrl: (process.env.NEXT_PUBLIC_ENHANCED_URL || "https://inriver-web-app.vercel.app").replace(/\/$/, ""),
} as const;
