import { clean } from "./values";

/**
 * What each spreadsheet column can be used for, and automatic mapping of
 * inRiver-style headers ("Item Number", "ProductName", "Image URL 2", "Weight (kg)",
 * "Name (en)" …) to those fields. Anything not recognized becomes a specification.
 */

export type FieldKey =
  | "sku"
  | "name"
  | "title"
  | "description"
  | "features"
  | "category"
  | "family"
  | "familyName"
  | "brand"
  | "accessoryType"
  | "image"
  | "video"
  | "document"
  | "related"
  | "compatible"
  | "price"
  | "currency"
  | "stock"
  | "certification"
  | "featured"
  | "sortOrder"
  | "popularity"
  | "added"
  | "spec"
  | "ignore";

export interface FieldDef {
  key: FieldKey;
  label: string;
  group: "Product" | "Content" | "Media & files" | "Relations" | "Commerce" | "Sorting" | "Other";
  /** Several columns can feed this field (they are combined). */
  multiple: boolean;
  help: string;
}

export const FIELDS: FieldDef[] = [
  { key: "sku", label: "Part number (SKU)", group: "Product", multiple: false, help: "Unique id of each product. Required." },
  { key: "name", label: "Name", group: "Product", multiple: false, help: "Short product name used on cards." },
  { key: "title", label: "Full title", group: "Product", multiple: false, help: "Long descriptive title. Defaults to the name." },
  { key: "category", label: "Category", group: "Product", multiple: true, help: "A path like “Latches > Compression Latches”, or one column per level." },
  { key: "family", label: "Family / series code", group: "Product", multiple: false, help: "Groups variants; enables the variants table." },
  { key: "familyName", label: "Family / series name", group: "Product", multiple: false, help: "Readable family name." },
  { key: "brand", label: "Brand", group: "Product", multiple: false, help: "Manufacturer or brand." },
  { key: "accessoryType", label: "Accessory type", group: "Product", multiple: false, help: "Filled in for accessories (Keys, Cams, Gaskets …)." },
  { key: "description", label: "Description", group: "Content", multiple: true, help: "Marketing text. Several columns are joined as paragraphs." },
  { key: "features", label: "Features", group: "Content", multiple: true, help: "Bullet points: one per line, or one column each." },
  { key: "image", label: "Images", group: "Media & files", multiple: true, help: "Image URLs (several per cell allowed)." },
  { key: "video", label: "Videos", group: "Media & files", multiple: true, help: "YouTube, Vimeo or MP4 links." },
  { key: "document", label: "Documents", group: "Media & files", multiple: true, help: "PDF, CAD and other file links; the column name becomes the label." },
  { key: "related", label: "Related products", group: "Relations", multiple: true, help: "Part numbers separated by commas, semicolons or new lines." },
  { key: "compatible", label: "Compatible products", group: "Relations", multiple: true, help: "Part numbers; optional groups like “Keys: A, B; Cams: C”." },
  { key: "price", label: "Price", group: "Commerce", multiple: false, help: "Unit price. Without prices the site works as a quote catalog." },
  { key: "currency", label: "Currency", group: "Commerce", multiple: false, help: "ISO code such as USD or EUR." },
  { key: "stock", label: "Availability / stock", group: "Commerce", multiple: false, help: "Quantity or text such as “In stock”." },
  { key: "certification", label: "Certifications", group: "Commerce", multiple: true, help: "A list (“RoHS, REACH”) or Yes/No columns named after the certificate." },
  { key: "featured", label: "Featured (Yes/No)", group: "Sorting", multiple: false, help: "Shown first and on the home page." },
  { key: "sortOrder", label: "Sort order (lower first)", group: "Sorting", multiple: false, help: "Position in the default order." },
  { key: "popularity", label: "Popularity (higher first)", group: "Sorting", multiple: false, help: "Drives “Most popular”." },
  { key: "added", label: "Date added", group: "Sorting", multiple: false, help: "Drives “Newest”." },
  { key: "spec", label: "Specification", group: "Other", multiple: true, help: "Shown in the spec table; becomes a filter when values repeat." },
  { key: "ignore", label: "Don’t import", group: "Other", multiple: true, help: "Column is skipped." },
];

export const FIELD_BY_KEY = new Map(FIELDS.map((f) => [f.key, f]));

