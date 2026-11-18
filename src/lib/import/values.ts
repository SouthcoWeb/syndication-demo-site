import type { DocumentType, ProductVideo, StockStatus } from "../types";
import { decodeEntities } from "./xml";

/** Cell-value parsing for the import: text clean-up, yes/no, lists, links, media, prices and stock. */

const PLACEHOLDER = /^(n\/?a|none|null|nil|-+|—|–|\?|#n\/a|tbd|tba|not applicable)$/i;

/** Collapses spaces, unifies line breaks and drops placeholders like "N/A" or "-". */
export function clean(value: string | undefined): string {
  const text = (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
  return PLACEHOLDER.test(text) ? "" : text;
}

const YES = /^(y|yes|true|1|x|✓|✔|ja|oui|si|sí|compliant|certified|approved|featured)$/i;
const NO = /^(n|no|false|0|nein|non|not compliant|non[- ]?compliant|not certified|not approved)$/i;
export const isYes = (value: string) => YES.test(value.trim());
export const isNo = (value: string) => NO.test(value.trim());

const unique = (items: string[]) => Array.from(new Set(items));

/** "A, B; C | D" or one per line → ["A", "B", "C", "D"]. */
export function splitList(value: string): string[] {
  return unique(
    value
      .split(/[\n;|,]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

/** Rich text from PIM fields → plain text with paragraphs and "• " bullets (never rendered as HTML). */
export function htmlToText(value: string): string {
  if (!/<\/?[a-z][^>]*>/i.test(value)) return decodeEntities(value);
  const text = decodeEntities(
    value
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<(ul|ol)[^>]*>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n\n• ")
      .replace(/<\/(p|div|h[1-6]|ul|ol|tr|table|section|blockquote)>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  // Paragraphs are separated by a blank line; bullets of one list stay together on consecutive lines.
  const blocks: string[] = [];
  for (const block of text.split(/\n{2,}/)) {
    const previous = blocks[blocks.length - 1];
    if (previous?.split("\n").pop()?.startsWith("• ") && block.startsWith("• ")) blocks[blocks.length - 1] = `${previous}\n${block}`;
    else blocks.push(block);
  }
  return blocks.join("\n\n");
}

/** Feature bullets: one per line (HTML lists included), else "•" or ";" separated. */
export function splitBullets(value: string): string[] {
  const text = htmlToText(value);
  let items = text.split(/\n+|\s*[•▪●◦]\s*/);
  if (items.filter((s) => s.trim()).length <= 1 && text.includes(";")) items = text.split(";");
  return unique(items.map((s) => s.replace(/^[-*–·\s]+/, "").trim()).filter((s) => s.length > 1));
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * Links in a cell, in order: full URLs, protocol-relative URLs, and — when `base` is set —
 * bare file names or relative paths (inRiver resource exports often list file names only).
 */
export function extractUrls(value: string, base = ""): string[] {
  const out: string[] = [];
  for (const raw of value.split(/[\s;|]+|,(?=\s*(?:https?:)?\/\/)/)) {
    const token = raw.replace(/^["'<([]+|[>"')\],.]+$/g, "");
    if (/^https?:\/\/\S+\.\S+/i.test(token)) out.push(token);
    else if (/^\/\/\S+\.\S+/.test(token)) out.push(`https:${token}`);
    else if (base && /^[\w./%-]+\.[a-z0-9]{2,5}$/i.test(token)) out.push(joinUrl(base, token));
  }
  return unique(out);
}

/** "Datasheet: https://…" or "Datasheet | https://…" lines → labelled links. */
export function extractLabelledLinks(value: string, base = ""): Array<{ label: string; url: string }> {
  const out: Array<{ label: string; url: string }> = [];
  for (const line of value.split("\n")) {
    const urls = extractUrls(line, base);
    if (!urls.length) continue;
    const first = line.search(/https?:\/\/|\/\//);
    const label = first > 0 ? line.slice(0, first).replace(/[\s:|–—-]+$/, "").trim() : "";
    for (const url of urls) out.push({ label: label.length <= 80 ? label : "", url });
  }
  return out;
}

/** YouTube, Vimeo or a video file; null for anything else. */
export function parseVideo(url: string, title: string): ProductVideo | null {
  const youtube = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/i.exec(url);
  if (youtube) return { provider: "youtube", id: youtube[1], title };
  let parsed: URL | null = null;
  try {
    parsed = new URL(url);
  } catch {
    /* not a URL */
  }
  if (parsed && /(^|\.)vimeo\.com$/i.test(parsed.hostname)) {
    // vimeo.com/123, vimeo.com/123/abc0hash (unlisted), player.vimeo.com/video/123?h=abc0hash,
    // vimeo.com/channels/name/123, vimeo.com/showcase/456/video/123
    const parts = parsed.pathname.split("/").filter(Boolean);
    const afterVideo = parts.indexOf("video");
    const index = afterVideo >= 0 ? afterVideo + 1 : parts.findIndex((part) => /^\d{5,}$/.test(part));
    const id = parts[index];
    if (id && /^\d{5,}$/.test(id)) {
      const next = parts[index + 1];
      const hash = parsed.searchParams.get("h") ?? (next && /^[0-9a-f]{6,}$/i.test(next) ? next : undefined);
      return { provider: "vimeo", id, ...(hash ? { hash } : {}), title };
    }
  }
  if (/\.(mp4|webm|m4v|mov)(\?|#|$)/i.test(url)) return { provider: "file", id: url, title };
  return null;
}

export function documentType(label: string, url: string): DocumentType {
  const text = `${label} ${url}`.toLowerCase();
  if (/\.(stp|step|igs|iges|sldprt|sldasm|x_t|x_b|stl|dwg|dxf|edrw|eprt|easm)(\?|#|$)/.test(text) || /\b(cad|3d|step|model|igs|iges)\b/.test(text)) return "cad";
  if (/drawing|\b2d\b|dimension/.test(text)) return "drawing";
  if (/certificate|declaration|conformity|rohs|reach|compliance|\bul\b|\bce\b|ukca/.test(text)) return "certificate";
  if (/data ?sheet|spec(ification)? ?sheet|performance|test (report|data)|technical data/.test(text)) return "datasheet";
  if (/catalog|catalogue|brochure|flyer|leaflet/.test(text)) return "catalog";
  if (/manual|instruction|installation|guide|assembly/.test(text)) return "manual";
  return "other";
}

const FORMATS: Record<string, string> = {
  pdf: "PDF",
  stp: "STEP",
  step: "STEP",
  igs: "IGES",
  iges: "IGES",
  dwg: "DWG",
  dxf: "DXF",
  zip: "ZIP",
  sldprt: "SOLIDWORKS",
  sldasm: "SOLIDWORKS",
  x_t: "Parasolid",
  x_b: "Parasolid",
  stl: "STL",
  doc: "Word",
  docx: "Word",
  xls: "Excel",
  xlsx: "Excel",
  jpg: "Image",
  jpeg: "Image",
  png: "Image",
};

export function documentFormat(url: string): string {
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    /* keep the raw value */
  }
  const ext = /\.([a-z0-9_]{2,6})$/i.exec(pathname)?.[1]?.toLowerCase();
  return ext ? (FORMATS[ext] ?? ext.toUpperCase()) : "Link";
}

const CURRENCY_SIGNS: Array<[RegExp, string]> = [
  [/€|\beur\b/i, "EUR"],
  [/£|\bgbp\b/i, "GBP"],
  [/₹|\binr\b/i, "INR"],
  [/\bcny\b|\brmb\b/i, "CNY"],
  [/¥|\bjpy\b/i, "JPY"],
  [/\bcad\b|c\$/i, "CAD"],
  [/\baud\b|a\$/i, "AUD"],
  [/\$|\busd\b/i, "USD"],
];

/** "$1,234.50", "1.234,50 €", "12,5", "POA" → amount (null when not a number) and the currency it mentions. */
export function parsePrice(value: string): { amount: number | null; currency: string | null } {
  const text = value.trim();
  if (!text) return { amount: null, currency: null };
  const currency = CURRENCY_SIGNS.find(([re]) => re.test(text))?.[1] ?? null;
  let digits = text.replace(/[^\d.,-]/g, "");
  if (/,\d{1,2}$/.test(digits) && !/\.\d{1,2}$/.test(digits)) digits = digits.replace(/\./g, "").replace(",", ".");
  else digits = digits.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(digits)) return { amount: null, currency };
  const amount = Number(digits);
  return { amount: Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 10000) / 10000 : null, currency };
}

export const LOW_STOCK_AT = 10;

/** Quantity ("250", "1,200") or text ("In stock", "Out of stock", "Limited") → status + quantity. */
export function parseStock(value: string): { status: StockStatus; quantity: number | null } {
  const text = value.trim();
  if (!text) return { status: "unknown", quantity: null };
  if (/^\d[\d,\s]*$/.test(text)) {
    const quantity = Number(text.replace(/[,\s]/g, ""));
    if (Number.isFinite(quantity)) {
      return { status: quantity <= 0 ? "out_of_stock" : quantity <= LOW_STOCK_AT ? "low_stock" : "in_stock", quantity };
    }
  }
  const lower = text.toLowerCase();
  if (/out of stock|not available|unavailable|sold out|discontinued|back ?order|^(no|n|false)$/.test(lower)) return { status: "out_of_stock", quantity: null };
  if (/low|limited|few left/.test(lower)) return { status: "low_stock", quantity: null };
  if (/in stock|available|^(yes|y|true)$|ships/.test(lower)) return { status: "in_stock", quantity: null };
  return { status: "unknown", quantity: null };
}

/** Dates ("2026-10-09", "10/09/2026", Excel-converted text) or plain numbers → a sortable number. */
export function parseSortableDate(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) return Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}
