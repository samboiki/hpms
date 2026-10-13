/**
 * The optometry reports as tables for print and CSV (src/components/finance/financeExport.ts), in the same shape as
 * the Stock reports (stockDocuments.ts): money in N$ (not cents), dates as date keys. The figures come from the tested
 * report utilities (frameReports.ts, jobCosting.ts, consignment.ts, report.ts); these only lay them out.
 */
import type { ReportTable } from '../finance/financeExport';
import { formatServiceDate } from '../../utils/billing/dates';
import { fromCents } from '../../utils/billing/money';
import { LINE_KIND_LABELS, lineAmounts, type SupplierOwed } from '../../utils/optometry/consignment';
import { FRAME_UNIT_STATUS_LABELS } from '../../utils/optometry/frameUnits';
import type { FrameSaleLine, FrameStatusRow, SalespersonRow } from '../../utils/optometry/frameReports';
import { JOB_GAP_LABELS, type JobCosting } from '../../utils/optometry/jobCosting';
import type { PresbyopicPatient } from '../../utils/optometry/report';

type Names = ReadonlyMap<string, string>;

const period = (from: string, to: string): string => `${formatServiceDate(from)} to ${formatServiceDate(to)}`;
const named = (names: Names, id: string | null, fallback: string): string => (id ? names.get(id) ?? fallback : fallback);
const money = (cents: number | null): number | null => (cents === null ? null : fromCents(cents));
const sum = <T,>(rows: readonly T[], pick: (row: T) => number): number => rows.reduce((total, row) => total + pick(row), 0);

export const NOT_KNOWN = 'Not known';

export function frameSalesTable(lines: readonly FrameSaleLine[], from: string, to: string, names: { patients: Names; staff: Names }): ReportTable {
  return {
    title: 'Frames sold',
    basis: period(from, to),
    columns: [
      { header: 'Date', type: 'date' },
      { header: 'Invoice', type: 'text' },
      { header: 'Patient', type: 'text' },
      { header: 'Frame', type: 'text' },
      { header: 'Barcodes', type: 'text' },
      { header: 'Frames', type: 'count' },
      { header: 'Price (incl. VAT)', type: 'money' },
      { header: 'Price (excl. VAT)', type: 'money' },
      { header: 'Cost', type: 'money' },
      { header: 'Profit', type: 'money' },
      { header: 'Sold by', type: 'text' },
      { header: 'Consignment', type: 'text' }
    ],
    rows: lines.map(line => [
      line.soldOn,
      line.invoiceNumber,
      line.patientId ? named(names.patients, line.patientId, 'Patient') : null,
      line.frame,
      line.barcodes.join(' '),
      line.units,
      money(line.priceCents),
      money(line.priceExclCents),
      fromCents(line.costCents),
      money(line.profitCents),
      named(names.staff, line.sellerId, NOT_KNOWN),
      line.consignment ? 'Yes' : null
    ]),
    totals: [
      'Total', null, null, null, null,
      sum(lines, line => line.units),
      fromCents(sum(lines, line => line.priceCents ?? 0)),
      fromCents(sum(lines, line => line.priceExclCents ?? 0)),
      fromCents(sum(lines, line => line.costCents)),
      fromCents(sum(lines, line => line.profitCents ?? 0)),
      null, null
    ],
    notes: [
      'From the stock ledger: frames billed on invoices, less those taken off again. Cost: the stock value of the frame, or what is owed to the supplier for a consignment frame.',
      'Sold by: who put the frame aside for the patient, or who billed it, unless changed on the frame.'
    ]
  };
}

export function salespeopleTable(rows: readonly SalespersonRow[], from: string, to: string, staff: Names): ReportTable {
  return {
    title: 'Frame sales by salesperson',
    basis: period(from, to),
    columns: [
      { header: 'Salesperson', type: 'text' },
      { header: 'Frames', type: 'count' },
      { header: 'Sales (excl. VAT)', type: 'money' },
      { header: 'Cost', type: 'money' },
      { header: 'Profit', type: 'money' }
    ],
    rows: rows.map(row => [named(staff, row.sellerId, NOT_KNOWN), row.frames, fromCents(row.salesCents), fromCents(row.costCents), fromCents(row.profitCents)]),
    totals: ['Total', sum(rows, row => row.frames), fromCents(sum(rows, row => row.salesCents)), fromCents(sum(rows, row => row.costCents)), fromCents(sum(rows, row => row.profitCents))]
  };
}

