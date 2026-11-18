import type { CompatibleRef, Product, ProductDocument, ProductImage, ProductSpec, ProductVideo, StockStatus } from "../types";
import { compactKey, slugify } from "../utils";
import { FIELD_BY_KEY, normalizeHeader, splitUnit, type ColumnInfo, type FieldKey } from "./fields";
import type { SheetData } from "./sheet-types";
import {
  clean,
  documentFormat,
  documentType,
  extractLabelledLinks,
  extractUrls,
  htmlToText,
  isNo,
  isYes,
  parsePrice,
  parseSortableDate,
  parseStock,
  parseVideo,
  splitBullets,
  splitList,
} from "./values";

/** Turns mapped spreadsheet rows into products, with a report of everything worth knowing before publishing. */

export const MAX_PRODUCTS = 1000;

export interface ImportSettings {
  fileName: string;
  sheetName: string;
  /** 0-based index of the header row. */
  headerRow: number;
  /** Prefix for media given as file names instead of full URLs. */
  mediaBase?: string;
  /** Used when prices carry no currency. */
  defaultCurrency?: string;
}

export interface ImportIssue {
  level: "error" | "warning";
  message: string;
  /** First affected spreadsheet row numbers (as shown in Excel). */
  rows?: number[];
  /** Total number of affected rows. */
  count?: number;
}

export interface ImportStats {
  rows: number;
  products: number;
  withImages: number;
  withVideos: number;
  withDocuments: number;
  withPrices: number;
  withStock: number;
  categories: number;
  families: number;
  specColumns: number;
  relatedLinks: number;
  compatibleLinks: number;
}

export interface ImportResult {
  products: Product[];
  issues: ImportIssue[];
  stats: ImportStats;
}

const ROW_SAMPLE = 8;

/** "Latches > Compression Latches", "Latches › Lever", "A | B", "A\B" → levels. "/" splits only with spaces around it. */
function splitPath(value: string): string[] {
  const first = value.split(/[\n;]+/)[0] ?? "";
  return first
    .split(/\s*(?:>|›|»|\\|\|)\s*|\s+\/\s+/)
    .map((level) => level.trim())
    .filter(Boolean)
    .slice(0, 6);
}

/** "Compatible Keys" → "Keys"; generic headers ("Compatible products", "Accessories") → null. */
function groupFromHeader(header: string): string | null {
  const key = normalizeHeader(header);
  if (/^(compatible(products|items|skus|parts|with)?|accessories|accessoryskus|accessoryparts|fits|fitswith|workswith|matingparts|spareparts|replacementparts|optionalaccessories|components)\d*$/.test(key)) {
    return null;
  }
  const group = header.replace(/^\s*compatible\s*/i, "").trim();
  return group ? group[0].toUpperCase() + group.slice(1) : null;
}

/** "RoHS compliant" → "RoHS". */
function certificationLabel(header: string): string {
  return splitUnit(header).name.replace(/\s*(compliant|compliance|certified|certification|approved|approval|listed)\s*$/i, "").trim() || header;
}

/** "Rotary Push-to-Close Latch, Medium Size, Single Stage, …" → "Rotary Push-to-Close Latch". Short names stay as they are. */
function shortName(text: string): string {
  if (text.length <= 80) return text;
  const first = text.split(",")[0].trim();
  return first.length >= 3 ? first : text;
}

/** Column header → document label ("2D Drawing URL" → "2D Drawing"). */
function documentLabel(header: string): string {
  return header.replace(/\s*(url|link|file|path)s?\s*\d*\s*$/i, "").trim() || header;
}

function issue(issues: ImportIssue[], level: ImportIssue["level"], message: string, rows?: number[]) {
  issues.push({ level, message, ...(rows?.length ? { rows: rows.slice(0, ROW_SAMPLE), count: rows.length } : {}) });
}

