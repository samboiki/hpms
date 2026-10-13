/**
 * Year to date per tariff code, fund and practitioner (parity R21; Eminance's year-to-date analysis, medical aid and
 * practitioner enquiries): what was billed from 1 January, one column per month. Each view is built month by month
 * from the function behind the matching Finance report, so its figures are those reports' figures for the same days:
 * - per tariff code: Revenue by tariff code (line items of uncancelled invoices issued in the month);
 * - per fund: Payer mix (the medical aid portion per fund, and the patient's own portion);
 * - per practitioner: Practitioner productivity's billed (the practitioner on the invoice's visit, else the invoice's).
 * Amounts are whole cents.
 */
import { endOfMonth, format, parseISO } from 'date-fns';
import {
  doctorProductivity,
  monthKeysInRange,
  payerMix,
  revenueByTariffCode,
  toCents,
  type DateRange,
  type LedgerInvoice,
  type LedgerLineItem,
  type LedgerVisit
} from '../../../services/ledgerService';
import type { CsvCell } from '../financeExport';
import { formatMonthKey } from '../financeFormat';
import type { LinkedReport } from './reportTargets';

export type YearToDateView = 'tariff' | 'fund' | 'practitioner';

export interface YearToDateRow {
  key: string;
  /** Tariff rows: the code and its description; other rows are named by the caller (funds by name, staff by id) */
  label: string;
  /** Cents per month, in the order of monthKeys */
  byMonth: number[];
  totalCents: number;
  /** Tariff rows: units billed */
  quantity: number | null;
}

export interface YearToDateMatrix {
  view: YearToDateView;
  monthKeys: string[];
  rows: YearToDateRow[];
  monthTotals: number[];
  totalCents: number;
}

/** 1 January of the year a day falls in, to that day */
export const yearToDateRange = (endKey: string): DateRange => ({ startKey: `${endKey.slice(0, 4)}-01-01`, endKey });

/** The months of a range, each cut to the range (so the months add up to the range exactly) */
export function monthsOf(range: DateRange): Array<{ monthKey: string; range: DateRange }> {
  return monthKeysInRange(range).map(monthKey => {
    const first = `${monthKey}-01`;
    const last = format(endOfMonth(parseISO(first)), 'yyyy-MM-dd');
    return { monthKey, range: { startKey: first < range.startKey ? range.startKey : first, endKey: last > range.endKey ? range.endKey : last } };
  });
}

/** Keys besides a fund's name or a practitioner's user id */
export const PATIENT_PORTION = '__patient__';
export const NO_PRACTITIONER = 'none';
const SPECIAL_LAST = [PATIENT_PORTION, NO_PRACTITIONER];

type Cell = { cents: number; quantity?: number };

/** Rows from per-month cells, the largest year-to-date first and the patient's portion or "no practitioner" last */
function matrixOf(view: YearToDateView, months: Array<{ monthKey: string }>, cells: Array<Map<string, Cell & { label: string }>>): YearToDateMatrix {
  const rows = new Map<string, YearToDateRow>();
  cells.forEach((month, index) => {
    for (const [key, cell] of month) {
      const row = rows.get(key) ?? { key, label: cell.label, byMonth: months.map(() => 0), totalCents: 0, quantity: view === 'tariff' ? 0 : null };
      row.byMonth[index] += cell.cents;
      row.totalCents += cell.cents;
      if (row.quantity !== null) row.quantity += cell.quantity ?? 0;
      rows.set(key, row);
    }
  });
  const rank = (key: string) => SPECIAL_LAST.indexOf(key);
  const sorted = [...rows.values()].sort((a, b) => rank(a.key) - rank(b.key) || b.totalCents - a.totalCents || a.label.localeCompare(b.label));
  const monthTotals = months.map((_, index) => sorted.reduce((sum, row) => sum + row.byMonth[index], 0));
  return { view, monthKeys: months.map(month => month.monthKey), rows: sorted, monthTotals, totalCents: monthTotals.reduce((sum, cents) => sum + cents, 0) };
}

