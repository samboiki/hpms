/**
 * Text of a PDF page with positions, as the parsers read it. pdfExtract.ts fills this from pdf.js
 * after applying the page rotation, so a landscape statement printed on rotated portrait pages reads
 * left to right like the paper copy. Coordinates are PDF points from the top-left corner of the page
 * as displayed; y is the text baseline.
 */

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

export interface PdfPageText {
  pageNumber: number;
  width: number;
  height: number;
  /** The page's /Rotate value (0, 90, 180, 270) */
  rotation: number;
  items: PdfTextItem[];
}

export interface PdfRow {
  y: number;
  /** Left to right */
  items: PdfTextItem[];
  /** The items' text joined with single spaces */
  text: string;
}

export const rightEdge = (item: PdfTextItem): number => item.x + item.width;
export const centerOf = (item: PdfTextItem): number => item.x + item.width / 2;

/**
 * Rows of text: items whose baselines are within `tolerance` points of the row's first item, read
 * left to right. Rows are 8-12 points apart on fund documents, so 2.5 points never merges two rows.
 */
export function groupRows(items: readonly PdfTextItem[], tolerance = 2.5): PdfRow[] {
  const visible = items.filter(item => item.str.trim() !== '');
  const sorted = [...visible].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Array<{ y: number; items: PdfTextItem[] }> = [];
  for (const item of sorted) {
    const row = rows.length > 0 ? rows[rows.length - 1] : null;
    if (row && Math.abs(item.y - row.y) <= tolerance) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.map(row => {
    const ordered = [...row.items].sort((a, b) => a.x - b.x);
    return { y: row.y, items: ordered, text: ordered.map(item => item.str.trim()).join(' ') };
  });
}

/** Every page's rows, with the page number kept on each row */
export function pageRows(pages: readonly PdfPageText[]): Array<PdfRow & { page: number }> {
  return pages.flatMap(page => groupRows(page.items).map(row => ({ ...row, page: page.pageNumber })));
}

/** All text of the document, rows separated by new lines (for format detection) */
export const documentText = (pages: readonly PdfPageText[]): string =>
  pages.map(page => groupRows(page.items).map(row => row.text).join('\n')).join('\n');

/** The index of the column whose anchor is nearest to x (columns are anchored left, right or at the centre) */
export function nearestIndex(x: number, anchors: readonly number[]): number {
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  anchors.forEach((anchor, index) => {
    const distance = Math.abs(anchor - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}
