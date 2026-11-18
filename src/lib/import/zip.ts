import { ImportFileError } from "./sheet-types";

/**
 * Minimal ZIP reader for .xlsx packages: reads the central directory and inflates
 * entries with the platform's DecompressionStream (browsers and Node 18+), so no
 * library is needed.
 */

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  offset: number;
}

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u32 = (b: Uint8Array, o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

const NOT_A_WORKBOOK = "This file is not a valid Excel workbook. Open it in Excel and save it again as .xlsx.";

/** Entries by lower-case name. */
export function listZipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  // End-of-central-directory record: in the last 22 bytes plus an optional comment (≤ 64 KB).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ImportFileError(NOT_A_WORKBOOK);

  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const entries = new Map<string, ZipEntry>();
  const decoder = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== 0x02014b50) throw new ImportFileError(NOT_A_WORKBOOK);
    const flags = u16(bytes, p + 8);
    const method = u16(bytes, p + 10);
    const compressedSize = u32(bytes, p + 20);
    const nameLength = u16(bytes, p + 28);
    const extraLength = u16(bytes, p + 30);
    const commentLength = u16(bytes, p + 32);
    const offset = u32(bytes, p + 42);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLength));
    if (flags & 1) {
      throw new ImportFileError("This workbook is password-protected. Remove the password in Excel (File › Info › Protect Workbook), save, and import again.");
    }
    if (compressedSize === 0xffffffff || offset === 0xffffffff) throw new ImportFileError("This workbook is too large to import.");
    entries.set(name.toLowerCase(), { name, method, compressedSize, offset });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const p = entry.offset;
  if (p + 30 > bytes.length || u32(bytes, p) !== 0x04034b50) throw new ImportFileError(NOT_A_WORKBOOK);
  const start = p + 30 + u16(bytes, p + 26) + u16(bytes, p + 28);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new ImportFileError(`Unsupported compression in ${entry.name}. Save the file again in Excel.`);
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
