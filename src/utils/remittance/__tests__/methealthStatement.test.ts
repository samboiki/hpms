/**
 * Methealth remittance statements (NMC, PSEMAS). Staff type these in by hand today; the import is
 * only worth having if every line is read with the right member, reference, date, code and amounts,
 * and if a misread can never be posted (the statement's own totals must add up). Values are invented.
 */
import { describe, expect, it } from 'vitest';
import { parseMethealthStatement } from '../methealthStatement';
import { reconciliationStatus } from '../parseRemittance';
import { displayTariff, tariffKey } from '../text';
import { methealthStatement, type MethealthLine } from './fixtures';

const line = (overrides: Partial<MethealthLine>): MethealthLine => ({
  member: '000111222', name: 'MRS A EXAMPLE', ref: '0000101', date: '15-09-26', tariff: '00190', claimed: 52000, paid: 52000, ...overrides
});

describe('Methealth remittance statement', () => {
  const pages = methealthStatement({
    fund: 'PSEMAS',
    pages: [[
      line({ tariff: '00190', claimed: 52000, paid: 52000 }),
      line({ tariff: '00308', claimed: 18000, paid: 17100, portion: 900 }),
      line({ tariff: '08109', claimed: 9500, paid: 0, code: '202' }),
      line({ member: '000333444', name: 'MR B SAMPLE', ref: '0000202', tariff: '00190', claimed: 52000, paid: 0, code: '175' })
    ]],
    legend: { '175': 'TARIFF QUANTITY MAXIMUM EXCEEDED', '202': 'TARIFF CODES CANNOT BE CHARGED TOGETHER. MEMBER NOT LIABLE' }
  });

  it('reads every claimed line with its identifiers and amounts, so each can be matched and posted', () => {
    const doc = parseMethealthStatement(pages);
    expect(doc.lines).toHaveLength(4);
    expect(doc.lines[1]).toMatchObject({
      memberNumber: '000111222', practiceReference: '0000101', serviceDate: '2026-09-15', tariffRaw: '00308',
      claimedCents: 18000, paidCents: 17100, memberPortionCents: 900, status: 'part_paid', reasonCodes: []
    });
    expect(doc.lines[2]).toMatchObject({ paidCents: 0, status: 'rejected', reasonCodes: ['202'] });
    expect(doc.lines[3]).toMatchObject({ memberNumber: '000333444', practiceReference: '0000202', reasonCodes: ['175'] });
  });

  it('knows the fund, the statement and the payment from the header, because the payment is posted once per statement', () => {
    const doc = parseMethealthStatement(pages);
    expect(doc).toMatchObject({
      fundName: 'PSEMAS', fundCode: 'MAG1', kind: 'payment', statementNumber: '0000123457', paymentReference: '0000123456',
      documentDate: '2026-10-06', paymentDate: '2026-10-06', totalPaidCents: 52000 + 17100
    });
  });

  it('keeps only the last 4 digits of the bank account the fund paid into (the full number is not needed and not stored)', () => {
    expect(parseMethealthStatement(pages).bankAccountLast4).toBe('3210');
  });

  it("explains reject codes in the fund's own words from the statement's legend (funds word them differently)", () => {
    const doc = parseMethealthStatement(pages);
    expect(doc.reasonLegend['202']).toMatch(/CANNOT BE CHARGED TOGETHER/);
    expect(doc.lines[2].reasonTexts[0]).toMatch(/MEMBER NOT LIABLE/);
  });

  it('adds up: every member subtotal and the statement total match the lines read', () => {
    const doc = parseMethealthStatement(pages);
    expect(doc.checks.length).toBeGreaterThanOrEqual(6);
    expect(doc.checks.every(check => check.ok)).toBe(true);
    expect(reconciliationStatus(doc).ok).toBe(true);
  });

  it('refuses to reconcile when a printed total disagrees with the lines, so a misread is never posted', () => {
    const tampered = methealthStatement({ fund: 'NMC', pages: [[line({})]], totalPaidOverride: 51000 });
    const status = reconciliationStatus(parseMethealthStatement(tampered));
    expect(status.ok).toBe(false);
    expect(status.failed.map(check => check.label)).toContain('Statement total paid');
  });

  it('keeps a long patient name that wraps onto its own row with its line, instead of losing the row or inventing a line', () => {
    const wrapped = methealthStatement({ fund: 'NMC', pages: [[line({ name: 'MS C VERYLONGFAMILY', nameWrap: 'NAMEPART' }), line({ name: 'MS C VERYLONGFAMILY', nameWrap: 'NAMEPART', tariff: '00308', claimed: 18000, paid: 18000 })]] });
    const doc = parseMethealthStatement(wrapped);
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines[0].patientName).toBe('MS C VERYLONGFAMILY NAMEPART');
    expect(reconciliationStatus(doc).ok).toBe(true);
  });

  it('follows a member whose lines continue on the next page, and skips the contact page at the end', () => {
    const split = methealthStatement({
      fund: 'NMC',
      pages: [[line({}), line({ tariff: '00308', claimed: 18000, paid: 18000 })], [line({ tariff: '00109', claimed: 4000, paid: 4000 })]]
    });
    const doc = parseMethealthStatement(split);
    expect(doc.lines.map(item => item.page)).toEqual([1, 1, 2]);
    expect(doc.checks.find(check => check.label === 'Member 1 subtotal: paid')).toMatchObject({ ok: true, expectedCents: 74000 });
    expect(reconciliationStatus(doc).ok).toBe(true);
  });

  it('treats codes of any discipline alike: Methealth pads codes to 5 characters, the claim used 4', () => {
    expect(displayTariff('08109')).toBe('8109');
    expect(displayTariff('00190')).toBe('0190');
    expect(tariffKey('00190')).toBe(tariffKey('0190'));
    expect(tariffKey('08109')).toBe(tariffKey('8109'));
    expect(tariffKey('00190')).not.toBe(tariffKey('0191'));
  });
});
