import type { ProductPageData } from "./catalog-core";
import { familyLabel } from "./format";
import { slugify } from "./utils";

/**
 * The "From inRiver" navigator on the product page: every attribute the import brought in
 * for this part, grouped, each pointing at the element on the page that shows it.
 * Plain data, so the server builds it and the client panel only renders and scrolls.
 */

export type AttributeIcon = "identity" | "overview" | "media" | "specs" | "certifications" | "documents" | "variants" | "related" | "compatible";

export interface AttributeItem {
  label: string;
  /** Short value preview, e.g. "Steel". */
  value?: string;
  /** Element id on the product page to scroll to. */
  target: string;
}

export interface AttributeGroup {
  key: string;
  label: string;
  icon: AttributeIcon;
  /** Element id of the whole section. */
  target: string;
  /** Badge number (items, files, parts …). */
  count: number;
  items: AttributeItem[];
  /** Built by the site (not a column in the export): shown, but not counted as imported. */
  derived?: boolean;
}

/** Id of a row in the specification table ("Grip - Minimum" → "spec-grip-minimum"). */
export const specAnchorId = (name: string) => `spec-${slugify(name) || "row"}`;

export function attributeGroups(data: ProductPageData): AttributeGroup[] {
  const { product, related, compatible, variants } = data;
  const groups: AttributeGroup[] = [];
  const spec = (label: string, value: string): AttributeItem => ({ label, value, target: specAnchorId(label) });

  const identity: AttributeItem[] = [
    spec("Part number", product.sku),
    { label: "Title", value: product.title, target: "buy-box" },
    ...(product.brand ? [spec("Brand", product.brand)] : []),
    ...(product.family.code ? [spec("Product family", familyLabel(product.family.code, product.family.name))] : []),
    ...(product.category.length ? [spec("Category", product.category.join(" › "))] : []),
  ];
  groups.push({ key: "identity", label: "Product data", icon: "identity", target: "buy-box", count: identity.length, items: identity });

  const overview: AttributeItem[] = [
    ...(product.description ? [{ label: "Description", target: "product-description" }] : []),
    ...(product.features.length ? [{ label: "Features", value: `${product.features.length}`, target: "product-features" }] : []),
  ];
  if (overview.length) groups.push({ key: "overview", label: "Overview", icon: "overview", target: "overview", count: overview.length, items: overview });

  const media: AttributeItem[] = [
    ...(product.images.length ? [{ label: "Images", value: `${product.images.length}`, target: "media" }] : []),
    ...(product.videos.length ? [{ label: "Videos", value: `${product.videos.length}`, target: "videos" }] : []),
  ];
  if (media.length) groups.push({ key: "media", label: "Media", icon: "media", target: "media", count: product.images.length + product.videos.length, items: media });

  if (product.specs.length) {
    const items = product.specs.map((s) => spec(s.name, s.unit ? `${s.value} ${s.unit}` : s.value));
    groups.push({ key: "specs", label: "Specifications", icon: "specs", target: "specifications", count: items.length, items });
  }

  if (product.certifications.length) {
    groups.push({
      key: "certifications",
      label: "Certifications",
      icon: "certifications",
      target: specAnchorId("Certifications"),
      count: product.certifications.length,
      items: [],
    });
  }

  if (product.documents.length) {
    groups.push({
      key: "documents",
      label: "Documents",
      icon: "documents",
      target: "downloads",
      count: product.documents.length,
      items: product.documents.map((d, i) => ({ label: d.label, value: d.format, target: `doc-${i}` })),
    });
  }

  if (variants) groups.push({ key: "variants", label: "Variants", icon: "variants", target: "variants", count: variants.rows.length, items: [], derived: true });
  if (related.length) groups.push({ key: "related", label: "Related products", icon: "related", target: "related", count: related.length, items: [] });

  const compatibleCount = compatible.reduce((n, g) => n + g.items.length, 0);
  groups.push({ key: "compatible", label: "Compatible products", icon: "compatible", target: "compatible", count: compatibleCount, items: [] });

  return groups;
}

/** Imported attributes: each listed field counts once; relation groups count once when filled. */
export function importedAttributeCount(groups: AttributeGroup[]): number {
  return groups.reduce((n, g) => (g.derived ? n : n + (g.items.length || (g.count > 0 ? 1 : 0))), 0);
}
