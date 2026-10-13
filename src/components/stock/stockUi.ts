/**
 * Shared look of the stock screens: buttons, inputs, money and day-first dates (the small components are in
 * stockParts.tsx). Buttons, inputs and links use the app's action colour (cyan; the optometry screens share them);
 * Stock's own section colour marks the section: header icon, selected tab, card icons, its tiles.
 */
import { toast } from 'react-hot-toast';
import { SECTION_COLORS } from '../../config/sectionColors';
import { formatServiceDate } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import { dayOf } from '../../utils/stock/supplierLedger';
import { printReport, type ReportTable } from '../finance/financeExport';

/** Stock's section colour (defined once in src/config/sectionColors.ts) */
export const STOCK_COLOR = SECTION_COLORS.stock;

// The buttons live in stockButtons.ts (the sign-in screen's load-failure notice needs them without this module)
export { PRIMARY, SECONDARY, QUIET, DANGER } from './stockButtons';
export const INPUT =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 disabled:bg-gray-50 disabled:text-gray-500';
export const LABEL = 'mb-1.5 block text-sm font-medium text-gray-700';
export const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm';
export const LINK = 'font-medium text-cyan-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded';

/** N$ from cents: "N$ 1,234.50" */
export const nad = (cents: number): string => formatNad(fromCents(cents));

/** Day first, as Namibian staff write it: "7 Oct 2026" */
export const day = (key: string | null | undefined): string => formatServiceDate(key ?? null);

/** When something happened, in Windhoek: "7 Oct 2026, 14:05" (empty when it did not happen) */
export const dayTime = (timestamp: string | null | undefined): string =>
  timestamp
    ? `${day(dayOf(timestamp))}, ${new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Windhoek' })}`
    : '';

export const errorText = (error: unknown, fallback = 'Something went wrong. Try again.'): string =>
  error instanceof Error && error.message ? error.message : fallback;

/** Prints a report, or says the browser blocked the print window (a blocked print did nothing at all). */
export function printOrSay(report: ReportTable, practiceName: string): boolean {
  if (printReport(report, practiceName)) return true;
  toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  return false;
}

/** "1 tablet", "30 tablets", "2 boxes": the unit as staff typed it, pluralised the simple way */
export function units(quantity: number, unit: string): string {
  const word = unit.trim() || 'units';
  if (Math.abs(quantity) === 1 || /s$|ml$|^g$|^mg$|^each$/i.test(word)) return `${quantity} ${word}`;
  return `${quantity} ${/(x|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`}`;
}
