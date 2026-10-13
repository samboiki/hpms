/**
 * VAT (owner decision, 13 Oct 2026; parity D20, R9, R12, R14, J4).
 *
 * - Each practice says whether it is VAT registered, with its VAT number (Settings > Practice). It is kept in one
 *   practice_settings row ('vat_settings'): only administrators change it, every screen and document reads it.
 * - When it is registered, VAT (15 %) applies only to lines whose stock item is VAT-able (frames, over-the-counter
 *   medicines, other stock). Services (consultations, procedures) are exempt. A stock item is VAT-able unless its VAT
 *   rate is 0 (Stock > item); the rate is the item's own, else the practice's default in Stock > Settings.
 * - Until a practice says it is registered (or when the setting cannot be read), nothing carries VAT: prices from the
 *   stock price rule add no VAT, invoices show none and gross profit takes none off.
 * - Selling prices include VAT, so the VAT on a line is the part of its total above total x 100 / (100 + rate), split
 *   exactly as the stock price rule splits a fixed price (src/utils/stock/pricing.ts), so the two never disagree.
 */

import { formatNad, fromCents } from './money';

export const VAT_SETTINGS_KEY = 'vat_settings';

/** Namibia's standard VAT rate, the default of Stock > Settings */
export const STANDARD_VAT_RATE = 15;

export const VAT_NUMBER_MAX = 30;

export interface VatSettings {
  registered: boolean;
  /** As the practice writes it; empty when not registered */
  vatNumber: string;
}

export const NOT_VAT_REGISTERED: VatSettings = { registered: false, vatNumber: '' };

/** The stored value (an object, or JSON text) made safe; anything unreadable: not registered */
export function parseVatSettings(value: unknown): VatSettings {
  let json: unknown = value;
  if (typeof value === 'string') {
    try {
      json = JSON.parse(value);
    } catch {
      json = null;
    }
  }
  const row = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const registered = row.registered === true;
  const vatNumber = typeof row.vat_number === 'string' ? row.vat_number.trim().slice(0, VAT_NUMBER_MAX) : '';
  return registered ? { registered, vatNumber } : NOT_VAT_REGISTERED;
}

export const vatSettingsJson = (settings: VatSettings): Record<string, unknown> => ({
  registered: settings.registered,
  vat_number: settings.registered ? settings.vatNumber.trim() : ''
});

/** A registered practice prints its VAT number on every tax invoice, so it is needed */
export function checkVatSettings(settings: VatSettings): { ok: boolean; error: string | null } {
  if (!settings.registered) return { ok: true, error: null };
  const number = settings.vatNumber.trim();
  if (!number) return { ok: false, error: 'Type the VAT number: it is printed on every invoice.' };
  if (number.length > VAT_NUMBER_MAX) return { ok: false, error: `The VAT number can be at most ${VAT_NUMBER_MAX} characters.` };
  if (!/^[A-Za-z0-9 /-]+$/.test(number)) return { ok: false, error: 'The VAT number can have letters, digits, spaces, "/" and "-" only.' };
  return { ok: true, error: null };
}

/**
 * The VAT rate a line is sold at: 0 unless the practice is registered and the line is a VAT-able stock item.
 * `itemRate`: the item's own rate (null: the practice default); `item` absent: a service, exempt.
 */
export function lineVatRate(settings: VatSettings, item: { vatRate: number | null } | null | undefined, defaultRate: number = STANDARD_VAT_RATE): number {
  if (!settings.registered || !item) return 0;
  const rate = item.vatRate ?? defaultRate;
  return rate > 0 ? rate : 0;
}

/** Whether a stock item carries VAT when the practice is registered */
export const isVatable = (item: { vatRate: number | null }): boolean => item.vatRate === null || item.vatRate > 0;

/** a / b rounded half up, for non-negative integers (as the stock price rule) */
const divideRoundHalfUp = (a: number, b: number): number => Math.floor((2 * a + b) / (2 * b));

/** The VAT inside a VAT-inclusive amount in cents (negative amounts, such as credits, give negative VAT) */
export function vatInCents(totalCents: number, rate: number): number {
  if (totalCents === 0 || !(rate > 0)) return 0;
  const magnitude = Math.abs(totalCents);
  const vat = magnitude - divideRoundHalfUp(magnitude * 100, 100 + rate);
  return totalCents < 0 ? -vat : vat;
}

export interface VatLine {
  totalCents: number;
  rate: number;
}

export interface VatSummary {
  /** All lines, VAT included */
  totalCents: number;
  /** Lines with VAT, VAT included */
  vatableCents: number;
  /** Lines without VAT (services, and everything while not registered) */
  exemptCents: number;
  vatCents: number;
  /** Total less VAT */
  exclVatCents: number;
  /** The rates on the lines, for the label ("VAT 15 %") */
  rates: number[];
}

/** VAT of a document's lines, each worked out on its own line (as the price rule priced it) */
export function summariseVat(lines: readonly VatLine[]): VatSummary {
  const summary = lines.reduce(
    (sum, line) => {
      const vat = vatInCents(line.totalCents, line.rate);
      const taxed = line.rate > 0;
      if (taxed && !sum.rates.includes(line.rate)) sum.rates.push(line.rate);
      return {
        ...sum,
        totalCents: sum.totalCents + line.totalCents,
        vatableCents: sum.vatableCents + (taxed ? line.totalCents : 0),
        exemptCents: sum.exemptCents + (taxed ? 0 : line.totalCents),
        vatCents: sum.vatCents + vat
      };
    },
    { totalCents: 0, vatableCents: 0, exemptCents: 0, vatCents: 0, exclVatCents: 0, rates: [] as number[] }
  );
  return { ...summary, exclVatCents: summary.totalCents - summary.vatCents, rates: [...summary.rates].sort((a, b) => a - b) };
}

export const vatRateLabel = (rates: readonly number[]): string =>
  rates.length === 0 ? 'VAT' : `VAT ${rates.map(rate => `${Number.isInteger(rate) ? rate : rate.toFixed(2)} %`).join(', ')}`;


/** The line a statement of a VAT-registered practice carries at its foot (null: not registered) */
export const vatStatementNote = (settings: VatSettings): string | null =>
  settings.registered ? `VAT no ${settings.vatNumber}. Invoice amounts include VAT on VAT-able stock items only; services are VAT exempt.` : null;

/** The sentence a tax invoice carries under its totals */
export function vatStatement(summary: VatSummary): string {
  if (summary.vatCents === 0) return 'No VAT is charged on this invoice: services are VAT exempt.';
  return `Prices include ${vatRateLabel(summary.rates)} on the stock items (${formatNad(fromCents(summary.vatCents))} VAT in ${formatNad(fromCents(summary.vatableCents))}). Services are VAT exempt.`;
}
