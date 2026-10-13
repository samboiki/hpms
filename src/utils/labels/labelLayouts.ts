/**
 * The label stock the label printer prints on: common A4 sheets of self-adhesive labels (bought at any stationer)
 * and single labels on a roll (a desktop label printer, one label per page). Measurements in millimetres, from the
 * makers' published layouts; "Line up" in the print sheet moves the print a little when a printer feeds unevenly.
 */

/** What a label is for: decides which layouts are offered first and how the label is laid out */
export type LabelPurpose = 'address' | 'stock' | 'shelf' | 'frame';

export interface LabelLayout {
  id: string;
  /** "21 per sheet, 63.5 x 38.1 mm" */
  name: string;
  /** Where to buy it or what it is, e.g. "A4, e.g. Avery L7160" */
  hint: string;
  kind: 'sheet' | 'roll';
  pageWidthMm: number;
  pageHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  rows: number;
  marginTopMm: number;
  marginLeftMm: number;
  /** Left edge to left edge of neighbouring labels */
  pitchXMm: number;
  /** Top edge to top edge of the rows */
  pitchYMm: number;
  /** The purposes this size suits, best first */
  suits: readonly LabelPurpose[];
}

const sheet = (
  id: string,
  hint: string,
  label: [number, number],
  grid: [number, number],
  margins: [number, number],
  pitch: [number, number],
  suits: readonly LabelPurpose[]
): LabelLayout => ({
  id,
  name: `${grid[0] * grid[1]} per sheet, ${label[0]} x ${label[1]} mm`,
  hint,
  kind: 'sheet',
  pageWidthMm: 210,
  pageHeightMm: 297,
  labelWidthMm: label[0],
  labelHeightMm: label[1],
  columns: grid[0],
  rows: grid[1],
  marginTopMm: margins[0],
  marginLeftMm: margins[1],
  pitchXMm: pitch[0],
  pitchYMm: pitch[1],
  suits
});

const roll = (id: string, hint: string, width: number, height: number, suits: readonly LabelPurpose[]): LabelLayout => ({
  id,
  name: `Label printer, ${width} x ${height} mm`,
  hint,
  kind: 'roll',
  pageWidthMm: width,
  pageHeightMm: height,
  labelWidthMm: width,
  labelHeightMm: height,
  columns: 1,
  rows: 1,
  marginTopMm: 0,
  marginLeftMm: 0,
  pitchXMm: width,
  pitchYMm: height,
  suits
});

export const LABEL_LAYOUTS: readonly LabelLayout[] = [
  sheet('a4-21', 'A4 sheet, e.g. Avery L7160: the usual address label', [63.5, 38.1], [3, 7], [15.15, 7.21], [66.04, 38.1], ['address', 'shelf', 'stock']),
  sheet('a4-14', 'A4 sheet, e.g. Avery L7163: wide address label', [99.1, 38.1], [2, 7], [15.15, 4.65], [101.6, 38.1], ['address', 'shelf']),
  sheet('a4-24', 'A4 sheet, e.g. Avery L7159', [63.5, 33.9], [3, 8], [12.9, 7.21], [66.04, 33.9], ['address', 'shelf', 'stock']),
  sheet('a4-24-edge', 'A4 sheet with no margins, e.g. Herma 4453', [70, 37], [3, 8], [0.5, 0], [70, 37], ['shelf', 'address', 'stock']),
  sheet('a4-40', 'A4 sheet, e.g. Avery L7654', [45.7, 25.4], [4, 10], [21.5, 9.7], [48.3, 25.4], ['stock', 'shelf', 'frame']),
  sheet('a4-65', 'A4 sheet of small labels, e.g. Avery L7651', [38.1, 21.2], [5, 13], [10.7, 4.75], [40.6, 21.2], ['stock', 'frame']),
  sheet('a4-8', 'A4 sheet of large labels, e.g. Avery L7165', [99.1, 67.7], [2, 4], [13.1, 4.65], [101.6, 67.7], ['shelf', 'address']),
  roll('roll-50x25', 'One label at a time on a label printer', 50, 25, ['stock', 'frame', 'shelf']),
  roll('roll-38x25', 'One label at a time on a label printer', 38, 25, ['frame', 'stock']),
  roll('roll-57x32', 'One label at a time on a label printer', 57, 32, ['shelf', 'stock', 'frame']),
  roll('roll-89x36', 'Address labels on a roll, e.g. Dymo 99012', 89, 36, ['address']),
  roll('roll-76x51', 'The dispensing-label roll', 76, 51, ['shelf', 'address', 'stock'])
];

/** The layout first offered for each purpose (until the practice chooses another on that computer) */
export const DEFAULT_LAYOUT: Readonly<Record<LabelPurpose, string>> = {
  address: 'a4-21',
  stock: 'a4-65',
  shelf: 'a4-24-edge',
  frame: 'roll-50x25'
};

export const layoutById = (id: string | null | undefined): LabelLayout | null => LABEL_LAYOUTS.find(layout => layout.id === id) ?? null;

export const labelsPerPage = (layout: LabelLayout): number => layout.columns * layout.rows;

/** The layouts in the order to offer them for a purpose: the ones that suit it (best first), then the rest */
export function layoutsFor(purpose: LabelPurpose): LabelLayout[] {
  const rank = (layout: LabelLayout): number => {
    const at = layout.suits.indexOf(purpose);
    return at < 0 ? 100 : at;
  };
  return [...LABEL_LAYOUTS].sort((a, b) => rank(a) - rank(b) || (a.kind === b.kind ? 0 : a.kind === 'sheet' ? -1 : 1));
}

export interface LabelSlot {
  /** 0-based page */
  page: number;
  /** Top-left corner of the label on its page, in mm */
  leftMm: number;
  topMm: number;
}

/**
 * Where the label at `index` goes (0-based, counting the positions left empty at the start of the first sheet):
 * across a row first, then down, as the sheets are numbered. `offset` moves every label (lining up a printer).
 */
export function slotOf(layout: LabelLayout, index: number, offset: { xMm: number; yMm: number } = { xMm: 0, yMm: 0 }): LabelSlot {
  const perPage = labelsPerPage(layout);
  const page = Math.floor(index / perPage);
  const within = index % perPage;
  const column = within % layout.columns;
  const row = Math.floor(within / layout.columns);
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    page,
    leftMm: round(layout.marginLeftMm + column * layout.pitchXMm + offset.xMm),
    topMm: round(layout.marginTopMm + row * layout.pitchYMm + offset.yMm)
  };
}
