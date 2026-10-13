import { format } from 'date-fns';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  AGE_BANDS,
  MOVEMENT_KINDS,
  RECEIPT_METHOD_LABELS,
  TAKINGS_METHODS,
  billedPortions,
  describeDaybookEntry,
  isBackdated,
  type AgeAnalysis,
  type ArAdjustment,
  type ArReceipt,
  type BankDeposit,
  type CashierReport,
  type ControlSummary,
  type ControlTotals,
  type DaybookEntry,
  type LedgerInvoice
} from '../../../services/ledgerService';
import { displayValue, escapeHtml, type CsvCell, type ReportTable } from '../financeExport';
import { PAYMENT_METHOD_META } from '../financeTheme';
import { formatDay } from '../receipts/receiptDocuments';

/**
 * Report tables and printable documents of the daily and month-end controls. Pure: they take the
 * figures (cents) and return ReportTables (shown on screen, exported as CSV, printed) or HTML.
 */

const amount = (cents: number): number => fromCents(cents);
const NOTE = 'From HPMS receipts, invoices and adjustments (the same entries as the daybook).';

/** The day's control totals next to month to date (Eminance's daily turnover with month-to-date totals) */
export function daySheetTable(day: ControlSummary, monthToDate: ControlSummary, dayLabel: string): ReportTable {
  const row = (label: string, pick: (summary: ControlSummary) => number, count?: (summary: ControlSummary) => number): CsvCell[] =>
    [label, count ? count(day) : null, amount(pick(day)), amount(pick(monthToDate))];
  return {
    title: `Day sheet ${dayLabel}`,
    basis: `${dayLabel}, with month to date`,
    columns: [
      { header: 'Line', type: 'text' },
      { header: 'Count (day)', type: 'count' },
      { header: 'Day', type: 'money' },
      { header: 'Month to date', type: 'money' }
    ],
    rows: [
      row('Invoices raised (turnover)', s => s.invoices.billedCents, s => s.invoices.count),
      row('  of which medical aid', s => s.invoices.medicalAidCents),
      row('  of which patient', s => s.invoices.patientCents),
      row('Payments received', s => s.receipts.cents, s => s.receipts.count),
      ...TAKINGS_METHODS.map(method => row(`  ${PAYMENT_METHOD_META[method].label}`, s => s.receipts.byMethod[method])).filter(cells => cells[2] !== 0 || cells[3] !== 0),
      row('Payments reversed', s => s.receiptReversals.cents, s => s.receiptReversals.count),
      row('Refunds paid out', s => s.refunds.cents, s => s.refunds.count),
      row('Credit notes', s => s.adjustments.credit_note.cents, s => s.adjustments.credit_note.count),
      row('Discounts given', s => s.adjustments.discount.cents, s => s.adjustments.discount.count),
      row('Write-offs', s => s.adjustments.write_off.cents, s => s.adjustments.write_off.count),
      row('Corrections (journals)', s => s.adjustments.journal.cents, s => s.adjustments.journal.count),
      row('Shortfalls moved to patients', s => s.adjustments.shortfall_transfer.cents, s => s.adjustments.shortfall_transfer.count),
      row('Adjustments reversed (effect)', s => s.adjustmentReversals.cents, s => s.adjustmentReversals.count),
      row('Change in what debtors owe', s => s.netMovementCents),
      row('Cash expected in the till', s => s.cash.expectedCents)
    ],
    notes: [
      'A payment counts on the day it was received, a reversal on the day it was made, an invoice on its invoice date at what it bills now.',
      'Change in what debtors owe = invoices - payments + reversed payments + refunds - credit notes - discounts - write-offs +/- corrections and reversed adjustments.',
      NOTE
    ]
  };
}

/** Receipts per cashier and method (cash control) */
export function cashierTable(report: CashierReport, staffNames: Readonly<Record<string, string>>, basis: string): ReportTable {
  const methods = TAKINGS_METHODS.filter(method => report.totals.byMethod[method] !== 0);
  const cells = (line: CashierReport['totals'], label: string): CsvCell[] => [
    label,
    line.receiptCount,
    ...methods.map(method => amount(line.byMethod[method])),
    amount(-line.refundCents),
    amount(line.netCents),
    amount(line.expectedCashCents),
    line.reversedCount > 0 ? `${line.reversedCount} (${formatNad(fromCents(line.reversedCents))})` : ''
  ];
  return {
    title: 'Cashier report',
    basis,
    columns: [
      { header: 'Captured by', type: 'text' },
      { header: 'Receipts', type: 'count' },
      ...methods.map(method => ({ header: PAYMENT_METHOD_META[method].label, type: 'money' as const })),
      { header: 'Refunds', type: 'money' },
      { header: 'Net', type: 'money' },
      { header: 'Cash to hand over', type: 'money' },
      { header: 'Reversed', type: 'text' }
    ],
    rows: report.lines.map(line => cells(line, line.userId ? staffNames[line.userId] ?? 'Staff member' : 'Not recorded')),
    totals: cells(report.totals, 'Total'),
    notes: [
      'Receipts count on the day they were received; reversed receipts are not counted but are listed against the person who captured them.',
      'Cash to hand over is cash received less cash refunds paid out by that person.',
      NOTE
    ]
  };
}

