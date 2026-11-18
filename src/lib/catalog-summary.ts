import type { StoredCatalog } from "./types";

/** What the admin dashboard shows about the live catalog (small enough to send to the browser). */
export interface CatalogSummary {
  products: number;
  importedAt: string;
  fileName: string | null;
  sheet: string | null;
  restoredFrom: string | null;
  categories: number;
  families: number;
  withImages: number;
  withPrices: number;
  withCompatible: number;
}

export function summarizeCatalog(catalog: StoredCatalog): CatalogSummary {
  const products = catalog.products;
  return {
    products: products.length,
    importedAt: catalog.importedAt,
    fileName: catalog.source?.fileName ?? null,
    sheet: catalog.source?.sheet ?? null,
    restoredFrom: catalog.restoredFrom ?? null,
    categories: new Set(products.map((p) => p.category.join(" › "))).size,
    families: new Set(products.map((p) => p.family.code).filter(Boolean)).size,
    withImages: products.filter((p) => p.images.length).length,
    withPrices: products.filter((p) => p.price != null).length,
    withCompatible: products.filter((p) => p.compatible.length).length,
  };
}
