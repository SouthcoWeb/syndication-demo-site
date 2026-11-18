import type {
  CategoryMeta,
  CompatibleRef,
  DocumentType,
  ImportSource,
  Product,
  ProductDocument,
  ProductImage,
  ProductSpec,
  ProductVideo,
  SavedMapping,
  StockStatus,
} from "../types";
import { slugify } from "../utils";
import { FIELD_BY_KEY, type FieldKey } from "./fields";
import { MAX_PRODUCTS } from "./normalize";

/**
 * Server-side check of a catalog sent by the import page. Nothing from the browser is
 * trusted: every value is type-checked and length-limited, links must be http(s), slugs are
 * rebuilt, and relations may only point at products of the same catalog.
 */

export interface CatalogInput {
  products: unknown;
  categories?: unknown;
  source?: unknown;
  mapping?: unknown;
}

export interface SanitizedCatalog {
  products: Product[];
  categories: CategoryMeta[];
  source: ImportSource | null;
  mapping: SavedMapping;
}

type Result = { ok: true; catalog: SanitizedCatalog } | { ok: false; error: string };

const DOCUMENT_TYPES = new Set<DocumentType>(["cad", "drawing", "catalog", "datasheet", "certificate", "manual", "other"]);
const STOCK = new Set<StockStatus>(["in_stock", "low_stock", "out_of_stock", "unknown"]);
const PROVIDERS = new Set<ProductVideo["provider"]>(["vimeo", "youtube", "file"]);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const list = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

