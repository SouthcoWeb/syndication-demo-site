import type { WorkbookData } from "./sheet-types";

/** CSV / TSV reader: UTF-8 (with or without BOM), UTF-16 (Excel "Unicode Text") or Windows-1252. */

function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    // "CSV (Comma delimited)" saved by Excel on Windows uses the ANSI code page.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** The delimiter used most on the first line (outside quotes). */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ",";
}

export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function readCsv(bytes: Uint8Array, fileName: string): WorkbookData {
  const text = decode(bytes);
  const delimiter = /\.tsv$/i.test(fileName) ? "\t" : detectDelimiter(text);
  const parsed = parseDelimited(text, delimiter).map((r) => r.map((cell) => cell.trim()));
  while (parsed.length && !parsed[parsed.length - 1].some(Boolean)) parsed.pop();
  const width = parsed.reduce((max, r) => Math.max(max, r.length), 0);
  const rows = parsed.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ""));
  const name = fileName.replace(/\.[^.]+$/, "") || "Sheet1";
  return { sheets: [{ name, hidden: false, rows, links: {} }] };
}
