import { describe, expect, it } from 'vitest';
import {
  MAX_SEQUENTIAL_VALUE,
  PROVISIONAL_NUMBER_ATTEMPTS,
  clashingClaimReferences,
  formatSequentialInvoiceNumber,
  isInvoiceNumberClash,
  isSequentialInvoiceNumber,
  provisionalInvoiceNumber
} from '../invoiceNumber';
import { claimInvoiceReference } from '../claimLine';
import { numberKey } from '../../remittance/text';

describe('sequential invoice numbers (what the database assigns once the invoicing SQL is applied)', () => {
  it('pads the counter after the prefix, as INV-000123', () => {
    expect(formatSequentialInvoiceNumber(123)).toBe('INV-000123');
    expect(formatSequentialInvoiceNumber(1_234_567)).toBe('INV-1234567');
    expect(formatSequentialInvoiceNumber(7, 'DENT-', 4)).toBe('DENT-0007');
  });

  // A digit in the prefix would end up in claim field 24 and could make two invoices look the same to a fund
  it('refuses a prefix with digits and counters outside 1 to 99,999,999', () => {
    expect(() => formatSequentialInvoiceNumber(1, 'INV2-')).toThrow(/prefix/);
    expect(() => formatSequentialInvoiceNumber(0)).toThrow(RangeError);
    expect(() => formatSequentialInvoiceNumber(MAX_SEQUENTIAL_VALUE + 1)).toThrow(RangeError);
    expect(() => formatSequentialInvoiceNumber(1.5)).toThrow(RangeError);
  });

  // Field 24 holds 8 characters; the fund quotes it back on remittances, so each invoice needs its own reference
  it('gives every invoice of a practice its own claim reference (field 24), also as remittances compare it', () => {
    const numbers = Array.from({ length: 200_000 }, (_, index) => formatSequentialInvoiceNumber(index + 1));
    expect(clashingClaimReferences(numbers).size).toBe(0);
    expect(new Set(numbers.map(number => numberKey(claimInvoiceReference(number)))).size).toBe(numbers.length);
  });

  it('keeps the field-24 reference within 8 characters right up to the largest counter', () => {
    expect(claimInvoiceReference(formatSequentialInvoiceNumber(MAX_SEQUENTIAL_VALUE))).toBe('99999999');
    expect(claimInvoiceReference('INV-000123')).toBe('000123');
  });

  // Numbers issued before the change are kept: a new number must never reach a fund as an old invoice
  it('never reaches a fund as the same reference as a number issued before (INV + yymm + 5 digits)', () => {
    const old: string[] = [];
    for (let year = 2024; year <= 2029; year += 1) {
      for (let month = 1; month <= 12; month += 1) {
        for (const digits of [0, 1, 123, 99_999]) {
          old.push(`INV${String(year % 100).padStart(2, '0')}${String(month).padStart(2, '0')}${String(digits).padStart(5, '0')}`);
        }
      }
    }
    const fresh = Array.from({ length: 50_000 }, (_, index) => formatSequentialInvoiceNumber(index + 1));
    expect(clashingClaimReferences([...old, ...fresh]).size).toBe(0);
    const oldKeys = new Set(old.map(number => numberKey(claimInvoiceReference(number))));
    expect(fresh.some(number => oldKeys.has(numberKey(claimInvoiceReference(number))))).toBe(false);
  });

  it('recognises the sequential format only', () => {
    expect(isSequentialInvoiceNumber('INV-000123')).toBe(true);
    expect(isSequentialInvoiceNumber('INV261012345')).toBe(false);
    expect(isSequentialInvoiceNumber('INV-12')).toBe(false);
    expect(isSequentialInvoiceNumber(null)).toBe(false);
  });
});

describe('provisional numbers (stored until the database numbers invoices)', () => {
  const now = new Date(2026, 9, 7, 9, 30, 0, 0);

  it('keeps the format used so far: INV + yymm + 5 digits from the clock', () => {
    const number = provisionalInvoiceNumber(now);
    expect(number).toMatch(/^INV2610\d{5}$/);
    expect(number.slice(-5)).toBe(String(now.getTime() % 100_000).padStart(5, '0'));
  });

  // Before this change a clash failed the save; a retry now takes other digits
  it('takes other digits on a retry, so a clash does not fail the save', () => {
    expect(provisionalInvoiceNumber(now, 1, () => 0.123456)).toBe('INV261012345');
    expect(provisionalInvoiceNumber(now, 2, () => 0.999999)).toBe('INV261099999');
    expect(PROVISIONAL_NUMBER_ATTEMPTS).toBeGreaterThan(1);
  });

  it('dates the number in the practice calendar month', () => {
    expect(provisionalInvoiceNumber(new Date(2027, 0, 1, 0, 5))).toMatch(/^INV2701\d{5}$/);
  });
});

describe('recognising a number clash', () => {
  it('is a unique violation on the invoice number', () => {
    expect(isInvoiceNumberClash({ code: '23505', message: 'duplicate key value violates unique constraint "invoices_enhanced_invoice_number_key"' })).toBe(true);
    expect(isInvoiceNumberClash({ code: '23505', message: 'duplicate key', details: 'Key (practice_id, invoice_number)=(x, y) already exists.' })).toBe(true);
  });

  // Any other refusal is a real error and must reach the user, not be retried
  it('is not any other error', () => {
    expect(isInvoiceNumberClash({ code: '23505', message: 'duplicate key value violates unique constraint "visits_pkey"' })).toBe(false);
    expect(isInvoiceNumberClash({ code: '42501', message: 'invoice_number permission denied' })).toBe(false);
    expect(isInvoiceNumberClash(null)).toBe(false);
    expect(isInvoiceNumberClash('23505')).toBe(false);
  });
});
