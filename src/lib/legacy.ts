import { legacyConfig } from "@/config/legacy";
import type { DocumentType, Product } from "./types";

/**
 * Reduces an imported product to what the legacy website displays (see config/legacy.ts).
 * The full product stays in storage, so the product page can say how much the export holds
 * that this site does not show.
 */
const PREFERRED_DOCS: DocumentType[] = ["drawing", "datasheet", "catalog", "cad", "manual", "certificate", "other"];

export function toLegacyProduct(product: Product): Product {
  const documents = [...product.documents]
    .sort((a, b) => PREFERRED_DOCS.indexOf(a.type) - PREFERRED_DOCS.indexOf(b.type))
    .slice(0, legacyConfig.maxDocuments);
  const description = product.description
    .split(/\n{2,}/)
    .filter(Boolean)
    .slice(0, legacyConfig.maxDescriptionParagraphs)
    .join("\n\n");

  return {
    ...product,
    description,
    features: [],
    images: product.images.slice(0, legacyConfig.maxImages),
    videos: [],
    documents,
    certifications: [],
    specs: product.specs.slice(0, legacyConfig.maxSpecs),
    related: [],
    compatible: [],
  };
}
