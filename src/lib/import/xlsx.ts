import { ImportFileError, type SheetData, type WorkbookData } from "./sheet-types";
import { childElements, descendants, firstChild, parseXml, textContent, type XmlElement } from "./xml";
import { listZipEntries, readZipEntry, type ZipEntry } from "./zip";

/**
 * Reads an Excel workbook (.xlsx / .xlsm) into rows of cell text: shared and inline
 * strings, rich text, numbers, booleans, formula results, dates (via cell styles)
 * and hyperlinks. Formatting, images and charts are ignored.
 */

const SKIP_PHONETIC = new Set(["rPh", "phoneticPr"]);

/** Excel encodes some characters as _xHHHH_ (e.g. _x000D_ for a carriage return). */
const decodeEscapes = (text: string) => text.replace(/_x([0-9a-fA-F]{4})_/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/** Built-in number formats that show dates or times. */
const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

function isDateFormat(code: string): boolean {
  const cleaned = code
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\./g, "");
  return /[yd]/i.test(cleaned) || /h+:m+|m+:s+/i.test(cleaned);
}

/** Indexes of cell styles (`s` attribute) that format numbers as dates. */
function dateStyles(xml: string | null): Set<number> {
  const styles = new Set<number>();
  if (!xml) return styles;
  const root = parseXml(xml);
  const custom = new Map<number, string>();
  for (const fmt of descendants(root, "numFmt")) custom.set(Number(fmt.attrs.numFmtId), fmt.attrs.formatCode ?? "");
  const cellXfs = descendants(root, "cellXfs")[0];
  if (!cellXfs) return styles;
  childElements(cellXfs, "xf").forEach((xf, index) => {
    const id = Number(xf.attrs.numFmtId ?? 0);
    if (BUILTIN_DATE_FORMATS.has(id) || (custom.has(id) && isDateFormat(custom.get(id) ?? ""))) styles.add(index);
  });
  return styles;
}

function excelDate(serial: number, date1904: boolean): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const date = new Date(epoch + Math.round(serial * 86400000));
  if (Number.isNaN(date.getTime())) return String(serial);
  const iso = date.toISOString();
  const time = iso.slice(11, 16);
  return time === "00:00" ? iso.slice(0, 10) : `${iso.slice(0, 10)} ${time}`;
}

/** Cleans binary floating-point noise (1.1000000000000001 → "1.1"). */
const numberText = (value: number) => String(Number(value.toPrecision(15)));

/** "AB12" → { row: 11, col: 27 } (0-based). */
function parseRef(ref: string): { row: number; col: number } | null {
  const match = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(ref);
  if (!match) return null;
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(match[2]) - 1, col: col - 1 };
}

function sharedStrings(xml: string | null): string[] {
  if (!xml) return [];
  return descendants(parseXml(xml), "si").map((si) => decodeEscapes(textContent(si, SKIP_PHONETIC)));
}

/** Relationship id → package path (or external URL), resolved against `base` (e.g. "xl/"). */
function relationships(xml: string | null, base: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!xml) return map;
  for (const rel of descendants(parseXml(xml), "Relationship")) {
    const target = rel.attrs.Target ?? "";
    if (rel.attrs.TargetMode === "External") map.set(rel.attrs.Id, target);
    else map.set(rel.attrs.Id, resolvePath(base, target));
  }
  return map;
}

function resolvePath(base: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = (base + target).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}

function cellText(cell: XmlElement, shared: string[], dates: Set<number>, date1904: boolean): string {
  const type = cell.attrs.t;
  if (type === "inlineStr") {
    const inline = firstChild(cell, "is");
    return inline ? decodeEscapes(textContent(inline, SKIP_PHONETIC)) : "";
  }
  const v = firstChild(cell, "v");
  const raw = v ? textContent(v) : "";
  switch (type) {
    case "s":
      return shared[Number(raw)] ?? "";
    case "str":
      return decodeEscapes(raw);
    case "b":
      return raw === "1" ? "TRUE" : raw === "0" ? "FALSE" : raw;
    case "e":
      return ""; // #N/A, #REF! … carry no product data
    case "d":
      return raw.length > 10 && raw.endsWith("T00:00:00") ? raw.slice(0, 10) : raw;
    default: {
      if (raw === "") return "";
      const value = Number(raw);
      if (!Number.isFinite(value)) return raw;
      return dates.has(Number(cell.attrs.s ?? 0)) ? excelDate(value, date1904) : numberText(value);
    }
  }
}

