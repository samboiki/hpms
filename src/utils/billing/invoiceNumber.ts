/**
 * Invoice numbers.
 *
 * Business rules (D11):
 * - Once proposals/2026-10-07-invoicing.sql is applied, the DATABASE numbers every new invoice per practice in
 *   sequence (INV-000001, INV-000002, ...). The number is taken inside the same transaction as the insert, so two
 *   invoices never get the same number and a save that fails uses no number (no gaps). Numbers already issued are
 *   kept as they are.
 * - The app always sends a provisional number; once the database numbers invoices it replaces it, before that it is
 *   what is stored: INV + yymm + 5 digits (the format used so far). When that number is already taken (the database
 *   refuses it as a duplicate) the save is retried with another number instead of failing.
 * - Claim field 24 carries at most 8 characters: the last 8 digits of the number (claimInvoiceReference). The
 *   sequential prefix has no digits, so a new number's claim reference is its counter, unique up to 99,999,999
 *   invoices, and shorter than the 8-digit references of the provisional numbers, so the two never meet.
 */
import { claimInvoiceReference } from './claimLine.ts';

/** Mirrors the database default (invoice_number_series): the prefix has no digits, the counter is zero-padded. */
export const SEQUENTIAL_PREFIX = 'INV-';
export const SEQUENTIAL_WIDTH = 6;
export const MAX_SEQUENTIAL_VALUE = 99_999_999;

/** How often a save is tried again with a new provisional number after a duplicate. */
export const PROVISIONAL_NUMBER_ATTEMPTS = 3;

/** The sequential number the database gives counter value `value` ("INV-000123"). */
export function formatSequentialInvoiceNumber(value: number, prefix: string = SEQUENTIAL_PREFIX, width: number = SEQUENTIAL_WIDTH): string {
  if (!Number.isInteger(value) || value < 1 || value > MAX_SEQUENTIAL_VALUE) {
    throw new RangeError(`An invoice counter must be a whole number from 1 to ${MAX_SEQUENTIAL_VALUE}: ${value}`);
  }
  if (/\d/.test(prefix)) throw new RangeError(`An invoice number prefix may not contain digits: ${prefix}`);
  return `${prefix}${String(value).padStart(width, '0')}`;
}

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

/**
 * A provisional number: INV + yymm + 5 digits. The first attempt takes the digits from the clock (as before);
 * a retry after a duplicate takes random digits.
 */
export function provisionalInvoiceNumber(now: Date, attempt = 0, random: () => number = Math.random): string {
  const yymm = `${pad(now.getFullYear() % 100, 2)}${pad(now.getMonth() + 1, 2)}`;
  const digits = attempt === 0 ? now.getTime() % 100_000 : Math.floor(random() * 100_000) % 100_000;
  return `INV${yymm}${pad(digits, 5)}`;
}

/** True when the database refused an invoice because its number is already used (unique violation 23505). */
export function isInvoiceNumberClash(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message, details } = error as { code?: string; message?: string; details?: string };
  if (code !== '23505') return false;
  return /invoice_number/i.test(`${message ?? ''} ${details ?? ''}`);
}

/** True for a number in the sequential format ("INV-000123"). */
export const isSequentialInvoiceNumber = (invoiceNumber: string | null | undefined, prefix: string = SEQUENTIAL_PREFIX): boolean =>
  new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d{${SEQUENTIAL_WIDTH},}$`).test((invoiceNumber ?? '').trim());

/**
 * Invoices whose numbers would reach a fund as the same field-24 reference (claimInvoiceReference), grouped by that
 * reference; empty when every reference is unique.
 */
export function clashingClaimReferences(invoiceNumbers: readonly string[]): Map<string, string[]> {
  const byReference = new Map<string, Set<string>>();
  invoiceNumbers.forEach(number => {
    const reference = claimInvoiceReference(number);
    byReference.set(reference, (byReference.get(reference) ?? new Set<string>()).add(number));
  });
  const clashes = new Map<string, string[]>();
  byReference.forEach((numbers, reference) => {
    if (numbers.size > 1) clashes.set(reference, [...numbers].sort());
  });
  return clashes;
}