/** A day's daybook: numbered entries in the order they were recorded */
export function daybookTable(entries: readonly DaybookEntry[], input: { dayLabel: string; banner: string; staffNames: Readonly<Record<string, string>>; patientNames: Readonly<Record<string, string>> }): ReportTable {
  return {
    title: `Daybook ${input.dayLabel}${input.banner === 'Original' ? '' : ' (reprint)'}`,
    basis: `${input.banner} · entries recorded ${input.dayLabel}`,
    columns: [
      { header: 'No.', type: 'count' },
      { header: 'Time', type: 'text' },
      { header: 'Counts on', type: 'date' },
      { header: 'Entry', type: 'text' },
      { header: 'Patient', type: 'text' },
      { header: 'Amount', type: 'money' },
      { header: 'Effect on debtors', type: 'money' },
      { header: 'By', type: 'text' }
    ],
    rows: entries.map(entry => [
      entry.number,
      format(new Date(entry.recordedAt), 'HH:mm'),
      entry.businessDate,
      `${describeDaybookEntry(entry)}${isBackdated(entry) ? ' (captured late)' : ''}`,
      (entry.patientId && input.patientNames[entry.patientId]) || '',
      amount(entry.amountCents),
      entry.effectCents === 0 ? null : amount(entry.effectCents),
      (entry.actor && input.staffNames[entry.actor]) || ''
    ]),
    totals: ['Total', '', '', `${entries.length} entries`, '', null, amount(entries.reduce((sum, entry) => sum + entry.effectCents, 0)), ''],
    notes: [
      'The daybook cannot be changed: entries are numbered without gaps when they are recorded and never edited or deleted. A correction is a new entry.',
      'Every print and export is logged; only the first is the original.'
    ]
  };
}

/** A printable deposit slip: the cash going to the bank, receipt by receipt */
export function depositSlipHtml(deposit: BankDeposit, receipts: readonly ArReceipt[], refunds: readonly ArAdjustment[], meta: { practiceName: string; payerNames: Readonly<Record<string, string>>; preparedBy: string | null }): string {
  const money = (cents: number) => escapeHtml(formatNad(fromCents(cents)));
  const receiptRows = receipts.map(receipt => `<tr><td>${escapeHtml(receipt.number)}</td><td>${escapeHtml(formatDay(receipt.receivedOn))}</td>`
    + `<td>${escapeHtml((receipt.patientId && meta.payerNames[receipt.patientId]) || receipt.payerName || '')}</td><td>${escapeHtml(RECEIPT_METHOD_LABELS[receipt.method])}</td><td class="num">${money(receipt.amountCents)}</td></tr>`).join('');
  const refundRows = refunds.map(refund => `<tr><td>${escapeHtml(refund.number)}</td><td>${escapeHtml(formatDay(refund.effectiveOn))}</td><td>Cash refund paid from the till</td><td></td><td class="num">-${money(refund.amountCents)}</td></tr>`).join('');
  const status = deposit.status === 'deposited'
    ? `Deposited on ${escapeHtml(formatDay(deposit.depositedOn))}, bank reference ${escapeHtml(deposit.bankReference ?? '')}`
    : deposit.status === 'cancelled' ? `Cancelled: ${escapeHtml(deposit.cancelReason ?? '')}` : 'Prepared, not banked yet';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Deposit slip ${escapeHtml(deposit.number)}</title><style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;margin:32px;max-width:760px}h1{font-size:20px;margin:0}
