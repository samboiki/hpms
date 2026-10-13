/**
 * The label printer: lays labels out on A4 label sheets or one per page for a label printer, and returns the
 * printable HTML (escaped). Pure, so the layout is tested; src/components/labels/LabelPrintSheet.tsx is the screen
 * and printLabels (src/components/labels/printLabels.ts) opens the print window.
 *
 * Kinds of label (built by src/utils/labels/labelContent.ts):
 * - address: a patient's name and postal address (mailing labels from Messages > Lists)
 * - barcode: a stock item's Code 128 barcode with its name and code (and price when given)
 * - shelf:   a shelf label: the name and the price in large type, the code (and a barcode when there is room)
 * - frame:   an optometry frame tag: brand and model, colour and size, price and barcode
 */
import { escapeHtml } from '../../components/finance/financeExport';
import { formatNad, fromCents } from '../billing/money';
import { barcodeSvg, encodeCode128, moduleWidthFor } from './code128';
import { labelsPerPage, slotOf, type LabelLayout } from './labelLayouts';

export type LabelData =
  | { kind: 'address'; lines: readonly string[] }
  | { kind: 'barcode'; code: string; title: string; detail?: string | null; priceCents?: number | null }
  | { kind: 'shelf'; title: string; priceCents: number; priceNote?: string | null; code?: string | null; detail?: string | null }
  | { kind: 'frame'; code: string; title: string; detail?: string | null; priceCents?: number | null };

export interface LabelSheetOptions {
  layout: LabelLayout;
  labels: readonly LabelData[];
  /** Sheets only: the first label position to print on (1 = top left), so a part-used sheet can be used up */
  startAt?: number;
  /** Each label this many times, one after the other (1 to 100) */
  copies?: number;
  /** Dashed outlines round each label: to check the lining up on plain paper first */
  outlines?: boolean;
  /** Moves everything on the page, in mm (right and down are positive), for a printer that feeds unevenly */
  offset?: { xMm: number; yMm: number };
  /** The print window's title */
  title?: string;
}

export interface LabelPlan {
  /** Labels printed (copies included) */
  labelCount: number;
  pageCount: number;
  /** Positions left empty at the start of the first sheet */
  skipped: number;
  /** Barcodes too long for this label width to scan reliably (they are still printed, squeezed) */
  tooLong: number;
  /** Labels whose code cannot be a barcode (printed as text only) */
  unencodable: number;
}

const MAX_COPIES = 100;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const mm = (value: number): string => `${Math.round(value * 100) / 100}mm`;
const price = (cents: number): string => formatNad(fromCents(cents));

/** startAt as a position on the sheet: 1 to the labels on a sheet (rolls always start at 1) */
export function startPosition(layout: LabelLayout, startAt: number | undefined): number {
  if (layout.kind === 'roll' || !startAt || !Number.isFinite(startAt)) return 1;
  return clamp(Math.trunc(startAt), 1, labelsPerPage(layout));
}

export const copiesOf = (copies: number | undefined): number => (copies && Number.isFinite(copies) ? clamp(Math.trunc(copies), 1, MAX_COPIES) : 1);

const codeOf = (label: LabelData): string | null => (label.kind === 'address' ? null : label.kind === 'shelf' ? label.code ?? null : label.code);

/** Inner size of a label (inside its padding) and the padding itself */
function innerBox(layout: LabelLayout): { padMm: number; widthMm: number; heightMm: number } {
  const padMm = clamp(Math.min(layout.labelWidthMm, layout.labelHeightMm) * 0.07, 1, 3);
  return { padMm, widthMm: layout.labelWidthMm - 2 * padMm, heightMm: layout.labelHeightMm - 2 * padMm };
}

/** A shelf label shows a barcode only when it is tall enough to keep the price large */
const shelfHasRoomForBarcode = (heightMm: number): boolean => heightMm >= 26;

/** How many labels, pages and barcodes that will not scan well, before printing */
export function planLabelSheet(options: Pick<LabelSheetOptions, 'layout' | 'labels' | 'startAt' | 'copies'>): LabelPlan {
  const { layout } = options;
  const skipped = startPosition(layout, options.startAt) - 1;
  const labelCount = options.labels.length * copiesOf(options.copies);
  const pageCount = labelCount === 0 ? 0 : Math.ceil((skipped + labelCount) / labelsPerPage(layout));
  const inner = innerBox(layout);
  let tooLong = 0;
  let unencodable = 0;
  for (const label of options.labels) {
    const code = codeOf(label);
    if (code === null || (label.kind === 'shelf' && !shelfHasRoomForBarcode(inner.heightMm))) continue;
    const encoded = encodeCode128(code);
    if (!encoded.ok) unencodable += 1;
    else if (moduleWidthFor(encoded.code, inner.widthMm) === null) tooLong += 1;
  }
  const times = copiesOf(options.copies);
  return { labelCount, pageCount, skipped, tooLong: tooLong * times, unencodable: unencodable * times };
}

/** The bars for a code within `widthMm`: squeezed to fit when it is too long to scan well; text only when it cannot be encoded */
function barcodeBlock(code: string, widthMm: number, heightMm: number): string {
  const encoded = encodeCode128(code);
  if (!encoded.ok) return '';
  const moduleMm = moduleWidthFor(encoded.code, widthMm) ?? Math.floor((widthMm / (encoded.code.modules.length + 20)) * 1000) / 1000;
  return `<div class="bars">${barcodeSvg(encoded.code, { moduleMm, heightMm: Math.round(heightMm * 100) / 100 })}</div>`;
}

