/**
 * Data model. The import page (/admin) turns the inRiver Excel export into
 * `Product` records and publishes them as one stored catalog (see catalog-store.ts).
 */

/** "unknown" when the Excel has no availability column: nothing is shown instead of a guess. */
export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "unknown";

export interface ProductImage {
  src: string;
  alt: string;
}

export interface ProductVideo {
  provider: "vimeo" | "youtube" | "file";
  /** Provider video id, or the full URL for `file` videos. */
  id: string;
  /** Vimeo privacy hash for unlisted videos. */
  hash?: string;
  title: string;
  /** Duration in seconds. */
  duration?: number;
  thumbnail?: string;
}

export type DocumentType = "cad" | "drawing" | "catalog" | "datasheet" | "certificate" | "manual" | "other";

export interface ProductDocument {
  type: DocumentType;
  label: string;
  /** Display format, e.g. "PDF", "CAD", "STEP". */
  format: string;
  url: string;
}

export interface ProductSpec {
  name: string;
  value: string;
  unit?: string;
}

export interface CompatibleRef {
  sku: string;
  /** Group heading on the product page, e.g. "Keys", "Cams", "Gaskets". */
  group: string;
  note?: string;
}

export interface Product {
  sku: string;
  slug: string;
  /** Short name used in compact places. */
  name: string;
  /** Full descriptive title. */
  title: string;
  brand: string;
  /** Product family / inRiver product the item belongs to. Empty code = no family. */
  family: { code: string; name: string };
  /** Category path from the top level, e.g. ["Latches", "Compression Latches", "Lever Latches"]. */
  category: string[];
  /** Set when the product is an accessory (key, cam, gasket, ...). */
  accessoryType: string | null;
  description: string;
  features: string[];
  images: ProductImage[];
  videos: ProductVideo[];
  documents: ProductDocument[];
  certifications: string[];
  specs: ProductSpec[];
  price: number | null;
  currency: string;
  stock: { status: StockStatus; quantity: number | null };
  /** Higher is more popular. Drives "Most popular". */
  popularity: number;
  /** Sortable creation order or timestamp (higher is newer). Drives "Newest". */
  added: number | null;
  featured: boolean;
  /** SKUs shown under "Related products". */
  related: string[];
  /** SKUs shown under "Compatible products", grouped. */
  compatible: CompatibleRef[];
  /** Where the record came from, e.g. "Products.xlsx › Items, row 12". */
  source?: string;
}

export interface CategoryMeta {
  path: string[];
  description: string;
}

/** Light, serializable product shape used by cards, cart, quote and compare. */
export interface CardProduct {
  sku: string;
  slug: string;
  name: string;
  title: string;
  image: string | null;
  price: number | null;
  stock: StockStatus;
  familyCode: string;
  familyName: string;
  accessoryType: string | null;
  highlights: string[];
}

/* ------------------------------------------------------------ stored catalog */

/** The file an import came from. */
export interface ImportSource {
  fileName: string;
  sheet: string;
  /** Data rows read from the sheet (header excluded). */
  rows: number;
}

/** Normalized column header → field key, remembered so the next import maps itself. */
export type SavedMapping = Record<string, string>;

/** One published catalog: everything the site shows, plus how it was imported. */
export interface StoredCatalog {
  version: 1;
  /** ISO time of the import; empty for the initial, never-imported catalog. */
  importedAt: string;
  source: ImportSource | null;
  /** Set when this catalog was restored from an earlier import (ISO time of that import). */
  restoredFrom?: string;
  products: Product[];
  categories: CategoryMeta[];
  mapping: SavedMapping;
}

/** An entry in the import history (newest first). */
export interface CatalogVersion {
  id: string;
  importedAt: string;
  fileName: string | null;
  products: number;
  restoredFrom?: string;
}
