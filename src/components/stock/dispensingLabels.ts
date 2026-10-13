/**
 * Dispensing labels: what each label says (the medicine, directions, repeats, prescriber) and printing them.
 */
import { toast } from 'react-hot-toast';
import { printDocument } from '../finance/receipts/receiptDocuments';
import type { PracticeHeading } from '../../services/stock/stockService';
import { repeatsText } from '../../utils/stock/dispensingStatus';
import type { StockItem } from '../../utils/stock/items';
import type { DispensingRecord } from '../../utils/stock/repeats';
import type { StockSettings } from '../../utils/stock/stockRows';
import { labelsHtml } from './stockDocuments';
import { units } from './stockUi';

/** "Repeat 1 of 2" for a repeat (its place among the script's repeats), "2 repeats" for a first dispensing */
export function repeatInfo(record: DispensingRecord, all: readonly DispensingRecord[]): string | null {
  if (!record.repeatOf) return repeatsText(record, null, null);
  const first = all.find(entry => entry.id === record.repeatOf);
  const repeats = all.filter(entry => entry.repeatOf === record.repeatOf && !entry.cancelledAt)
    .sort((a, b) => a.dispensedOn.localeCompare(b.dispensedOn) || a.createdAt.localeCompare(b.createdAt));
  const position = repeats.findIndex(entry => entry.id === record.id);
  return repeatsText(record, position >= 0 ? position + 1 : null, first ? first.repeatsAllowed : null);
}

export interface LabelEntry {
  record: DispensingRecord;
  itemName: string;
  unit: string;
  scheduleLabel: string | null;
  patientName: string;
  prescriberName: string | null;
  repeats: string | null;
}

/** The label of a dispensing record, with the names the screen has loaded */
export function labelEntryFor(
  record: DispensingRecord,
  known: { all: readonly DispensingRecord[]; items: readonly StockItem[]; patientName: string; staffNames: ReadonlyMap<string, string> }
): LabelEntry {
  const item = known.items.find(entry => entry.id === record.itemId);
  return {
    record,
    itemName: item?.name ?? 'Medicine',
    unit: item?.unit ?? 'units',
    scheduleLabel: item?.isScheduled ? item.scheduleLabel : null,
    patientName: known.patientName,
    prescriberName: record.prescriberId ? known.staffNames.get(record.prescriberId) ?? null : null,
    repeats: repeatInfo(record, known.all)
  };
}

/**
 * Print dispensing labels (one per medicine) on the label printer or any printer. The heading is loaded with the
 * screen, so the print window opens straight from the click (a browser blocks one opened later).
 */
export function printLabels(heading: PracticeHeading, settings: Pick<StockSettings, 'labelNote'>, entries: readonly LabelEntry[]): void {
  if (entries.length === 0) return;
  const opened = printDocument(labelsHtml(entries.map(entry => ({
    practiceName: heading.name,
    practicePhone: heading.phone,
    practiceAddress: heading.address,
    labelNote: settings.labelNote,
    patientName: entry.patientName,
    medicine: entry.itemName,
    quantityText: units(entry.record.quantity, entry.unit),
    directions: entry.record.directions,
    dispensedOn: entry.record.dispensedOn,
    prescriber: entry.prescriberName,
    number: entry.record.number,
    repeatsText: entry.repeats,
    scheduleLabel: entry.scheduleLabel
  }))));
  if (!opened) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
}