.muted{color:#6B7280;font-size:12px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:16px}
th,td{padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:left}th{background:#F9FAFB;font-size:11px;text-transform:uppercase;color:#4B5563}
.num{text-align:right;font-variant-numeric:tabular-nums}.total td{font-weight:700;border-top:2px solid #9CA3AF}.sign{margin-top:48px;display:flex;gap:48px}
.sign div{flex:1;border-top:1px solid #9CA3AF;padding-top:4px;font-size:12px;color:#6B7280}</style></head><body>
<h1>${escapeHtml(meta.practiceName)}</h1>
<p class="muted">Deposit slip ${escapeHtml(deposit.number)} · prepared ${escapeHtml(formatDay(deposit.preparedOn))}${meta.preparedBy ? ` by ${escapeHtml(meta.preparedBy)}` : ''} · ${status}</p>
<table><thead><tr><th>Receipt</th><th>Received</th><th>From</th><th>Method</th><th class="num">Amount</th></tr></thead>
<tbody>${receiptRows}${refundRows}<tr class="total"><td colspan="4">Cash to bank</td><td class="num">${money(deposit.amountCents)}</td></tr></tbody></table>
<div class="sign"><div>Counted by</div><div>Banked by</div></div>
</body></html>`;
}

/** The roll-forward of a month (Eminance's control totals) */
export function controlTotalsTable(totals: ControlTotals, monthLabel: string): ReportTable {
  return {
    title: `Control totals ${monthLabel}`,
    basis: `${monthLabel}: opening balance + movements = closing balance`,
    columns: [{ header: 'Line', type: 'text' }, { header: 'Amount', type: 'money' }],
    rows: [
      [totals.openingSource === 'previous_close' ? 'Opening balance (closing balance of the previous close)' : 'Opening balance', amount(totals.openingCents)],
      ...MOVEMENT_KINDS.map(kind => [`  ${kind.label}`, amount(totals.movements[kind.key])] as CsvCell[]),
      ['Closing balance', amount(totals.closingCents)],
      ['What the account balances say', amount(totals.ledgerClosingCents)],
      ['Difference', amount(totals.closingCents - totals.ledgerClosingCents)]
    ],
    notes: [
      'What debtors owe the practice, net of credit not yet allocated. Payments and credits are negative (they reduce what is owed).',
      'A reversal counts in the month it was made, so a closed month never changes.',
      NOTE
    ]
  };
}

/** Turnover of a month: invoices raised, split by funder and by practitioner */
export function turnoverTable(invoices: readonly LedgerInvoice[], summary: ControlSummary, doctorNames: Readonly<Record<string, string>>, monthLabel: string): ReportTable {
  const byDoctor = new Map<string, { count: number; cents: number; medicalAid: number; patient: number }>();
  for (const invoice of invoices) {
    const billed = billedPortions(invoice);
    const cents = billed.medical_aid + billed.patient;
    if (cents === 0) continue;
    const key = invoice.practitionerId ?? '';
    const row = byDoctor.get(key) ?? { count: 0, cents: 0, medicalAid: 0, patient: 0 };
    row.count += 1;
    row.cents += cents;
    row.medicalAid += billed.medical_aid;
    row.patient += billed.patient;
    byDoctor.set(key, row);
  }
  const rows = [...byDoctor.entries()]
    .map(([doctorId, row]) => [doctorId ? doctorNames[doctorId] ?? 'Practitioner' : 'No practitioner recorded', row.count, amount(row.medicalAid), amount(row.patient), amount(row.cents)] as CsvCell[])
    .sort((a, b) => Number(b[4]) - Number(a[4]));
  return {
    title: `Turnover ${monthLabel}`,
    basis: `Invoices dated ${monthLabel}, at what they bill now (cancelled invoices excluded)`,
    columns: [
      { header: 'Practitioner', type: 'text' },
      { header: 'Invoices', type: 'count' },
      { header: 'Medical aid', type: 'money' },
      { header: 'Patient', type: 'money' },
      { header: 'Turnover', type: 'money' }
    ],
    rows,
    totals: ['Total', summary.invoices.count, amount(summary.invoices.medicalAidCents), amount(summary.invoices.patientCents), amount(summary.invoices.billedCents)],
    notes: [NOTE]
  };
}

/** Money received in a month by method, less refunds */
export function receiptsByMethodTable(summary: ControlSummary, monthLabel: string): ReportTable {
  const methods = TAKINGS_METHODS.filter(method => summary.receipts.byMethod[method] !== 0);
  return {
    title: `Payments received ${monthLabel}`,
    basis: `Receipts dated ${monthLabel}, by how they were paid`,
    columns: [{ header: 'Method', type: 'text' }, { header: 'Amount', type: 'money' }],
    rows: [
      ...methods.map(method => [PAYMENT_METHOD_META[method].label, amount(summary.receipts.byMethod[method])] as CsvCell[]),
      ['Reversed in the month', amount(-summary.receiptReversals.cents)],
      ['Refunds paid out', amount(-summary.refunds.cents)]
    ],
    totals: ['Net received', amount(summary.receipts.cents - summary.receiptReversals.cents - summary.refunds.cents)],
    notes: ['From medical aids: ' + formatNad(fromCents(summary.receipts.fromMedicalAidsCents)) + '; from patients and others: ' + formatNad(fromCents(summary.receipts.fromOthersCents)) + '.', NOTE]
  };
}

/** An age analysis as a report: one row per account (or fund), current to 180+, unallocated and net */
export function ageAnalysisTable(analysis: AgeAnalysis, input: { title: string; basis: string; rowHeader: string; notes?: string[] }): ReportTable {
  const cells = (label: string, row: Pick<AgeAnalysis['totals'], 'bands' | 'owedCents' | 'unallocatedCents' | 'netCents'>): CsvCell[] => [
    label,
    ...AGE_BANDS.map(band => amount(row.bands[band.key])),
    amount(row.owedCents),
    amount(row.unallocatedCents),
    amount(row.netCents)
  ];
  return {
    title: input.title,
    basis: input.basis,
    columns: [
      { header: input.rowHeader, type: 'text' },
      ...AGE_BANDS.map(band => ({ header: band.label, type: 'money' as const })),
      { header: 'Owed', type: 'money' },
      { header: 'Unallocated', type: 'money' },
      { header: 'Net', type: 'money' }
    ],
    rows: analysis.rows.map(row => cells(row.label, row)),
    totals: cells(`Total (${analysis.totals.rowCount})`, analysis.totals),
    notes: [
      'Aged by the invoice date: current is under 30 days, then 30, 60, 90, 120, 150 and 180 days or more.',
      'Unallocated: money received and not yet allocated to an invoice (for a fund, payments still to match). Net = owed less unallocated.',
      ...(input.notes ?? [])
    ]
  };
}

/** Several report tables in one printable document (the month-end pack) */
export function packToHtml(title: string, sections: readonly ReportTable[], meta: { practiceName: string; banner?: string | null; generatedAt?: Date }): string {
  const generated = format(meta.generatedAt ?? new Date(), 'd MMM yyyy, HH:mm');
  const isNumeric = (type: string) => type === 'money' || type === 'count' || type === 'percent';
  const section = (report: ReportTable) => {
    const head = report.columns.map(column => `<th class="${isNumeric(column.type) ? 'num' : ''}">${escapeHtml(column.header)}</th>`).join('');
    const body = report.rows.map(row => `<tr>${report.columns.map((column, i) => `<td class="${isNumeric(column.type) ? 'num' : ''}">${escapeHtml(displayValue(row[i], column.type))}</td>`).join('')}</tr>`).join('');
    const totals = report.totals
      ? `<tfoot><tr>${report.columns.map((column, i) => `<th class="${isNumeric(column.type) ? 'num' : ''}">${escapeHtml(displayValue(report.totals?.[i], column.type))}</th>`).join('')}</tr></tfoot>`
      : '';
    const notes = (report.notes ?? []).map(note => `<p class="note">${escapeHtml(note)}</p>`).join('');
    return `<section><h2>${escapeHtml(report.title)}</h2><p class="meta">${escapeHtml(report.basis)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${totals}</table>${notes}</section>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;margin:32px}h1{font-size:22px;margin:0 0 4px}
h2{font-size:16px;margin:0 0 2px}.meta{color:#6B7280;font-size:12px;margin:0 0 10px}.banner{display:inline-block;margin:8px 0 16px;padding:4px 10px;border:2px solid #B45309;color:#92400E;font-weight:600;font-size:12px}
section{margin-top:28px;page-break-inside:avoid}section+section{page-break-before:auto}
table{width:100%;border-collapse:collapse;font-size:11px}th,td{padding:5px 6px;border-bottom:1px solid #E5E7EB;text-align:left}
thead th{background:#F9FAFB;color:#4B5563;text-transform:uppercase;font-size:9px;letter-spacing:.04em}tfoot th{border-top:2px solid #9CA3AF}
.num{text-align:right;font-variant-numeric:tabular-nums}.note{color:#6B7280;font-size:10px;margin:6px 0 0}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${escapeHtml(meta.practiceName)} · generated ${escapeHtml(generated)}</p>
${meta.banner ? `<p class="banner">${escapeHtml(meta.banner)}</p>` : ''}
${sections.map(section).join('\n')}
</body></html>`;
}

/** Report tables from JSON kept with a month-end close (a closed month's pack is reprinted exactly as it was) */
export function packFromSnapshot(value: unknown): ReportTable[] {
  if (!value || typeof value !== 'object') return [];
  const sections = (value as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return [];
  return sections.filter((section): section is ReportTable => {
    if (!section || typeof section !== 'object') return false;
    const table = section as Partial<ReportTable>;
    return typeof table.title === 'string' && typeof table.basis === 'string' && Array.isArray(table.columns) && Array.isArray(table.rows);
  });
}
