import { describe, expect, it } from 'vitest';
import { findDuplicateLines, type BilledLine, type CandidateLine } from '../invoiceDuplicates';
import { formatServiceDate } from '../dates';

const billed = (overrides: Partial<BilledLine> = {}): BilledLine => ({
  invoiceId: 'inv-old',
  invoiceNumber: 'INV-000041',
  visitId: 'visit-old',
  code: '8341',
  serviceDate: '2026-10-07',
  teeth: ['16'],
  status: 'pending',
  ...overrides
});

const candidate = (overrides: Partial<CandidateLine> = {}): CandidateLine => ({
  key: 'line-1',
  code: '8341',
  serviceDate: '2026-10-07',
  teeth: ['16'],
  ...overrides
});

describe('duplicate-invoice warning', () => {
  // The same filling on the same tooth on the same day, on two invoices, is claimed twice and refused as a duplicate
  it('warns when the same code, date and tooth is already on another invoice, naming that invoice', () => {
    const [warning] = findDuplicateLines([candidate()], [billed()]);
    expect(warning).toEqual({
      key: 'line-1',
      invoiceId: 'inv-old',
      invoiceNumber: 'INV-000041',
      visitId: 'visit-old',
      message: 'Code 8341 for tooth 16 on 7 Oct 2026 is already billed to this patient on invoice INV-000041. Check it is not billed twice.'
    });
  });

  it('warns for codes without a tooth (a GP consultation) on the same date', () => {
    const warnings = findDuplicateLines([candidate({ code: '0190', teeth: [] })], [billed({ code: '0190', teeth: [] })]);
    expect(warnings[0].message).toBe('Code 0190 on 7 Oct 2026 is already billed to this patient on invoice INV-000041. Check it is not billed twice.');
  });

  it('names the shared tooth when lines list several teeth', () => {
    const [warning] = findDuplicateLines([candidate({ teeth: ['11', '16'] })], [billed({ teeth: ['16', '17'] })]);
    expect(warning.message).toContain('for tooth 16 on');
  });

  // Different teeth, dates or codes are different services; a warning there would teach staff to ignore warnings
  it('does not warn for another tooth, another date or another code', () => {
    expect(findDuplicateLines([candidate({ teeth: ['17'] })], [billed()])).toEqual([]);
    expect(findDuplicateLines([candidate({ serviceDate: '2026-10-08' })], [billed()])).toEqual([]);
    expect(findDuplicateLines([candidate({ code: '8342' })], [billed()])).toEqual([]);
    expect(findDuplicateLines([candidate({ teeth: [] })], [billed()])).toEqual([]);
  });

  it("ignores the invoice being edited and cancelled invoices", () => {
    expect(findDuplicateLines([candidate()], [billed()], { excludeInvoiceId: 'inv-old' })).toEqual([]);
    expect(findDuplicateLines([candidate()], [billed({ status: 'Cancelled' })])).toEqual([]);
  });

  it('compares codes without case or spaces and skips lines without a date', () => {
    expect(findDuplicateLines([candidate({ code: ' 8341 ' })], [billed()])).toHaveLength(1);
    expect(findDuplicateLines([candidate({ serviceDate: null })], [billed()])).toEqual([]);
    expect(findDuplicateLines([candidate()], [billed({ serviceDate: null })])).toEqual([]);
  });
});

describe('day-first dates', () => {
  it('writes dates as Namibian staff read them', () => {
    expect(formatServiceDate('2026-10-07')).toBe('7 Oct 2026');
    expect(formatServiceDate('2026-01-31T22:00:00Z')).toBe('31 Jan 2026');
    expect(formatServiceDate(new Date(2026, 11, 25))).toBe('25 Dec 2026');
    expect(formatServiceDate('2026-02-30')).toBe('-');
    expect(formatServiceDate(null)).toBe('-');
  });
});