function text(v: unknown, max: number): string {
  if (typeof v !== "string" && typeof v !== "number") return "";
  // Control characters (except tab and line breaks) have no place in product data.
  return String(v)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function url(v: unknown): string | null {
  const value = text(v, 2048);
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function finite(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function texts(v: unknown, maxItems: number, maxLength: number): string[] {
  return Array.from(new Set(list(v, maxItems).map((item) => text(item, maxLength)).filter(Boolean)));
}

function product(raw: unknown): Product | null {
  if (!isObject(raw)) return null;
  const sku = text(raw.sku, 120);
  if (!sku) return null;
  const name = text(raw.name, 300) || sku;
  const family = isObject(raw.family) ? raw.family : {};
  const stock = isObject(raw.stock) ? raw.stock : {};
  const status = STOCK.has(stock.status as StockStatus) ? (stock.status as StockStatus) : "unknown";
  const quantity = finite(stock.quantity);
  const price = finite(raw.price);
  const currency = text(raw.currency, 3).toUpperCase();

  const images = list(raw.images, 30)
    .map((img): ProductImage | null => {
      if (!isObject(img)) return null;
      const src = url(img.src);
      return src ? { src, alt: text(img.alt, 300) } : null;
    })
    .filter((img): img is ProductImage => img !== null);

  const videos = list(raw.videos, 20)
    .map((v): ProductVideo | null => {
      if (!isObject(v) || !PROVIDERS.has(v.provider as ProductVideo["provider"])) return null;
      const provider = v.provider as ProductVideo["provider"];
      const id = provider === "file" ? url(v.id) : text(v.id, 40);
      if (!id || (provider !== "file" && !/^[\w-]+$/.test(id))) return null;
      const hash = text(v.hash, 40);
      const thumbnail = url(v.thumbnail);
      const duration = finite(v.duration);
      return {
        provider,
        id,
        title: text(v.title, 200) || name,
        ...(hash && /^[0-9a-f]+$/i.test(hash) ? { hash } : {}),
        ...(thumbnail ? { thumbnail } : {}),
        ...(duration && duration > 0 ? { duration } : {}),
      };
    })
    .filter((v): v is ProductVideo => v !== null);

  const documents = list(raw.documents, 60)
    .map((d): ProductDocument | null => {
      if (!isObject(d)) return null;
      const href = url(d.url);
      if (!href) return null;
      return {
        type: DOCUMENT_TYPES.has(d.type as DocumentType) ? (d.type as DocumentType) : "other",
        label: text(d.label, 120) || "Document",
        format: text(d.format, 20) || "Link",
        url: href,
      };
    })
    .filter((d): d is ProductDocument => d !== null);

  const specs: ProductSpec[] = [];
  for (const s of list(raw.specs, 300)) {
    if (!isObject(s)) continue;
    const specName = text(s.name, 120);
    const value = text(s.value, 1000);
    if (!specName || !value || specs.some((x) => x.name === specName)) continue;
    const unit = text(s.unit, 12);
    specs.push({ name: specName, value, ...(unit ? { unit } : {}) });
  }

  const compatible: CompatibleRef[] = list(raw.compatible, 300)
    .map((c): CompatibleRef | null => {
      if (!isObject(c)) return null;
      const target = text(c.sku, 120);
      if (!target) return null;
      const note = text(c.note, 200);
      return { sku: target, group: text(c.group, 60) || "Compatible parts", ...(note ? { note } : {}) };
    })
    .filter((c): c is CompatibleRef => c !== null);

  const category = texts(raw.category, 6, 120);
  const accessoryType = text(raw.accessoryType, 80);
  return {
    sku,
    slug: "",
    name,
    title: text(raw.title, 500) || name,
    brand: text(raw.brand, 80),
    family: { code: text(family.code, 120), name: text(family.name, 200) },
    category: category.length ? category : ["Products"],
    accessoryType: accessoryType || null,
    description: text(raw.description, 20000),
    features: texts(raw.features, 40, 500),
    images,
    videos,
    documents,
    certifications: texts(raw.certifications, 40, 80),
    specs,
    price: price != null && price >= 0 ? price : null,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
    stock: { status, quantity: quantity != null && quantity >= 0 ? Math.round(quantity) : null },
    popularity: finite(raw.popularity) ?? 0,
    added: finite(raw.added),
    featured: raw.featured === true,
    related: texts(raw.related, 300, 120),
    compatible,
    source: text(raw.source, 300) || undefined,
  };
}

export function sanitizeCatalog(input: CatalogInput): Result {
  if (!Array.isArray(input.products)) return { ok: false, error: "The import contained no product list." };
  if (input.products.length > MAX_PRODUCTS) return { ok: false, error: `Too many products: the limit is ${MAX_PRODUCTS}.` };

  const products: Product[] = [];
  const seen = new Set<string>();
  const slugs = new Set<string>();
  for (const raw of input.products) {
    const item = product(raw);
    if (!item || seen.has(item.sku.toLowerCase())) continue;
    seen.add(item.sku.toLowerCase());
    const base = slugify(item.sku) || "item";
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
    slugs.add(slug);
    item.slug = slug;
    products.push(item);
  }
  if (!products.length) return { ok: false, error: "No valid products to publish (every product needs a part number)." };

  // Relations may only point at products of this catalog.
  const skus = new Set(products.map((p) => p.sku));
  for (const p of products) {
    p.related = p.related.filter((sku) => sku !== p.sku && skus.has(sku));
    p.compatible = p.compatible.filter((c) => c.sku !== p.sku && skus.has(c.sku));
  }

  const categories: CategoryMeta[] = list(input.categories, 300)
    .map((c): CategoryMeta | null => {
      if (!isObject(c)) return null;
      const path = texts(c.path, 6, 120);
      return path.length ? { path, description: text(c.description, 2000) } : null;
    })
    .filter((c): c is CategoryMeta => c !== null);

  const source = isObject(input.source)
    ? { fileName: text(input.source.fileName, 255) || "import", sheet: text(input.source.sheet, 120), rows: Math.max(0, Math.round(finite(input.source.rows) ?? 0)) }
    : null;

  const mapping: SavedMapping = {};
  if (isObject(input.mapping)) {
    for (const [key, value] of Object.entries(input.mapping).slice(0, 500)) {
      const header = text(key, 200);
      if (header && typeof value === "string" && FIELD_BY_KEY.has(value as FieldKey)) mapping[header] = value;
    }
  }

  return { ok: true, catalog: { products, categories, source, mapping } };
}