function readSheet(
  name: string,
  hidden: boolean,
  xml: string,
  shared: string[],
  dates: Set<number>,
  date1904: boolean,
  sheetRels: Map<string, string>,
): SheetData {
  const root = parseXml(xml);
  const cells: string[][] = [];
  let width = 0;
  let nextRow = 0;
  for (const row of descendants(root, "row")) {
    const rowIndex = row.attrs.r ? Number(row.attrs.r) - 1 : nextRow;
    nextRow = rowIndex + 1;
    let nextCol = 0;
    for (const cell of childElements(row, "c")) {
      const ref = cell.attrs.r ? parseRef(cell.attrs.r) : null;
      const col = ref ? ref.col : nextCol;
      nextCol = col + 1;
      // Excel stores line breaks typed with Alt+Enter as CR LF (_x000D_ + newline).
      const value = cellText(cell, shared, dates, date1904).replace(/\r\n?/g, "\n").trim();
      if (!value) continue;
      (cells[rowIndex] ??= [])[col] = value;
      if (col + 1 > width) width = col + 1;
    }
  }

  const links: Record<string, string> = {};
  for (const link of descendants(root, "hyperlink")) {
    const target = sheetRels.get(link.attrs["r:id"] ?? link.attrs.id ?? "");
    if (!target || !/^https?:\/\//i.test(target)) continue;
    const [from, to = from] = (link.attrs.ref ?? "").split(":");
    const a = parseRef(from);
    const b = parseRef(to);
    if (!a || !b) continue;
    for (let r = a.row; r <= b.row && r - a.row < 10000; r++) {
      for (let c = a.col; c <= b.col && c - a.col < 500; c++) links[`${r}:${c}`] = target;
    }
  }

  // Dense rows, trailing empty rows removed.
  let last = cells.length - 1;
  while (last >= 0 && !cells[last]?.some(Boolean)) last--;
  const rows: string[][] = [];
  for (let r = 0; r <= last; r++) {
    const source = cells[r] ?? [];
    const row = new Array<string>(width);
    for (let c = 0; c < width; c++) row[c] = source[c] ?? "";
    rows.push(row);
  }
  return { name, hidden, rows, links };
}

export async function readXlsx(bytes: Uint8Array): Promise<WorkbookData> {
  const entries = listZipEntries(bytes);
  const decoder = new TextDecoder();
  const read = async (path: string): Promise<string | null> => {
    const entry: ZipEntry | undefined = entries.get(path.toLowerCase());
    return entry ? decoder.decode(await readZipEntry(bytes, entry)) : null;
  };

  const workbookXml = await read("xl/workbook.xml");
  if (!workbookXml) throw new ImportFileError("No worksheets found. Is this an Excel workbook (.xlsx)?");
  const workbook = parseXml(workbookXml);
  const date1904 = ["1", "true"].includes(descendants(workbook, "workbookPr")[0]?.attrs.date1904 ?? "");
  const rels = relationships(await read("xl/_rels/workbook.xml.rels"), "xl/");
  const shared = sharedStrings(await read("xl/sharedStrings.xml"));
  const dates = dateStyles(await read("xl/styles.xml"));

  const sheets: SheetData[] = [];
  for (const sheet of descendants(workbook, "sheet")) {
    const target = rels.get(sheet.attrs["r:id"] ?? sheet.attrs.id ?? "");
    if (!target) continue;
    const xml = await read(target);
    if (!xml) continue;
    const slash = target.lastIndexOf("/");
    const relsPath = `${target.slice(0, slash + 1)}_rels/${target.slice(slash + 1)}.rels`;
    const sheetRels = relationships(await read(relsPath), target.slice(0, slash + 1));
    const hidden = sheet.attrs.state === "hidden" || sheet.attrs.state === "veryHidden";
    sheets.push(readSheet(sheet.attrs.name ?? `Sheet${sheets.length + 1}`, hidden, xml, shared, dates, date1904, sheetRels));
  }
  if (!sheets.length) throw new ImportFileError("No worksheets found in this workbook.");
  return { sheets };
}