/** A tariff row's key: its code, or its description when it has none (Revenue by tariff code groups the same way) */
const tariffKey = (code: string, description: string): string => code || `desc:${description.toLowerCase()}`;

export function yearToDateByTariff(lines: readonly LedgerLineItem[], invoices: readonly LedgerInvoice[], range: DateRange): YearToDateMatrix {
  const months = monthsOf(range);
  const cells = months.map(month => new Map(
    revenueByTariffCode([...lines], [...invoices], month.range).map(row => [
      tariffKey(row.code, row.description),
      { cents: toCents(row.revenue), quantity: row.quantity, label: row.code ? `${row.code} · ${row.description}` : row.description }
    ] as const)
  ));
  return matrixOf('tariff', months, cells);
}

export function yearToDateByFund(invoices: readonly LedgerInvoice[], range: DateRange, schemeByPatient: Readonly<Record<string, string>>): YearToDateMatrix {
  const months = monthsOf(range);
  const cells = months.map(month => {
    const mix = payerMix([...invoices], month.range, { ...schemeByPatient });
    const map = new Map<string, Cell & { label: string }>(mix.schemes.map(scheme => [scheme.scheme, { cents: toCents(scheme.amount), label: scheme.scheme }]));
    if (mix.patient !== 0) map.set(PATIENT_PORTION, { cents: toCents(mix.patient), label: 'Patient (self-pay portion)' });
    return map;
  });
  return matrixOf('fund', months, cells);
}

export function yearToDateByPractitioner(invoices: readonly LedgerInvoice[], visits: readonly LedgerVisit[], range: DateRange): YearToDateMatrix {
  const months = monthsOf(range);
  const cells = months.map(month => new Map(
    doctorProductivity([...invoices], [...visits], month.range)
      .filter(row => row.invoiceCount > 0)
      .map(row => [row.doctorId ?? NO_PRACTITIONER, { cents: toCents(row.billed), label: row.doctorId ?? NO_PRACTITIONER }] as const)
  ));
  return matrixOf('practitioner', months, cells);
}

const amount = (cents: number): number => cents / 100;

export const YEAR_TO_DATE_NOTES: Readonly<Record<YearToDateView, string>> = {
  tariff: 'Line items of uncancelled invoices by invoice date, as in Revenue by tariff code. Invoice totals can differ from their lines (see that report\'s note).',
  fund: 'The medical aid portion of uncancelled invoices per fund, by invoice date, and the patient\'s own portion, as in Payer mix: together they are everything billed.',
  practitioner: 'Uncancelled invoices by invoice date for the practitioner on the invoice\'s visit, else the practitioner who created it, as in Practitioner productivity.'
};

/** The matrix as a table: one row per tariff code, fund or practitioner, a column per month, the year to date and its share */
export function yearToDateTable(matrix: YearToDateMatrix, input: { title: string; header: string; basis: string; label: (row: YearToDateRow) => string }): LinkedReport {
  const tariff = matrix.view === 'tariff';
  return {
    table: {
      title: input.title,
      basis: input.basis,
      columns: [
        { header: input.header, type: 'text' },
        ...(tariff ? [{ header: 'Units', type: 'count' as const }] : []),
        ...matrix.monthKeys.map(monthKey => ({ header: formatMonthKey(monthKey), type: 'money' as const })),
        { header: 'Year to date', type: 'money' },
        { header: 'Share', type: 'percent' }
      ],
      rows: matrix.rows.map(row => [
        input.label(row),
        ...(tariff ? [row.quantity] : []),
        ...row.byMonth.map(amount),
        amount(row.totalCents),
        matrix.totalCents !== 0 ? row.totalCents / matrix.totalCents : null
      ] as CsvCell[]),
      totals: [
        'Total',
        ...(tariff ? [matrix.rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0)] : []),
        ...matrix.monthTotals.map(amount),
        amount(matrix.totalCents),
        matrix.rows.length > 0 ? 1 : null
      ],
      notes: [YEAR_TO_DATE_NOTES[matrix.view], 'Each month is the part of it up to the last day of the period chosen at the top of the page.']
    },
    targets: matrix.rows.map(() => null)
  };
}