/** One line of text, cut with an ellipsis when it is too long; `size` in mm */
const line = (text: string, size: number, extra = ''): string =>
  `<div class="line${extra ? ` ${extra}` : ''}" style="font-size:${mm(size)};line-height:1.15">${escapeHtml(text)}</div>`;

function addressHtml(lines: readonly string[], inner: { widthMm: number; heightMm: number }): string {
  const shown = lines.filter(text => text.trim()).slice(0, 7);
  const lineHeight = clamp(inner.heightMm / Math.max(shown.length, 1), 2.4, 5);
  const size = clamp(lineHeight * 0.78, 2.1, 4.2);
  return shown.map((text, at) => line(text, size, at === 0 ? 'b' : '')).join('');
}

/** Barcode and frame labels: a title, the bars, then the code (and the price) underneath */
function codedHtml(label: Extract<LabelData, { kind: 'barcode' | 'frame' }>, inner: { widthMm: number; heightMm: number }): string {
  const small = clamp(inner.heightMm * 0.13, 1.7, 3.2);
  const titleSize = clamp(inner.heightMm * 0.15, 1.9, 3.6);
  const hasDetail = !!label.detail && inner.heightMm >= 18;
  const textRows = titleSize * 1.15 + small * 1.15 + (hasDetail ? small * 1.15 : 0);
  const barsHeight = clamp(inner.heightMm - textRows - 1.2, 4, 22);
  const bottom = label.priceCents !== null && label.priceCents !== undefined
    ? `<div class="row" style="font-size:${mm(small)}"><span class="line">${escapeHtml(label.code)}</span><span class="b">${escapeHtml(price(label.priceCents))}</span></div>`
    : line(label.code, small, 'center');
  return [
    line(label.title, titleSize, 'b'),
    hasDetail ? line(label.detail ?? '', small) : '',
    barcodeBlock(label.code, inner.widthMm, barsHeight),
    bottom
  ].join('');
}

function shelfHtml(label: Extract<LabelData, { kind: 'shelf' }>, inner: { widthMm: number; heightMm: number }): string {
  const withBars = !!label.code && shelfHasRoomForBarcode(inner.heightMm) && encodeCode128(label.code).ok;
  const titleSize = clamp(inner.heightMm * 0.13, 2, 4);
  const priceSize = clamp(inner.heightMm * (withBars ? 0.24 : 0.32), 3.2, 11);
  const small = clamp(inner.heightMm * 0.09, 1.7, 2.8);
  const parts = [
    `<div class="b clamp2" style="font-size:${mm(titleSize)};line-height:1.15">${escapeHtml(label.title)}</div>`,
    `<div class="b" style="font-size:${mm(priceSize)};line-height:1.05">${escapeHtml(price(label.priceCents))}</div>`,
    label.priceNote ? line(label.priceNote, small) : '',
    label.detail ? line(label.detail, small) : ''
  ];
  if (withBars && label.code) {
    parts.push(barcodeBlock(label.code, inner.widthMm, clamp(inner.heightMm * 0.2, 4, 12)));
    parts.push(line(label.code, small, 'center'));
  } else if (label.code) {
    parts.push(line(label.code, small));
  }
  return parts.join('');
}

function labelInner(label: LabelData, inner: { widthMm: number; heightMm: number }): string {
  if (label.kind === 'address') return addressHtml(label.lines, inner);
  if (label.kind === 'shelf') return shelfHtml(label, inner);
  return codedHtml(label, inner);
}

/** The printable document: every page of labels, sized exactly for the sheet or the label printer */
export function labelSheetHtml(options: LabelSheetOptions): string {
  const { layout } = options;
  const inner = innerBox(layout);
  const offset = options.offset ?? { xMm: 0, yMm: 0 };
  const skipped = startPosition(layout, options.startAt) - 1;
  const copies = copiesOf(options.copies);
  const expanded = options.labels.flatMap(label => Array.from({ length: copies }, () => label));

  const pages: string[][] = [];
  expanded.forEach((label, at) => {
    const slot = slotOf(layout, skipped + at, offset);
    (pages[slot.page] ??= []).push(
      `<div class="label" style="left:${mm(slot.leftMm)};top:${mm(slot.topMm)}">${labelInner(label, inner)}</div>`
    );
  });

  const body = pages.map(labels => `<section class="page">${(labels ?? []).join('')}</section>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(options.title ?? 'Labels')}</title><style>
@page{size:${mm(layout.pageWidthMm)} ${mm(layout.pageHeightMm)};margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
body{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{position:relative;width:${mm(layout.pageWidthMm)};height:${mm(layout.pageHeightMm)};overflow:hidden;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.label{position:absolute;width:${mm(layout.labelWidthMm)};height:${mm(layout.labelHeightMm)};padding:${mm(inner.padMm)};overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:0.4mm}
.outlines .label{outline:0.2mm dashed #888;outline-offset:-0.1mm}
.line{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.clamp2{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.b{font-weight:700}.center{text-align:center}
.row{display:flex;justify-content:space-between;gap:1mm;align-items:baseline;line-height:1.15}
.bars{display:flex;justify-content:center;line-height:0}.bars svg{display:block}
</style></head><body class="${options.outlines ? 'outlines' : ''}">${body}</body></html>`;
}
