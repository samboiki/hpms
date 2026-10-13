/**
 * Printable stock documents: dispensing labels, supplier orders, count sheets, the variance report, the
 * scheduled-medicine register and stock valuations. Pure: they take the figures and return HTML or report tables
 * (shown on screen, exported as CSV, printed with printReport). Everything printed is escaped.
 */
import { fromCents } from '../../utils/billing/money';
import type { Register } from '../../utils/stock/register';
import type { VarianceSummary } from '../../utils/stock/stockTake';
import { escapeHtml, type ReportTable } from '../finance/financeExport';
import { day, nad } from './stockUi';

export interface LabelData {
  practiceName: string;
  practicePhone: string | null;
  practiceAddress: string | null;
  /** The practice's label note (e.g. a dispensing licence number) */
  labelNote: string | null;
  patientName: string;
  medicine: string;
  /** "30 capsules" */
  quantityText: string;
  directions: string;
  dispensedOn: string;
  prescriber: string | null;
  number: string;
  /** "Repeat 1 of 2", "2 repeats", or null */
  repeatsText: string | null;
  scheduleLabel: string | null;
}

/**
 * Dispensing labels, one per page sized 76 x 51 mm (the common label roll; any printer prints it on A4 too).
 * The directions are the largest text: they are what the patient has to read.
 */
export function labelsHtml(labels: readonly LabelData[]): string {
  const one = (label: LabelData) => `<section class="label">
<div class="top"><strong>${escapeHtml(label.practiceName)}</strong>${label.practicePhone ? ` &middot; ${escapeHtml(label.practicePhone)}` : ''}</div>
${label.practiceAddress ? `<div class="small">${escapeHtml(label.practiceAddress)}</div>` : ''}
<div class="patient">${escapeHtml(label.patientName)}</div>
<div class="medicine">${escapeHtml(label.medicine)}${label.scheduleLabel ? ` <span class="small">(${escapeHtml(label.scheduleLabel)})</span>` : ''} &middot; ${escapeHtml(label.quantityText)}</div>
<div class="directions">${escapeHtml(label.directions)}</div>
<div class="small">${escapeHtml(day(label.dispensedOn))} &middot; ${escapeHtml(label.number)}${label.prescriber ? ` &middot; ${escapeHtml(label.prescriber)}` : ''}${label.repeatsText ? ` &middot; ${escapeHtml(label.repeatsText)}` : ''}</div>
<div class="small">Keep out of reach of children.${label.labelNote ? ` ${escapeHtml(label.labelNote)}` : ''}</div>
</section>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Dispensing label</title><style>
@page{size:76mm 51mm;margin:2mm}
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#000;margin:0}
.label{box-sizing:border-box;width:72mm;min-height:47mm;padding:1mm;page-break-after:always;display:flex;flex-direction:column;gap:0.6mm}
.label:last-child{page-break-after:auto}
.top{font-size:8pt}.small{font-size:6.5pt;color:#222}
.patient{font-size:9pt;font-weight:700}.medicine{font-size:8.5pt}
.directions{font-size:11pt;font-weight:700;line-height:1.15;margin:0.5mm 0}
</style></head><body>${labels.map(one).join('')}</body></html>`;
}

export interface OrderDocument {
  practiceName: string;
  practicePhone: string | null;
  practiceAddress: string | null;
  supplierName: string;
  accountNumber: string | null;
  number: string;
  orderedOn: string;
  notes: string | null;
  lines: ReadonlyArray<{ name: string; nappiCode: string | null; quantity: number; unit: string; unitCostCents: number }>;
}

/** A supplier order to print or send (an estimate at the last cost; the supplier's invoice is what counts) */
export function orderHtml(order: OrderDocument): string {
  const rows = order.lines.map(line => `<tr><td>${escapeHtml(line.name)}</td><td>${escapeHtml(line.nappiCode ?? '')}</td>`
    + `<td class="num">${line.quantity}</td><td>${escapeHtml(line.unit)}</td><td class="num">${escapeHtml(nad(line.unitCostCents * line.quantity))}</td></tr>`).join('');
  const total = order.lines.reduce((sum, line) => sum + line.unitCostCents * line.quantity, 0);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Order ${escapeHtml(order.number)}</title><style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;margin:32px;max-width:760px}
