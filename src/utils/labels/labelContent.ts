/**
 * What goes on each kind of label, from the records the screens already hold: a patient's mailing address, a stock
 * item's barcode or shelf price, an optometry frame's tag. The label printer (labelSheet.ts) lays them out.
 */
import { todayKey } from '../billing/dates';
import { patientMergeValues, type PatientMergeSource } from '../templates/mergeFields';
import type { LabelData } from './labelSheet';

// ---------------------------------------------------------------------------------------------
// Mailing labels
// ---------------------------------------------------------------------------------------------

/** Address lines on a label after the name: more are joined onto the last one */
const MAX_ADDRESS_LINES = 5;

/**
 * The lines of a mailing label: the patient's formal name ("Mrs N M Shilongo", else the full name), then the postal
 * address with its postal code, else the home address (the rule letters use, patientMergeValues). An address typed
 * on one line with commas ("P O Box 123, Windhoek") is split at the commas. null when there is no address.
 */
export function mailingLines(patient: PatientMergeSource): string[] | null {
  // Lines typed on separate lines become commas first: the merge values put an address on one line
  const onOneLine = (value: string | null | undefined) => (value ? value.replace(/\s*[\r\n]+\s*/g, ', ') : value);
  const values = patientMergeValues({ ...patient, postalAddress: onOneLine(patient.postalAddress), homeAddress: onOneLine(patient.homeAddress) }, todayKey());
  const name = values.patientFormalName ?? values.patientName;
  const address = values.patientAddress;
  if (!name || !address) return null;
  const parts = address.split(/[\n,]+/).map(part => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const lines = parts.length > MAX_ADDRESS_LINES
    ? [...parts.slice(0, MAX_ADDRESS_LINES - 1), parts.slice(MAX_ADDRESS_LINES - 1).join(', ')]
    : parts;
  return [name, ...lines];
}

export interface MailingRun {
  labels: LabelData[];
  /** Patients without a name and address on file (no label) */
  withoutAddress: Array<{ patientId: string; name: string }>;
  /** Patients left out because someone before them on the list has the same address (one label per household) */
  sameAddress: number;
}

const addressKey = (lines: readonly string[]): string => lines.slice(1).join('|').toLowerCase().replace(/[^a-z0-9|]+/g, '');

/**
 * Mailing labels for patients in list order. `onePerAddress`: a family at one address gets one label (the first
 * patient on the list), so a household is not sent the same letter twice.
 */
export function mailingRun(
  patients: ReadonlyArray<{ patientId: string; name: string; source: PatientMergeSource | null }>,
  options: { onePerAddress: boolean }
): MailingRun {
  const labels: LabelData[] = [];
  const withoutAddress: MailingRun['withoutAddress'] = [];
  const seen = new Set<string>();
  let sameAddress = 0;
  for (const patient of patients) {
    const lines = patient.source ? mailingLines(patient.source) : null;
    if (!lines) {
      withoutAddress.push({ patientId: patient.patientId, name: patient.name });
      continue;
    }
    if (options.onePerAddress) {
      const key = addressKey(lines);
      if (seen.has(key)) {
        sameAddress += 1;
        continue;
      }
      seen.add(key);
    }
    labels.push({ kind: 'address', lines });
  }
  return { labels, withoutAddress, sameAddress };
}

// ---------------------------------------------------------------------------------------------
// Stock labels
// ---------------------------------------------------------------------------------------------

export interface StockLabelItem {
  name: string;
  barcode: string | null;
  nappiCode: string | null;
  sku: string | null;
  unit: string;
  packSize: number | null;
}

/**
 * The code printed on an item's label: its barcode, else its NAPPI code, else its product code (the Stock page
 * finds an item when any of them is scanned). null when the item has none.
 */
export const stockLabelCode = (item: Pick<StockLabelItem, 'barcode' | 'nappiCode' | 'sku'>): string | null =>
  item.barcode?.trim() || item.nappiCode?.trim() || item.sku?.trim() || null;

/** "box of 30", "tablet": what one price on a label is for */
export function priceUnitText(item: Pick<StockLabelItem, 'unit' | 'packSize'>): string {
  const unit = item.unit.trim() || 'unit';
  return item.packSize && item.packSize > 1 ? `pack of ${item.packSize} ${unit}${/s$/i.test(unit) ? '' : 's'}` : unit;
}

/** A barcode label for an item, with its price when given; null when the item has no code to print */
export function stockBarcodeLabel(item: StockLabelItem, priceCents: number | null = null): LabelData | null {
  const code = stockLabelCode(item);
  return code ? { kind: 'barcode', code, title: item.name, priceCents } : null;
}

/** A shelf label: the name, the price (including VAT) and what it is for, and the code when there is one */
export function shelfLabel(item: StockLabelItem, priceCents: number): LabelData {
  return {
    kind: 'shelf',
    title: item.name,
    priceCents,
    priceNote: `per ${priceUnitText(item)}, incl. VAT`,
    code: stockLabelCode(item)
  };
}

// ---------------------------------------------------------------------------------------------
// Optometry frame tags
// ---------------------------------------------------------------------------------------------

export interface FrameLabelInput {
  /** The frame's barcode (what the scanner reads) */
  code: string;
  brand?: string | null;
  model?: string | null;
  colour?: string | null;
  /** "52-18-140" (eye, bridge, temple) */
  size?: string | null;
  priceCents?: number | null;
}

const joined = (parts: ReadonlyArray<string | null | undefined>, separator: string): string =>
  parts.map(part => (part ?? '').trim()).filter(Boolean).join(separator);

/** A frame tag: brand and model, colour and size, the barcode and the price */
export function frameLabel(frame: FrameLabelInput): LabelData {
  return {
    kind: 'frame',
    code: frame.code.trim(),
    title: joined([frame.brand, frame.model], ' ') || 'Frame',
    detail: joined([frame.colour, frame.size], ' · ') || null,
    priceCents: frame.priceCents ?? null
  };
}
