import { format, parseISO } from 'date-fns';
import { daysPastDue, type DateRange, type LedgerInvoice } from '../../services/ledgerService';
import { formatNad as formatNamibianDollars } from '../../utils/billing/money';

/**
 * Namibian dollars to the cent in the app's one N$ format (src/utils/billing/money.ts), e.g. "N$ 1,234.50" or
 * "-N$ 80.00", so every Finance screen writes amounts the same way. A figure that could not be worked out (NaN) shows
 * as N$ 0.00 rather than breaking the screen.
 */
export function formatNad(amount: number): string {
  return formatNamibianDollars(Number.isFinite(amount) ? amount : 0);
}

const compactNumber = (value: number): string => value.toLocaleString('en-NA', { maximumFractionDigits: 1 });

/** Short labels for chart axes: N$950, N$12.5k, N$1.2m */
export function formatNadCompact(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}N$${compactNumber(abs / 1_000_000)}m`;
  if (abs >= 1_000) return `${sign}N$${compactNumber(abs / 1_000)}k`;
  return `${sign}N$${Math.round(abs)}`;
}

export const formatCount = (value: number): string => value.toLocaleString('en-NA');

/** A 0..1 share as a percentage; a dash when there is nothing to divide by */
export const formatPercent = (share: number | null | undefined, digits = 1): string =>
  share === null || share === undefined || !Number.isFinite(share) ? '—' : `${(share * 100).toFixed(digits)}%`;

/** A percentage change with its sign, e.g. +12.4% */
export const formatChange = (percent: number | null): string =>
  percent === null || !Number.isFinite(percent) ? '—' : `${percent > 0 ? '+' : ''}${percent.toFixed(1)}%`;

/** A local calendar date key (yyyy-MM-dd) for display */
export const formatDateKey = (key: string | null | undefined, pattern = 'd MMM yyyy'): string =>
  key ? format(parseISO(key), pattern) : '—';

export const formatMonthKey = (monthKey: string, pattern = 'MMM yyyy'): string => format(parseISO(`${monthKey}-01`), pattern);

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : format(date, 'd MMM yyyy, HH:mm');
}

/** "1-6 Oct 2026", "1 Aug - 6 Oct 2026" or "1 Nov 2025 - 6 Oct 2026" (en dashes) */
export function formatRangeLabel(range: DateRange): string {
  const start = parseISO(range.startKey);
  const end = parseISO(range.endKey);
  if (range.startKey === range.endKey) return format(end, 'd MMM yyyy');
  if (range.startKey.slice(0, 7) === range.endKey.slice(0, 7)) return `${format(start, 'd')}–${format(end, 'd MMM yyyy')}`;
  if (range.startKey.slice(0, 4) === range.endKey.slice(0, 4)) return `${format(start, 'd MMM')} – ${format(end, 'd MMM yyyy')}`;
  return `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`;
}

export const pluralize = (count: number, singular: string, plural = `${singular}s`): string =>
  `${formatCount(count)} ${count === 1 ? singular : plural}`;

/** "Paid", "Due in 5 days", "Due today" or "12 days past due" */
export function describeInvoiceAge(invoice: LedgerInvoice, todayKey: string): string {
  if (invoice.status === 'paid') return 'Paid';
  if (invoice.status === 'cancelled') return 'Cancelled';
  const days = daysPastDue(invoice, todayKey);
  if (days === null) return 'No due date';
  if (days < 0) return `Due in ${pluralize(-days, 'day')}`;
  if (days === 0) return 'Due today';
  return `${pluralize(days, 'day')} past due`;
}