export function buildProducts(sheet: SheetData, columns: ColumnInfo[], mapping: FieldKey[], settings: ImportSettings): ImportResult {
  const issues: ImportIssue[] = [];
  const byField = new Map<FieldKey, ColumnInfo[]>();
  columns.forEach((col, i) => {
    const field = mapping[i] ?? "ignore";
    if (field === "ignore") return;
    byField.set(field, [...(byField.get(field) ?? []), col]);
  });
  const cols = (field: FieldKey) => byField.get(field) ?? [];
  const one = (field: FieldKey) => cols(field)[0];
  const categorized = cols("category").some((col) => col.filled > 0);

  for (const [field, list] of byField) {
    if (list.length > 1 && !FIELD_BY_KEY.get(field)?.multiple) {
      issue(issues, "warning", `${list.length} columns are mapped to “${FIELD_BY_KEY.get(field)?.label}”; only “${list[0].header}” is used.`);
    }
  }

  const skuCol = one("sku");
  if (!skuCol) {
    issue(issues, "error", "Choose the column that holds the part number (SKU). It is required to import products.");
  }

  const dataRows = sheet.rows.slice(settings.headerRow + 1);
  const mediaBase = settings.mediaBase?.trim() ?? "";
  const products: Product[] = [];
  const pending: Array<{ product: Product; related: string[]; compatible: Array<{ token: string; group: string | null }> }> = [];
  const firstRowOf = new Map<string, number>();
  const missingSku: number[] = [];
  const duplicates: number[] = [];
  const badVideos: number[] = [];
  const unparsedPrices: number[] = [];
  let rowsWithContent = 0;

  dataRows.forEach((row, offset) => {
    if (!row.some((cell) => cell.trim())) return;
    rowsWithContent++;
    const r = settings.headerRow + 1 + offset;
    const rowNumber = r + 1;
    const get = (col: ColumnInfo | undefined) => (col ? clean(row[col.index]) : "");
    const link = (col: ColumnInfo) => sheet.links[`${r}:${col.index}`];

    if (!skuCol) return;
    const sku = get(skuCol).replace(/\s+/g, " ");
    if (!sku) {
      missingSku.push(rowNumber);
      return;
    }
    const key = sku.toLowerCase();
    if (firstRowOf.has(key)) {
      duplicates.push(rowNumber);
      return;
    }
    firstRowOf.set(key, rowNumber);

    const nameText = htmlToText(get(one("name")));
    const titleText = htmlToText(get(one("title")));
    const title = titleText || nameText || sku;
    // With only one long text, it is the title and its first part the short name.
    const name = nameText && titleText ? nameText : shortName(nameText || titleText) || sku;

    // Category: one path column, or one column per level.
    const categoryCols = cols("category");
    let category = categoryCols.length === 1 ? splitPath(get(categoryCols[0])) : categoryCols.map((c) => get(c).split(/[\n;]/)[0].trim()).filter(Boolean);

    let familyCode = get(one("family"));
    // A code exported in lower case ("r4-25") is shown as written in the part number ("R4-25-230-…").
    if (familyCode && sku.toLowerCase().startsWith(familyCode.toLowerCase())) familyCode = sku.slice(0, familyCode.length);
    let familyName = get(one("familyName"));
    if (!familyCode) familyCode = familyName;
    if (!familyName) familyName = familyCode;
    // Uncategorized rows of a categorized file go to "Other products"; without categories each family is one.
    if (!category.length) category = [categorized ? "Other products" : familyName || "Products"];

    const accessory = get(one("accessoryType"));

    const description = cols("description")
      .map((c) => htmlToText(get(c)))
      .filter(Boolean)
      .join("\n\n");
    const features = Array.from(new Set(cols("features").flatMap((c) => splitBullets(get(c))))).slice(0, 40);

    const images: ProductImage[] = [];
    for (const col of cols("image")) {
      const value = get(col);
      const urls = extractUrls(value, mediaBase);
      if (!urls.length && link(col)) urls.push(link(col));
      for (const src of urls) if (!images.some((img) => img.src === src)) images.push({ src, alt: title });
    }

    const videos: ProductVideo[] = [];
    const documents: ProductDocument[] = [];
    for (const col of cols("video")) {
      const value = get(col);
      const urls = extractUrls(value, mediaBase);
      if (!urls.length && link(col)) urls.push(link(col));
      for (const url of urls) {
        const video = parseVideo(url, `${name} — ${documentLabel(col.base)}`);
        if (video) {
          if (video.provider === "youtube") video.thumbnail = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
          if (!videos.some((v) => v.provider === video.provider && v.id === video.id)) videos.push(video);
        } else {
          documents.push({ type: "other", label: documentLabel(col.base), format: "Video", url });
          badVideos.push(rowNumber);
        }
      }
    }

    for (const col of cols("document")) {
      const value = get(col);
      const links = extractLabelledLinks(value, mediaBase);
      if (!links.length && link(col)) links.push({ label: "", url: link(col) });
      links.forEach(({ label, url }, i) => {
        if (documents.some((d) => d.url === url)) return;
        const base = documentLabel(col.base);
        const text = label || (links.length > 1 ? `${base} ${i + 1}` : base);
        documents.push({ type: documentType(text, url), label: text, format: documentFormat(url), url });
      });
    }

    const related = cols("related").flatMap((c) => splitList(get(c)));
    const compatible: Array<{ token: string; group: string | null }> = [];
    for (const col of cols("compatible")) {
      const headerGroup = groupFromHeader(col.base);
      for (const segment of get(col).split(/[;\n]+/)) {
        const grouped = /^\s*([^:,|]{1,40}):\s*(.+)$/.exec(segment);
        const group = grouped ? grouped[1].trim() : headerGroup;
        for (const token of splitList(grouped ? grouped[2] : segment)) compatible.push({ token, group });
      }
    }

    const priceText = get(one("price"));
    const price = parsePrice(priceText);
    if (priceText && price.amount == null) unparsedPrices.push(rowNumber);
    const currencyText = get(one("currency")).toUpperCase();
    const currency = /^[A-Z]{3}$/.test(currencyText) ? currencyText : (price.currency ?? settings.defaultCurrency ?? "USD");

    const stockCol = one("stock");
    const stock: { status: StockStatus; quantity: number | null } = stockCol ? parseStock(get(stockCol)) : { status: "unknown", quantity: null };

    const certifications: string[] = [];
    for (const col of cols("certification")) {
      const value = get(col);
      if (!value || isNo(value)) continue;
      const items = isYes(value) ? [certificationLabel(col.base)] : splitList(value);
      for (const item of items) if (!certifications.includes(item)) certifications.push(item);
    }

    const specs: ProductSpec[] = [];
    for (const col of cols("spec")) {
      const value = htmlToText(get(col)).replace(/\n+/g, ", ");
      if (!value) continue;
      const { name: specName, unit } = splitUnit(col.base);
      if (specs.some((s) => s.name === specName)) continue;
      specs.push({ name: specName, value, ...(unit ? { unit } : {}) });
    }
    // The accessory type is also a specification: the "Accessory type" filter, card chips and variants table read it from there.
    const accessoryType = accessory && !isNo(accessory) ? accessory : null;
    if (accessoryType && !specs.some((s) => s.name === "Accessory Type")) specs.push({ name: "Accessory Type", value: accessoryType });

    const product: Product = {
      sku,
      slug: "",
      name,
      title,
      brand: get(one("brand")),
      family: { code: familyCode, name: familyName },
      category,
      accessoryType,
      description,
      features,
      images,
      videos,
      documents,
      certifications,
      specs,
      price: price.amount,
      currency,
      stock,
      popularity: 0,
      added: parseSortableDate(get(one("added"))),
      featured: isYes(get(one("featured"))),
      related: [],
      compatible: [],
      source: `${settings.fileName} › ${settings.sheetName}, row ${rowNumber}`,
    };
    products.push(product);
    pending.push({ product, related, compatible });
  });

  if (missingSku.length) issue(issues, "warning", `${missingSku.length} row(s) have no part number and were skipped.`, missingSku);
  if (duplicates.length) issue(issues, "warning", `${duplicates.length} row(s) repeat a part number that appears earlier; only the first row is used.`, duplicates);
  if (badVideos.length) issue(issues, "warning", `${badVideos.length} video link(s) are not YouTube, Vimeo or a video file; they are listed as downloads instead.`, badVideos);
  if (unparsedPrices.length) issue(issues, "warning", `${unparsedPrices.length} price(s) could not be read as a number and are shown as “Price on request”.`, unparsedPrices);

  // Default order ("popularity", higher first): a popularity column, else a sort-order column (lower first),
  // else the order of the spreadsheet. Products without a value come after the ranked ones, in sheet order.
  const count = products.length;
  const rankCol = one("popularity") ?? one("sortOrder");
  const ascending = !one("popularity") && !!one("sortOrder");
  const ranks = products.map((product) => {
    if (!rankCol) return NaN;
    const row = sheet.rows[firstRowOf.get(product.sku.toLowerCase())! - 1] ?? [];
    const text = clean(row[rankCol.index]).replace(/[^\d.-]/g, "");
    return text ? Number(text) : NaN;
  });
  const known = ranks.map((rank) => (ascending ? -rank : rank)).filter((rank) => Number.isFinite(rank));
  const floor = known.length ? Math.min(...known) : 0;
  products.forEach((product, i) => {
    const rank = ascending ? -ranks[i] : ranks[i];
    product.popularity = Number.isFinite(rank) ? rank : rankCol ? floor - 1 - i : count - i;
  });

  // Slugs and relations (references resolved against this file only).
  const bySku = new Map(products.map((p) => [p.sku.toLowerCase(), p]));
  const byCompact = new Map(products.map((p) => [compactKey(p.sku), p]));
  const resolve = (token: string) => bySku.get(token.toLowerCase()) ?? byCompact.get(compactKey(token));
  const slugs = new Set<string>();
  for (const product of products) {
    const base = slugify(product.sku) || "item";
    let slug = base;
    for (let n = 2; slugs.has(slug); n++) slug = `${base}-${n}`;
    slugs.add(slug);
    product.slug = slug;
  }

  const missingRefs = new Set<string>();
  let relatedLinks = 0;
  let compatibleLinks = 0;
  for (const { product, related, compatible } of pending) {
    for (const token of related) {
      const target = resolve(token);
      if (!target) missingRefs.add(token);
      else if (target !== product && !product.related.includes(target.sku)) product.related.push(target.sku);
    }
    for (const { token, group } of compatible) {
      const target = resolve(token);
      if (!target) {
        missingRefs.add(token);
        continue;
      }
      if (target === product || product.compatible.some((c) => c.sku === target.sku)) continue;
      const ref: CompatibleRef = { sku: target.sku, group: group || target.accessoryType || target.category[target.category.length - 1] || "Compatible parts" };
      product.compatible.push(ref);
    }
    relatedLinks += product.related.length;
    compatibleLinks += product.compatible.length;
  }
  if (missingRefs.size) {
    const examples = Array.from(missingRefs).slice(0, 6).join(", ");
    issue(
      issues,
      "warning",
      `${missingRefs.size} related/compatible part number(s) are not in this file (e.g. ${examples}). Only products in the file can be linked, so these are skipped.`,
    );
  }

  if (skuCol && !products.length) issue(issues, "error", "No products found below the header row. Check that the right sheet and header row are selected.");
  if (count > MAX_PRODUCTS) issue(issues, "error", `This file has ${count} products; the limit is ${MAX_PRODUCTS}. Import a smaller selection.`);
  if (count && !cols("name").length && !cols("title").length) issue(issues, "warning", "No name column is mapped, so part numbers are used as product names.");
  if (count && !cols("image").length) issue(issues, "warning", "No image column is mapped; products will show a placeholder instead of a photo.");
  const withoutImages = products.filter((p) => !p.images.length).length;
  if (cols("image").length && withoutImages) issue(issues, "warning", `${withoutImages} product(s) have no image.`);

  return {
    products,
    issues,
    stats: {
      rows: rowsWithContent,
      products: count,
      withImages: count - withoutImages,
      withVideos: products.filter((p) => p.videos.length).length,
      withDocuments: products.filter((p) => p.documents.length).length,
      withPrices: products.filter((p) => p.price != null).length,
      withStock: products.filter((p) => p.stock.status !== "unknown").length,
      categories: new Set(products.map((p) => p.category.join(" › "))).size,
      families: new Set(products.map((p) => p.family.code).filter(Boolean)).size,
      specColumns: cols("spec").length,
      relatedLinks,
      compatibleLinks,
    },
  };
}

/**
 * Fills in Vimeo thumbnails, titles and durations from Vimeo's public oEmbed API.
 * Best effort: on any network problem the videos keep a plain poster.
 */
export async function enrichVimeo(products: Product[], fetcher: typeof fetch = fetch): Promise<void> {
  const videos = products.flatMap((p) => p.videos.filter((v) => v.provider === "vimeo" && !v.thumbnail));
  const unique = new Map<string, ProductVideo[]>();
  for (const video of videos) unique.set(video.id, [...(unique.get(video.id) ?? []), video]);
  await Promise.all(
    Array.from(unique.entries())
      .slice(0, 60)
      .map(async ([id, list]) => {
        try {
          const target = `https://vimeo.com/${id}${list[0].hash ? `/${list[0].hash}` : ""}`;
          const res = await fetcher(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(target)}&width=1280`, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) return;
          const data = (await res.json()) as { thumbnail_url?: string; title?: string; duration?: number };
          for (const video of list) {
            if (data.thumbnail_url?.startsWith("https://")) video.thumbnail = data.thumbnail_url;
            if (data.title) video.title = data.title;
            if (data.duration) video.duration = data.duration;
          }
        } catch {
          /* keep the plain poster */
        }
      }),
  );
}
