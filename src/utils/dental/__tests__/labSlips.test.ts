import { describe, expect, it } from 'vitest';
import type { ClaimLine } from '../../billing/claimLine';
import {
  LAB_FEE_CODE,
  emptySlipLine,
  labSlipTotalCents,
  matchLabSlips,
  pairLabSlips,
  parseSlipAmount,
  validateLabSlipDraft,
  withLabDetails,
  type BilledLabOrder
} from '../labSlips';

const claimLine = (values: Partial<ClaimLine>): ClaimLine => ({
  key: 'line-1',
  transactionNumber: 1,
  systemTransactionNumber: 70001,
  invoiceId: 'inv-1',
  invoiceNumber: '501',
  visitId: 'visit-1',
  fundReference: 'NMC1',
  membershipNumber: '99887766',
  memberSurname: 'TESTER',
  memberInitials: 'AB',
  patientName: 'Alex Tester',
  patientDateOfBirth: '1980-01-01',
  patientIdNumber: '80010100011',
  patientReference: '42',
  gender: 'F',
  tariffCode: LAB_FEE_CODE,
  description: 'Dental technician fees',
  serviceDate: '2026-10-13',
  quantity: 1,
  amount: 1970,
  practiceNumber: '0540000000001',
  treatingDoctorHpcnaNumber: 'DEN00001',
  icd10Primary: 'K02.1',
  icd10Secondary: [],
  icd10Confirmed: true,
  toothNumbers: '',
  ...values
});

const order = (values: Partial<BilledLabOrder>): BilledLabOrder => ({
  id: 'order-1',
  orderNo: 12,
  billedVisitId: 'visit-1',
  slipNumber: 'LS-4471',
  labName: 'Alpha Dental Lab',
  lines: [
    { code: '9330', description: 'Porcelain fused to metal crown', amountCents: 185000 },
    { code: null, description: 'Model and die', amountCents: 12000 }
  ],
  ...values
});

// Business rule: the practice types the lab's invoice as the lab wrote it; every line needs what it is and its amount,
// because the fund pays the lab's lines, not a lump sum
describe('the lab\'s invoice as typed', () => {
  it('keeps the filled lines, tidies them and totals them in cents', () => {
    const result = validateLabSlipDraft({
      slipNumber: ' LS-4471 ',
      lines: [
        { code: ' 9330', description: '  Porcelain  fused to metal crown ', amount: 'N$ 1,850.00' },
        emptySlipLine(),
        { code: '', description: 'Model and die', amount: '120' }
      ]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({
        slip_number: 'LS-4471',
        lines: [
          { code: '9330', description: 'Porcelain fused to metal crown', amount: 1850 },
          { code: null, description: 'Model and die', amount: 120 }
        ]
      });
      expect(result.totalCents).toBe(197000);
    }
  });

  it('marks a line without what was made or without a usable amount', () => {
    const result = validateLabSlipDraft({ slipNumber: '', lines: [{ code: '', description: '', amount: '100' }, { code: '9330', description: 'Crown', amount: '12.345' }] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.byLine[0]?.description).toBeDefined();
      expect(result.errors.byLine[1]?.amount).toBeDefined();
    }
  });

  it('refuses an invoice number the claim field cannot carry and more than 30 lines', () => {
    expect(validateLabSlipDraft({ slipNumber: 'LS 44 71', lines: [] }).ok).toBe(false);
    const many = Array.from({ length: 31 }, (_, index) => ({ code: '', description: `Line ${index + 1}`, amount: '1' }));
    const result = validateLabSlipDraft({ slipNumber: '', lines: many });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.lines).toMatch(/30/);
  });

  it('lets an invoice with no lines take the lines off (typed on the wrong order)', () => {
    const result = validateLabSlipDraft({ slipNumber: '', lines: [emptySlipLine()] });
    expect(result.ok && result.payload.lines).toEqual([]);
  });

  it('reads amounts as staff type them, never a negative or zero amount', () => {
    expect(parseSlipAmount('1 850.5')).toBe(1850.5);
    expect(parseSlipAmount('0')).toBeNull();
    expect(parseSlipAmount('-5')).toBeNull();
    expect(parseSlipAmount('abc')).toBeNull();
  });
});