export function framesByBarcodeTable(rows: readonly FrameStatusRow[], today: string, names: { patients: Names; suppliers: Names }): ReportTable {
  return {
    title: 'Frames by barcode',
    basis: `As at ${formatServiceDate(today)}`,
    columns: [
      { header: 'Barcode', type: 'text' },
      { header: 'Frame', type: 'text' },
      { header: 'Status', type: 'text' },
      { header: 'Since', type: 'date' },
      { header: 'By', type: 'text' },
      { header: 'Patient', type: 'text' },
      { header: 'Days in stock', type: 'count' },
      { header: 'Consignment from', type: 'text' }
    ],
    rows: rows.map(row => [
      row.barcode,
      row.frame,
      FRAME_UNIT_STATUS_LABELS[row.status],
      row.since || null,
      row.by,
      row.patientId ? named(names.patients, row.patientId, 'Patient') : null,
      row.daysInStock,
      row.consignmentSupplierId ? named(names.suppliers, row.consignmentSupplierId, 'Supplier') : null
    ]),
    notes: ['One row per frame. Days in stock: since the frame came in, for frames still in the practice.']
  };
}

export function presbyopicTable(patients: readonly PresbyopicPatient[], today: string, names: Names): ReportTable {
  return {
    title: 'Presbyopic patients',
    basis: `Ages on ${formatServiceDate(today)}`,
    columns: [
      { header: 'Patient', type: 'text' },
      { header: 'Age', type: 'count' },
      { header: 'Age group', type: 'text' },
      { header: 'Reading add', type: 'text' },
      { header: 'Prescribed', type: 'date' }
    ],
    rows: patients.map(patient => [named(names, patient.patientId, 'Patient'), patient.age, patient.band, `+${patient.add.toFixed(2)}`, patient.prescribedOn]),
    notes: ['Everyone whose latest spectacle prescription has a reading addition, youngest first.']
  };
}

export function jobCostingTable(costing: JobCosting, from: string, to: string, patients: Names): ReportTable {
  return {
    title: 'Job costing: spectacles',
    basis: `Lab orders placed ${period(from, to)}`,
    columns: [
      { header: 'Order', type: 'text' },
      { header: 'Ordered', type: 'date' },
      { header: 'Patient', type: 'text' },
      { header: 'Invoice', type: 'text' },
      { header: 'Price (excl. VAT)', type: 'money' },
      { header: 'Frame', type: 'money' },
      { header: 'Lenses', type: 'money' },
      { header: 'Labour', type: 'money' },
      { header: 'Profit', type: 'money' },
      { header: 'Margin', type: 'percent' },
      { header: 'Still missing', type: 'text' }
    ],
    rows: costing.rows.map(row => [
      `#${row.orderNo}`,
      row.orderedOn,
      named(patients, row.patientId, 'Patient'),
      row.invoiceNumber,
      fromCents(row.priceCents),
      fromCents(row.frameCostCents),
      money(row.lensCostCents),
      money(row.labourCostCents),
      fromCents(row.profitCents),
      row.margin,
      row.gaps.map(gap => JOB_GAP_LABELS[gap]).join('; ') || null
    ]),
    totals: [
      'Total', null, null, null,
      fromCents(costing.priceCents),
      fromCents(costing.frameCostCents),
      fromCents(costing.lensCostCents),
      fromCents(costing.labourCostCents),
      fromCents(costing.profitCents),
      costing.margin,
      costing.incomplete > 0 ? `${costing.incomplete} incomplete` : null
    ],
    notes: [
      'Price: the visit\'s invoice without VAT (stock lines are priced with VAT). Frame: its stock value, or what is owed to the supplier for a consignment frame. Lenses and labour: as entered on the job.',
      'A job still missing a cost shows more profit than it made.'
    ]
  };
}

export function consignmentTable(owed: readonly SupplierOwed[], today: string, names: { suppliers: Names; frames: Names }): ReportTable {
  const lines = owed.flatMap(entry => entry.lines.map(line => ({ entry, line, amounts: lineAmounts(line) })));
  return {
    title: 'Consignment frames: owed to suppliers',
    basis: `Not settled, as at ${formatServiceDate(today)}`,
    columns: [
      { header: 'Supplier', type: 'text' },
      { header: 'Date', type: 'date' },
      { header: 'Frame', type: 'text' },
      { header: 'What', type: 'text' },
      { header: 'Frames', type: 'count' },
      { header: 'Each (excl. VAT)', type: 'money' },
      { header: 'Excl. VAT', type: 'money' },
      { header: 'VAT', type: 'money' },
      { header: 'Incl. VAT', type: 'money' }
    ],
    rows: lines.map(({ entry, line, amounts }) => [
      named(names.suppliers, entry.supplierId, 'No supplier named'),
      line.happenedOn,
      named(names.frames, line.itemId, 'Frame'),
      LINE_KIND_LABELS[line.kind] ?? line.kind,
      line.quantity,
      fromCents(line.costEachCents),
      fromCents(amounts.exclCents),
      fromCents(amounts.vatCents),
      fromCents(amounts.inclCents)
    ]),
    totals: [
      'Total', null, null, null,
      sum(owed, entry => entry.frames),
      null,
      fromCents(sum(owed, entry => entry.exclCents)),
      fromCents(sum(owed, entry => entry.vatCents)),
      fromCents(sum(owed, entry => entry.inclCents))
    ],
    notes: ['Each consignment frame sold (or lost) is owed to its supplier at the agreed cost until the supplier\'s invoice is recorded.']
  };
}