/** Lower-case letters and digits only: "Item No." → "itemno". */
export function normalizeHeader(header: string): string {
  return header
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/* ------------------------------------------------------------- header parsing */

const LANGUAGE_CODES = new Set(["en", "de", "fr", "es", "it", "nl", "pt", "sv", "da", "fi", "pl", "cs", "hu", "ja", "zh", "ko", "ru", "tr"]);
const LANGUAGE_NAMES: Record<string, string> = {
  english: "en",
  german: "de",
  deutsch: "de",
  french: "fr",
  francais: "fr",
  spanish: "es",
  espanol: "es",
  italian: "it",
  dutch: "nl",
  portuguese: "pt",
  swedish: "sv",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
};

/** "Name (en)", "Name [en-US]", "Name_EN", "Name - English" → { base: "Name", language: "en" }. */
export function splitLanguage(header: string): { base: string; language: string | null } {
  const bracket = /^(.*?)[\s_-]*[([]\s*([a-z]{2})(?:[-_][a-z]{2})?\s*[)\]]\s*$/i.exec(header);
  if (bracket && LANGUAGE_CODES.has(bracket[2].toLowerCase())) return { base: bracket[1].trim(), language: bracket[2].toLowerCase() };
  const suffix = /^(.*?)[\s]*[_-]\s*([a-z]{2})(?:[-_][a-z]{2})?$/i.exec(header);
  if (suffix && suffix[1].trim() && LANGUAGE_CODES.has(suffix[2].toLowerCase()) && suffix[2] === suffix[2].toUpperCase()) {
    return { base: suffix[1].trim(), language: suffix[2].toLowerCase() };
  }
  const named = /^(.*?)\s*(?:[-–(|[]\s*)([a-z]+)\s*[)\]]?\s*$/i.exec(header);
  if (named && named[1].trim()) {
    const language = LANGUAGE_NAMES[normalizeHeader(named[2])];
    if (language) return { base: named[1].trim(), language };
  }
  return { base: header.trim(), language: null };
}

const UNITS = new Map<string, string>([
  ["mm", "mm"], ["cm", "cm"], ["m", "m"], ["in", "in"], ["inch", "in"], ["inches", "in"], ["ft", "ft"],
  ["kg", "kg"], ["g", "g"], ["lb", "lb"], ["lbs", "lb"], ["oz", "oz"],
  ["n", "N"], ["nm", "Nm"], ["kn", "kN"], ["lbf", "lbf"], ["inlb", "in-lb"], ["inlbs", "in-lb"],
  ["°c", "°C"], ["degc", "°C"], ["c", "°C"], ["°f", "°F"], ["degf", "°F"], ["f", "°F"],
  ["%", "%"], ["v", "V"], ["a", "A"], ["w", "W"], ["psi", "psi"], ["bar", "bar"], ["kpa", "kPa"], ["mpa", "MPa"],
  ["s", "s"], ["ms", "ms"], ["h", "h"], ["rpm", "rpm"], ["hz", "Hz"], ["db", "dB"], ["l", "l"], ["ml", "ml"], ["deg", "°"], ["°", "°"],
]);

/** "Weight (kg)", "Grip Min [mm]", "Length, mm" → { name: "Weight", unit: "kg" }. */
export function splitUnit(header: string): { name: string; unit: string | null } {
  const match = /^(.*?)\s*(?:[([]\s*([^()[\]]{1,8})\s*[)\]]|,\s*([^\s,]{1,6}))\s*$/.exec(header);
  if (match && match[1].trim()) {
    const unit = UNITS.get((match[2] ?? match[3] ?? "").trim().toLowerCase().replace(/\s+/g, ""));
    if (unit) return { name: match[1].trim(), unit };
  }
  return { name: header.trim(), unit: null };
}

/* ------------------------------------------------------------- auto mapping */

/** Exact header matches (normalized). The first fields win when a header fits several. */
const SYNONYMS: Array<[FieldKey, string[]]> = [
  ["sku", ["sku", "itemnumber", "itemno", "itemnum", "itemsku", "itemcode", "itemid", "partnumber", "partno", "partnum", "articlenumber", "articleno", "materialnumber", "catalognumber", "catalogno", "ordernumber", "ordercode", "mpn", "manufacturerpartnumber", "productsku"]],
  ["family", ["family", "familycode", "productfamily", "productfamilycode", "series", "seriescode", "productseries", "productnumber", "productno", "productid", "productcode", "parentproduct", "parentproductnumber", "parentsku", "basepart", "stylenumber"]],
  ["familyName", ["familyname", "productfamilyname", "seriesname", "productname", "parentproductname", "productlinename"]],
  ["name", ["name", "itemname", "shortname", "displayname", "itemdisplayname", "productdisplayname", "shortdescription", "itemshortdescription"]],
  ["title", ["title", "fullname", "longname", "itemtitle", "producttitle", "itemdescription", "fulldescription", "itemlongname", "commercialname"]],
  ["description", ["description", "longdescription", "productdescription", "marketingdescription", "marketingtext", "marketingcopy", "copy", "bodycopy", "overview", "summary", "details", "itemlongdescription", "webdescription"]],
  ["features", ["features", "feature", "keyfeatures", "featuresbenefits", "featuresandbenefits", "benefits", "bullets", "bulletpoints", "sellingpoints", "highlights", "usp", "usps"]],
  ["category", ["category", "categories", "categorypath", "productcategory", "itemcategory", "subcategory", "class", "classification", "productgroup", "productclass", "taxonomy", "navigation", "channelnode", "department", "categorylevel", "level"]],
  ["brand", ["brand", "brandname", "manufacturer", "manufacturername", "make"]],
  ["accessoryType", ["accessorytype", "accessorycategory", "accessorykind"]],
  ["image", ["image", "images", "imageurl", "imageurls", "imagelink", "mainimage", "primaryimage", "primaryimageurl", "mainimageurl", "productimage", "itemimage", "picture", "pictures", "photo", "photos", "thumbnail", "additionalimages", "media", "mediaurl", "resourceurl", "resourceurls", "assets", "gallery"]],
  ["video", ["video", "videos", "videourl", "videourls", "videolink", "productvideo", "youtube", "youtubeurl", "vimeo", "vimeourl"]],
  ["document", ["document", "documents", "documenturl", "datasheet", "datasheeturl", "specsheet", "specificationsheet", "techdatasheet", "pdf", "drawing", "drawings", "2ddrawing", "2dcad", "3dcad", "3dmodel", "cad", "cadmodel", "cadfile", "step", "stepfile", "brochure", "catalog", "catalogpage", "manual", "instructions", "installationinstructions", "installationguide", "certificate", "certificates", "declaration", "declarationofconformity", "sds", "msds", "performancedata", "testreport", "attachments"]],
  ["related", ["related", "relatedproducts", "relateditems", "relatedskus", "relatedparts", "similar", "similarproducts", "alternatives", "alternativeproducts", "crosssell", "crosssells", "upsell", "upsells", "seealso", "recommended"]],
  ["compatible", ["compatible", "compatibleproducts", "compatibleitems", "compatibleskus", "compatibleparts", "compatiblewith", "accessories", "accessoryskus", "accessoryparts", "fits", "fitswith", "workswith", "matingparts", "spareparts", "replacementparts", "optionalaccessories", "components"]],
  ["price", ["price", "listprice", "unitprice", "baseprice", "msrp", "rrp", "retailprice", "salesprice", "webprice", "priceusd", "priceeur", "pricegbp"]],
  ["currency", ["currency", "currencycode", "pricecurrency"]],
  ["stock", ["stock", "instock", "stockqty", "stockquantity", "stocklevel", "stockstatus", "availability", "available", "inventory", "inventoryqty", "quantityavailable", "qtyavailable", "onhand"]],
  ["certification", ["certifications", "certification", "approvals", "approval", "agencyapprovals", "compliance", "standards", "listings", "rohs", "reach", "ul", "csa", "ce", "ukca"]],
  ["featured", ["featured", "isfeatured", "featuredproduct", "bestseller", "topseller", "promoted", "highlight"]],
  ["sortOrder", ["sortorder", "sort", "sortindex", "sortkey", "sequence", "displayorder", "position", "rank", "ranking", "priority"]],
  ["popularity", ["popularity", "popular", "salesrank", "sales", "views", "pageviews", "score"]],
  ["added", ["dateadded", "added", "launchdate", "introductiondate", "releasedate", "availablefrom", "publishdate", "createddate", "newsince"]],
];

/** inRiver / PIM system columns that never carry product content. */
const SYSTEM = new Set([
  "sysid", "sysentityid", "entityid", "entitytypeid", "id", "guid", "uuid", "uid", "fieldsetid", "fieldset", "segment", "segmentid",
  "createdby", "modifiedby", "lastmodified", "lastmodifiedby", "modified", "modifieddate", "datecreated", "created", "version", "locked", "lockedby",
  "completeness", "mainpicturefileid", "resourcefileid", "channelid", "entitystatus", "workflowstatus", "rowid",
]);

/** SEO fields are page metadata, not product content (they would otherwise become specifications and filters). */
const SEO = /^(meta|seo)(title|description|keywords?|tags?)$/;

/** Raw versioned PIM field ids without a display name ("MaterialFamilyV2") hold internal codes. */
const INTERNAL_FIELD = /^[A-Za-z]*[a-z]V\d+$/;

const IMAGE_URL = /\.(jpe?g|png|webp|gif|avif|svg|tiff?|bmp)(\?|#|$)/i;
const VIDEO_URL = /(youtube\.com|youtu\.be|vimeo\.com|\.mp4(\?|$)|\.webm(\?|$)|\.mov(\?|$))/i;
const DOCUMENT_URL = /\.(pdf|stp|step|igs|iges|dwg|dxf|zip|sldprt|sldasm|x_t|x_b|stl|edrw|eprt|easm|docx?|xlsx?)(\?|#|$)/i;

export interface ColumnInfo {
  index: number;
  header: string;
  /** normalizeHeader(header) */
  key: string;
  /** Header without a language suffix. */
  base: string;
  language: string | null;
  /** Up to 8 distinct non-empty example values (the mapping table shows the first 3). */
  samples: string[];
  filled: number;
  distinct: number;
}

/** Index of the most likely header row in the first rows of a sheet. */
export function detectHeaderRow(rows: string[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let r = 0; r < Math.min(rows.length, 20); r++) {
    const cells = rows[r].filter(Boolean);
    if (cells.length < 2) continue;
    const textual = cells.filter((c) => !/^-?[\d.,]+$/.test(c) && c.length <= 80).length;
    const unique = new Set(cells.map((c) => c.toLowerCase())).size;
    const score = textual * 2 + unique - (cells.length - textual) * 3;
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best;
}

export function analyzeColumns(rows: string[][], headerRow: number): ColumnInfo[] {
  const header = rows[headerRow] ?? [];
  const data = rows.slice(headerRow + 1);
  const width = Math.max(header.length, ...data.slice(0, 50).map((r) => r.length));
  const columns: ColumnInfo[] = [];
  for (let c = 0; c < width; c++) {
    const raw = (header[c] ?? "").replace(/\s+/g, " ").trim() || `Column ${columnLetter(c)}`;
    const { base, language } = splitLanguage(raw);
    const values: string[] = [];
    for (const row of data) {
      // Placeholders such as "N/A" or "-" do not count as content.
      const value = clean(row[c]);
      if (value) values.push(value);
    }
    const distinct = new Set(values);
    columns.push({
      index: c,
      header: raw,
      key: normalizeHeader(raw),
      base,
      language,
      samples: Array.from(distinct).slice(0, 8),
      filled: values.length,
      distinct: distinct.size,
    });
  }
  return columns;
}

/** Keys for remembering choices: the normalized header, numbered when a header repeats ("image", "image#2"). */
export function columnKeys(columns: ColumnInfo[]): string[] {
  const seen = new Map<string, number>();
  return columns.map((col) => {
    const n = (seen.get(col.key) ?? 0) + 1;
    seen.set(col.key, n);
    return n === 1 ? col.key : `${col.key}#${n}`;
  });
}

/** What to remember for the next import: the choice for every column that had data. */
export function mappingToSave(columns: ColumnInfo[], mapping: FieldKey[]): Record<string, FieldKey> {
  const keys = columnKeys(columns);
  const saved: Record<string, FieldKey> = {};
  columns.forEach((col, i) => {
    if (col.filled > 0) saved[keys[i]] = mapping[i] ?? "ignore";
  });
  return saved;
}

export function columnLetter(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

const share = (values: string[], test: RegExp) => (values.length ? values.filter((v) => test.test(v)).length / values.length : 0);

/** Values that are or contain links ("Datasheet | https://…"), or look like file names. */
const URL_LIKE = /https?:\/\/|^\/\/|\.[a-z0-9]{2,5}(\?|#|$)/i;
const HAS_LINK = /https?:\/\//i;
/** Sentences, line breaks or HTML: a description, not a long title such as "Rotary Latch, Medium Size, Single Stage, …". */
const PROSE = /[.!?]\s+[A-Z]|\n|<\/?[a-z][^>]*>/;
const average = (values: string[]) => (values.length ? values.reduce((n, v) => n + v.length, 0) / values.length : 0);

/** Field suggested by the header: exact synonym, then without a number ("Image 2" → image), then loose media/relation words. */
function headerField(col: ColumnInfo): FieldKey | null {
  const key = normalizeHeader(splitUnit(col.base).name);
  const candidates = [key, key.replace(/\d+$/, ""), key.replace(/^(main|primary|additional|extra|secondary|default)/, "")];
  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const [field, words] of SYNONYMS) if (words.includes(candidate)) return field;
  }
  if (/^(list|unit|base|net|retail|web|sales)?price(usd|eur|gbp|cad|aud|inr|cny|jpy)?$/.test(key)) return "price";
  if (/^compatible|^accessor(y|ies)(sku|part|item)|^matingpart/.test(key)) return "compatible";
  if (/^related|^similar|^alternative/.test(key)) return "related";
  // Loose media words only when the values really are links or file names ("Cadmium free" is not a CAD file).
  if (share(col.samples, URL_LIKE) < 0.6) return null;
  if (/image|picture|photo/.test(key)) return "image";
  if (/video|youtube|vimeo/.test(key)) return "video";
  if (/datasheet|drawing|cad|pdf|brochure|manual|instruction|certificate|declaration|document/.test(key)) return "document";
  return null;
}

/**
 * Suggested field for every column. `saved` (normalized header → field) from the previous
 * import wins, so a re-import of the same export needs no manual mapping.
 */
export function autoMap(columns: ColumnInfo[], saved: Record<string, string> = {}): FieldKey[] {
  const result: FieldKey[] = columns.map(() => "ignore");
  const taken = new Set<FieldKey>();
  const valid = (f: string | undefined): f is FieldKey => !!f && FIELD_BY_KEY.has(f as FieldKey);
  const assign = (i: number, field: FieldKey) => {
    result[i] = field;
    taken.add(field);
  };

  // Languages: keep English (or the first variant) of each localized column.
  const preferred = new Map<string, number>();
  for (const col of columns) {
    if (!col.language || !col.filled) continue;
    const key = normalizeHeader(col.base);
    const current = preferred.get(key);
    if (current === undefined || (col.language === "en" && columns[current].language !== "en")) preferred.set(key, col.index);
  }
  const skip = (col: ColumnInfo) =>
    !col.filled ||
    SYSTEM.has(col.key) ||
    SEO.test(col.key) ||
    INTERNAL_FIELD.test(col.header) ||
    (col.language !== null && preferred.get(normalizeHeader(col.base)) !== col.index);

  // 1. Choices from the previous import.
  const keys = columnKeys(columns);
  const remembered = new Set<number>();
  columns.forEach((_, i) => {
    const field = saved[keys[i]];
    if (!valid(field) || (!FIELD_BY_KEY.get(field)?.multiple && taken.has(field))) return;
    assign(i, field);
    remembered.add(i);
  });

  // 2. Header names. Single-value fields are used once; a second "number" column becomes the family.
  columns.forEach((col, i) => {
    if (remembered.has(i) || skip(col)) return;
    let field = headerField(col);
    if (!field) return;
    // Long names stay names unless they read like a description (Southco item names run to 200+ characters).
    if ((field === "name" || field === "title") && (average(col.samples) > 300 || (average(col.samples) > 160 && share(col.samples, PROSE) >= 0.5))) {
      field = "description";
    }
    if (field === "sku" && (taken.has("sku") || col.distinct < col.filled * 0.5)) field = "family";
    if (!FIELD_BY_KEY.get(field)?.multiple && taken.has(field)) return;
    assign(i, field);
  });

  // Rows that are products themselves (no separate item name): "Product Name" is the name.
  if (!taken.has("name") && !taken.has("title")) {
    const familyName = result.indexOf("familyName");
    if (familyName >= 0) assign(familyName, "name");
  }

  // 3. Content: links reveal images, videos and documents; long text is a description; the rest are specifications.
  columns.forEach((col, i) => {
    if (result[i] !== "ignore" || remembered.has(i) || skip(col)) return;
    const values = col.samples;
    if (share(values, IMAGE_URL) >= 0.6) assign(i, "image");
    else if (share(values, VIDEO_URL) >= 0.6) assign(i, "video");
    else if (share(values, DOCUMENT_URL) >= 0.6 || share(values, HAS_LINK) >= 0.6) assign(i, "document");
    else if (average(values) > 200) assign(i, taken.has("description") ? "ignore" : "description");
    else assign(i, "spec");
  });

  // 4. No SKU header: the first column whose values are all different.
  if (!taken.has("sku")) {
    const candidate = columns.findIndex((col, i) => col.filled > 0 && col.distinct === col.filled && (result[i] === "spec" || result[i] === "family"));
    if (candidate >= 0) result[candidate] = "sku";
  }
  return result;
}

/** True when a column header names a part number (used to pick the right sheet of a workbook). */
export function hasSkuColumn(columns: ColumnInfo[]): boolean {
  return columns.some((col) => col.filled > 0 && headerField(col) === "sku");
}