h1{font-size:22px;margin:0}.muted{color:#6B7280;font-size:12px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
th,td{padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:left}th{background:#F9FAFB;color:#4B5563;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.num{text-align:right;font-variant-numeric:tabular-nums}.facts td{border:none;padding:2px 8px 2px 0}
</style></head><body>
<h1>Order ${escapeHtml(order.number)}</h1>
<p class="muted">${escapeHtml(order.practiceName)}${order.practicePhone ? ` &middot; ${escapeHtml(order.practicePhone)}` : ''}${order.practiceAddress ? ` &middot; ${escapeHtml(order.practiceAddress)}` : ''}</p>
<table class="facts"><tr><td class="muted">To</td><td>${escapeHtml(order.supplierName)}</td></tr>
${order.accountNumber ? `<tr><td class="muted">Our account</td><td>${escapeHtml(order.accountNumber)}</td></tr>` : ''}
<tr><td class="muted">Date</td><td>${escapeHtml(day(order.orderedOn))}</td></tr></table>
<table><thead><tr><th>Item</th><th>NAPPI</th><th class="num">Quantity</th><th>Unit</th><th class="num">Estimate (excl. VAT)</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><th colspan="4">Estimated total</th><th class="num">${escapeHtml(nad(total))}</th></tr></tfoot></table>
${order.notes ? `<p>${escapeHtml(order.notes)}</p>` : ''}
<p class="muted">Please quote ${escapeHtml(order.number)} on your invoice.</p>
</body></html>`;
}

/** A blank count sheet: counted by hand on the shelf, then typed in */
export function countSheetTable(title: string, items: ReadonlyArray<{ name: string; unit: string; location: string | null; group: string | null }>): ReportTable {
  return {
    title,
    basis: 'Write what is on the shelf; leave out items you did not count',
    columns: [
      { header: 'Item', type: 'text' },
      { header: 'Group', type: 'text' },
      { header: 'Where', type: 'text' },
      { header: 'Unit', type: 'text' },
      { header: 'Counted', type: 'text' }
    ],
    rows: items.map(item => [item.name, item.group, item.location, item.unit, '']),
    notes: ['Count units the way they are dispensed or billed (tablets, ml, boxes), as the unit column says.']
  };
}

/**
 * The variance report of a count: while counting, valued at today's average cost; once posted (`asPosted`), valued as
 * the count changed the stock value
 */
export function varianceTable(
  title: string,
  report: VarianceSummary<{ name: string; unit: string; expected: number; counted: number; difference: number; valueCents: number }>,
  asPosted = false
): ReportTable {
  return {
    title,
    basis: 'Counted against what the stock ledger expected when each count was entered',
    columns: [
      { header: 'Item', type: 'text' },
      { header: 'Unit', type: 'text' },
      { header: 'Expected', type: 'count' },
      { header: 'Counted', type: 'count' },
      { header: 'Difference', type: 'count' },
      { header: 'Value (excl. VAT)', type: 'money' }
    ],
    rows: report.rows.map(row => [row.name, row.unit, row.expected, row.counted, row.difference, fromCents(row.valueCents)]),
    totals: ['Total', null, null, null, report.unitsOver - report.unitsShort, fromCents(report.valueCents)],
    notes: [`${report.counted} counted, ${report.changed} different: ${report.unitsShort} short, ${report.unitsOver} over. ${asPosted ? 'Values as the count was posted.' : 'Values at the average cost.'}`]
  };
}

export function registerTable(itemName: string, scheduleLabel: string | null, fromKey: string, toKey: string, register: Register): ReportTable {
  return {
    title: `Scheduled-medicine register: ${itemName}${scheduleLabel ? ` (${scheduleLabel})` : ''}`,
    basis: `${day(fromKey)} to ${day(toKey)}; opening balance ${register.opening}`,
    columns: [
      { header: 'Date', type: 'date' },
      { header: 'Document', type: 'text' },
      { header: 'Patient or supplier', type: 'text' },
      { header: 'Prescriber or recorded by', type: 'text' },
      { header: 'Received', type: 'count' },
      { header: 'Issued', type: 'count' },
      { header: 'Balance', type: 'count' },
      { header: 'Note', type: 'text' }
    ],
    rows: register.rows.map(row => [row.occurredOn, row.documentRef, row.party, row.by, row.received || null, row.issued || null, row.balance, row.note]),
    totals: ['Total', null, null, null, register.received, register.issued, register.closing, null],
    notes: ['From the stock ledger: every receipt and issue of this item, in the order recorded.']
  };
}

export function valuationTable(title: string, basis: string, lines: ReadonlyArray<{ name: string; unit: string; onHand: number; valueCents: number }>): ReportTable {
  const total = lines.reduce((sum, line) => sum + line.valueCents, 0);
  return {
    title,
    basis,
    columns: [
      { header: 'Item', type: 'text' },
      { header: 'Unit', type: 'text' },
      { header: 'On hand', type: 'count' },
      { header: 'Value (excl. VAT)', type: 'money' }
    ],
    rows: lines.map(line => [line.name, line.unit, line.onHand, fromCents(line.valueCents)]),
    totals: ['Total', null, lines.reduce((sum, line) => sum + line.onHand, 0), fromCents(total)],
    notes: ['At cost (average cost of what is on hand), excluding VAT.']
  };
}