// Business rule: a fund pays 8099 only with the lab's lines straight after it, adding up to it (QEDI type L; NAMAF
// rule 010). The batch must not go with an 8099 line that has none, or whose lines do not add up.
describe('each 8099 claim line and its lab invoice', () => {
  it('pairs an 8099 line with the order billed at its visit whose lines add up to it', () => {
    const pairing = pairLabSlips([claimLine({})], [order({})]);
    expect(pairing.issues).toEqual([]);
    expect(pairing.orders.get('line-1')?.orderNo).toBe(12);
    expect(labSlipTotalCents(order({}).lines)).toBe(197000);
  });

  it('stops an 8099 line with no lab order billed at its visit, saying where to bill it', () => {
    const pairing = pairLabSlips([claimLine({})], [order({ billedVisitId: 'visit-2' })]);
    expect(pairing.issues).toHaveLength(1);
    expect(pairing.issues[0]).toMatchObject({ lineKey: 'line-1', severity: 'error' });
    expect(pairing.issues[0].message).toMatch(/Billing tab/);
  });

  it('stops an 8099 line whose order has no invoice lines yet', () => {
    const pairing = pairLabSlips([claimLine({})], [order({ lines: [] })]);
    expect(pairing.issues[0].message).toMatch(/Order 12 has none of the lab's invoice lines/);
  });

  it('stops an 8099 line whose lab lines add up to another amount, naming both amounts', () => {
    const pairing = pairLabSlips([claimLine({ amount: 1900 })], [order({})]);
    expect(pairing.issues[0].message).toContain('N$ 1,970.00');
    expect(pairing.issues[0].message).toContain('N$ 1,900.00');
  });

  it('pairs two 8099 lines of one visit each with its own order, by amount', () => {
    const lines = [claimLine({ key: 'a', transactionNumber: 1, amount: 4200 }), claimLine({ key: 'b', transactionNumber: 2, amount: 1970 })];
    const orders = [order({ id: 'o-crown', orderNo: 12 }), order({ id: 'o-bridge', orderNo: 13, lines: [{ code: '9350', description: 'Bridge', amountCents: 420000 }] })];
    const pairing = pairLabSlips(lines, orders);
    expect(pairing.issues).toEqual([]);
    expect(pairing.orders.get('a')?.id).toBe('o-bridge');
    expect(pairing.orders.get('b')?.id).toBe('o-crown');
  });

  it('uses each order once: a second 8099 line of the same amount is stopped', () => {
    const pairing = pairLabSlips([claimLine({ key: 'a', transactionNumber: 1 }), claimLine({ key: 'b', transactionNumber: 2 })], [order({})]);
    expect(pairing.orders.size).toBe(1);
    expect(pairing.issues.map(issue => issue.lineKey)).toEqual(['b']);
  });

  it('leaves every other line alone (only 8099 lines need a lab invoice)', () => {
    expect(pairLabSlips([claimLine({ tariffCode: '8101', amount: 254.7 })], []).issues).toEqual([]);
  });

  it('gives a paired line its lab lines and invoice number for the claim file, in N$', () => {
    const lines = [claimLine({}), claimLine({ key: 'other', tariffCode: '8101', amount: 254.7 })];
    const carried = withLabDetails(lines, pairLabSlips(lines, [order({})]));
    expect(carried[0].labDetails).toEqual([
      { code: '9330', description: 'Porcelain fused to metal crown', amount: 1850 },
      { code: null, description: 'Model and die', amount: 120 }
    ]);
    expect(carried[0].labSlipNumber).toBe('LS-4471');
    expect(carried[1]).toBe(lines[1]);
  });

  it('matches by exact cents, which the visit card uses too', () => {
    const match = matchLabSlips([{ key: 'x', cents: 197000 }, { key: 'y', cents: 5 }], [{ id: 'o', lines: [{ amountCents: 197000 }] }]);
    expect([...match.paired.keys()]).toEqual(['x']);
    expect(match.unpairedLines.map(line => line.key)).toEqual(['y']);
    expect(match.unpairedOrders).toEqual([]);
  });
});
