import { addDaysToKey, isValidDateKey } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import type { BalancePortion } from '../../utils/import/eminanceBalances';
import type { FileUse } from '../../utils/import/importFiles';

/** Words shared by the Eminance import screens (Settings > Move over from Eminance) */

export const USE_LABELS: Readonly<Record<FileUse, string>> = {
  patients: 'Patient list',
  balances: 'Age analysis (balances)',
  recalls: 'Recall list',
  claims: 'Claim file (claim history)',
  ignore: 'Leave this file out'
};

export const PORTION_LABELS: Readonly<Record<BalancePortion, string>> = {
  both: 'Both portions (medical aid and patient together)',
  medical_aid: 'Medical aid portion only',
  patient: 'Patient portion only'
};

export const NOT_SET_UP_MESSAGE =
  // Staff read this: the database change behind it is proposals/2026-10-07-eminance-import.sql (after the receipts,
  // debtors, patient list and invoicing changes)
  'Moving over from Eminance is not switched on for your practice yet, so nothing can be imported. Please contact OneHealth support.';

/** The earliest "balances as at" day the database accepts: an age analysis older than a year is out of date */
export const oldestBalancesDate = (today: string): string => addDaysToKey(today, -366);

/** What is wrong with the "balances as at" day, or null (legacy_import_start checks the same) */
export function balancesDateProblem(asOf: string, today: string): string | null {
  if (!isValidDateKey(asOf)) return 'Enter the day the age analysis was run.';
  if (asOf > today) return 'The day cannot be in the future.';
  if (asOf < oldestBalancesDate(today)) return 'The age analysis is more than a year old: run it again in Eminance and export it.';
  return null;
}

export const nad = (cents: number): string => formatNad(fromCents(cents));
export const count = (value: number): string => value.toLocaleString('en-US');
export const plural = (value: number, one: string, many: string): string => `${count(value)} ${value === 1 ? one : many}`;

export interface ListedRow {
  key: string;
  line?: number | null;
  account?: string | null;
  label: string;
  reason?: string | null;
}

/** Rows grouped by their reason, most common first */
export function groupByReason(rows: readonly ListedRow[]): Array<{ reason: string; rows: ListedRow[] }> {
  const groups = new Map<string, ListedRow[]>();
  for (const row of rows) {
    const reason = row.reason || 'No reason given';
    const group = groups.get(reason);
    if (group) group.push(row);
    else groups.set(reason, [row]);
  }
  return [...groups.entries()].map(([reason, items]) => ({ reason, rows: items })).sort((a, b) => b.rows.length - a.rows.length);
}
