/**
 * The label printer's small API, for any screen that prints labels:
 *
 *   import { LabelPrintSheet } from '../labels/LabelPrintSheet';            // the dialog: layout, start position, copies
 *   import { frameLabel, stockBarcodeLabel, shelfLabel } from '../../utils/labels/labelContent';
 *   <LabelPrintSheet open purpose="frame" title="Frame labels" labels={frames.map(frameLabel)} onClose={...} />
 *
 * or, to print straight away with a known layout: printLabels({ layout: layoutById('roll-50x25')!, labels }).
 */
import { printDocument } from '../finance/receipts/receiptDocuments';
import { labelSheetHtml, type LabelSheetOptions } from '../../utils/labels/labelSheet';

/** Opens the labels in a print window. False when the browser blocked the window. */
export const printLabels = (options: LabelSheetOptions): boolean => printDocument(labelSheetHtml(options));
