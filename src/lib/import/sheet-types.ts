/** Parsed spreadsheet shapes shared by the .xlsx and CSV readers. */

export interface SheetData {
  name: string;
  hidden: boolean;
  /** Dense rows of cell text ("" for empty cells). Numbers and dates are converted to text. */
  rows: string[][];
  /** Hyperlink targets by "row:column" (0-based), for cells whose text is not the link itself. */
  links: Record<string, string>;
}

export interface WorkbookData {
  sheets: SheetData[];
}

/** A problem with the file itself, worded for the person importing it. */
export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}
