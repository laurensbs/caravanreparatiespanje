import * as XLSX from "xlsx";
import { createHash } from "crypto";

/**
 * Workbook column layouts per sheet type.
 *
 * Standard sheets (Sheet1, cruillas, peratallada, sant climent,
 *   Plan for when im in england, Sheet2):
 *   Col A=location, B=bay_ref, C=customer, D=internal_id,
 *   E=registration, F=issue, G=notes, H=status, I=extra
 *
 * Trailers sale:
 *   Col A=boolean_flag, B=ref_code, C=customer, D=description,
 *   E=id_or_reg, F=empty, G=empty, H=status, I=extra
 */

/** Sheets to skip entirely during import */
const SKIP_SHEETS = new Set(["Dashboard"]);

/** The "trailers sale" sheet has a different column mapping */
const TRAILER_SALE_SHEET = "trailers sale";

export type SheetCategory =
  | "workshop"       // peratallada, sant climent, cruillas
  | "planning"       // Plan for when im in england
  | "contact_queue"  // Sheet2 (contact confirmation queue)
  | "trailer_sales"  // trailers sale
  | "legacy";        // Sheet1 (master/staging)

export interface ParsedRow {
  sourceSheet: string;
  sourceRowNumber: number;
  originalCells: (string | number | boolean | null)[];
  originalJoinedText: string;
  fingerprint: string;
  rowClass: "record" | "header" | "divider" | "empty" | "unknown";

  // Mapped column values
  mappedLocation: string | null;
  mappedBayRef: string | null;
  mappedCustomer: string | null;
  mappedInternalId: string | null;
  mappedRegistration: string | null;
  mappedIssue: string | null;
  mappedNotes: string | null;
  mappedStatus: string | null;
  mappedExtra: string | null;
}

export interface ParsedSheet {
  sheetName: string;
  category: SheetCategory;
  rows: ParsedRow[];
}

export interface ParsedWorkbook {
  filename: string;
  sheets: ParsedSheet[];
  totalRows: number;
  skippedSheets: string[];
}

/**
 * Determine the operational category for a sheet name.
 */
export function getSheetCategory(sheetName: string): SheetCategory {
  const lower = sheetName.toLowerCase().trim();
  if (lower === "sheet1") return "legacy";
  if (lower === "sheet2") return "contact_queue";
  if (lower === TRAILER_SALE_SHEET) return "trailer_sales";
  if (lower.includes("england") || lower.includes("plan for"))
    return "planning";
  // cruillas, peratallada, sant climent → workshop
  if (
    lower === "cruillas" ||
    lower === "peratallada" ||
    lower === "sant climent"
  )
    return "workshop";
  // Fallback for unknown sheets
  return "workshop";
}

/**
 * Classify a row based on its cell contents.
 */
function classifyRow(
  cells: (string | number | boolean | null)[]
): "record" | "header" | "divider" | "empty" | "unknown" {
  const nonEmpty = cells.filter(
    (c) => c !== null && c !== undefined && String(c).trim() !== ""
  );
  if (nonEmpty.length === 0) return "empty";

  // Check for header-like content
  const joined = nonEmpty.map((c) => String(c).toLowerCase()).join(" ");
  if (
    joined.includes("status") &&
    (joined.includes("location") ||
      joined.includes("customer") ||
      joined.includes("bay"))
  )
    return "header";

  // Divider rows (often just dashes, lines, or section labels in 1 cell)
  if (nonEmpty.length === 1 && String(nonEmpty[0]).length < 5) return "divider";

  if (nonEmpty.length < 2) return "unknown";
  return "record";
}

/**
 * SHA-256 fingerprint of the joined text for dedupe.
 */
function computeFingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Normalize a cell value to a consistent string/number/boolean/null.
 */
function normalizeCell(
  cell: XLSX.CellObject | undefined
): string | number | boolean | null {
  if (!cell || cell.v === undefined || cell.v === null) return null;
  if (typeof cell.v === "boolean") return cell.v;
  if (typeof cell.v === "number") return cell.v;
  const s = String(cell.v).trim();
  return s === "" ? null : s;
}

/**
 * Map columns for the standard 9-column layout.
 */
function mapStandardRow(cells: (string | number | boolean | null)[]) {
  return {
    mappedLocation: cells[0] != null ? String(cells[0]) : null,
    mappedBayRef: cells[1] != null ? String(cells[1]) : null,
    mappedCustomer: cells[2] != null ? String(cells[2]) : null,
    mappedInternalId: cells[3] != null ? String(cells[3]) : null,
    mappedRegistration: cells[4] != null ? String(cells[4]) : null,
    mappedIssue: cells[5] != null ? String(cells[5]) : null,
    mappedNotes: cells[6] != null ? String(cells[6]) : null,
    mappedStatus: cells[7] != null ? String(cells[7]) : null,
    mappedExtra: cells[8] != null ? String(cells[8]) : null,
  };
}

/**
 * Map columns for the "trailers sale" layout.
 * Col A=boolean_flag, B=ref_code, C=customer, D=description,
 * E=id_or_reg, F=empty, G=empty, H=status, I=extra
 */
function mapTrailerSaleRow(cells: (string | number | boolean | null)[]) {
  return {
    // For trailers we still map to the same field names for consistency
    mappedLocation: null, // no location in trailer sales
    mappedBayRef: cells[1] != null ? String(cells[1]) : null,
    mappedCustomer: cells[2] != null ? String(cells[2]) : null,
    mappedInternalId: cells[4] != null ? String(cells[4]) : null,
    mappedRegistration: null,
    mappedIssue: cells[3] != null ? String(cells[3]) : null, // description
    mappedNotes: null,
    mappedStatus: cells[7] != null ? String(cells[7]) : null,
    mappedExtra: cells[0] != null ? String(cells[0]) : null, // boolean flag as extra
  };
}

/**
 * Parse a workbook Buffer (xlsx) into structured rows.
 */
export function parseWorkbook(
  buffer: Buffer,
  filename: string
): ParsedWorkbook {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: ParsedSheet[] = [];
  const skippedSheets: string[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    if (SKIP_SHEETS.has(sheetName)) {
      skippedSheets.push(sheetName);
      continue;
    }

    const ws = workbook.Sheets[sheetName];
    if (!ws) continue;

    const category = getSheetCategory(sheetName);
    const isTrailerSale =
      sheetName.toLowerCase().trim() === TRAILER_SALE_SHEET;

    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    const rows: ParsedRow[] = [];

    for (let r = range.s.r; r <= range.e.r; r++) {
      const cells: (string | number | boolean | null)[] = [];
      const maxCol = Math.min(range.e.c, 8); // Max 9 columns (A–I)

      for (let c = range.s.c; c <= maxCol; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        cells.push(normalizeCell(ws[addr]));
      }

      const joinedText = cells
        .map((c) => (c !== null ? String(c) : ""))
        .join(" | ");
      const fingerprint = computeFingerprint(joinedText);
      const rowClass = classifyRow(cells);

      const mapped = isTrailerSale
        ? mapTrailerSaleRow(cells)
        : mapStandardRow(cells);

      rows.push({
        sourceSheet: sheetName,
        sourceRowNumber: r,
        originalCells: cells,
        originalJoinedText: joinedText,
        fingerprint,
        rowClass,
        ...mapped,
      });

      totalRows++;
    }

    sheets.push({ sheetName, category, rows });
  }

  return { filename, sheets, totalRows, skippedSheets };
}
