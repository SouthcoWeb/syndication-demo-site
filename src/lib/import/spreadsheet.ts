import { readCsv } from "./csv";
import { ImportFileError, type WorkbookData } from "./sheet-types";
import { readXlsx } from "./xlsx";

/**
 * Spreadsheet reading for the import page. Runs in the browser (and in Node for tests):
 * the Excel file never leaves the admin's machine; only the mapped products are published.
 */

export { ImportFileError, type SheetData, type WorkbookData } from "./sheet-types";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function readSpreadsheet(fileName: string, bytes: Uint8Array): Promise<WorkbookData> {
  if (bytes.length > MAX_FILE_BYTES) {
    throw new ImportFileError("This file is larger than 25 MB. Export only the columns the website needs and try again.");
  }
  // "PK": every .xlsx is a ZIP package.
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes);
  // OLE2 compound file: the old binary .xls format.
  if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new ImportFileError("This is an Excel 97–2003 (.xls) file. Open it in Excel, choose File › Save As › Excel Workbook (.xlsx), then import that file.");
  }
  if (/\.(csv|tsv|txt)$/i.test(fileName)) return readCsv(bytes, fileName);
  if (/\.xls[xm]?$/i.test(fileName)) throw new ImportFileError("This file is not a valid Excel workbook. Open it in Excel and save it again as .xlsx.");
  throw new ImportFileError("Unsupported file type. Use an Excel workbook (.xlsx) or a CSV file.");
}
