/**
 * Discounts on invoices (parity D19): their own entry off what the patient pays, never a change to the invoice or what
 * the medical aid is claimed; given by an administrator or practitioner, with a reason; a percentage is of what the
 * patient was charged, to the cent. Shown in balances, statements, the daybook and control totals. Invented figures.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DISCOUNT_REASONS,
  adjustmentReversalEffect,
  buildStatement,
  canGiveDiscounts,
  checkAdjustmentReversal,
  controlSummary,
  describeDaybookEntry,
  discountBaseCents,
  discountReasonText,
  discountedPortions,
  invoiceFigures,
  ledgerMovements,
  normalizeAdjustment,
  normalizeDaybookEntry,
  parsePercentInput,
  percentText,
  planDiscount,
  standingDiscounts,
  totalMovements,
  type ArAdjustment,
  type DiscountDraft
} from '../ledgerService';
import { buildAdjustmentPayload } from '../../components/finance/receipts/arPayloads';
import { invoice } from './ledgerTestUtils';

const discount = (overrides: Partial<ArAdjustment> = {}): ArAdjustment => ({
  id: 'd1', number: 'DS-000001', kind: 'discount', invoiceId: 'inv-a', receiptId: null, patientId: 'p1', portion: 'patient',
  amountCents: 3000, method: null, reasonCode: 'pensioner', reason: 'Pensioner', approvedBy: 'doc', effectiveOn: '2026-10-12',
  createdBy: 'doc', createdAt: '2026-10-12T09:00:00+02:00', reversal: null, ...overrides
});

const draft = (overrides: Partial<DiscountDraft> = {}): DiscountDraft => ({ mode: 'amount', amountCents: 3000, percent: null, reasonCode: 'pensioner', note: '', ...overrides });

describe('who may give a discount', () => {
  it('administrators and practitioners give discounts and reception does not, because a discount is money the practice gives away', () => {
    expect(canGiveDiscounts('admin')).toBe(true);
    expect(canGiveDiscounts('doctor')).toBe(true);
    expect(canGiveDiscounts('receptionist')).toBe(false);
    expect(canGiveDiscounts('nurse')).toBe(false);
    expect(planDiscount(draft(), { baseCents: 30000, patientOwesCents: 30000 }, 'receptionist').error).toMatch(/administrator or practitioner/);
  });

  it('taking a discount back needs the same people, because the patient owes the money again', () => {
    expect(checkAdjustmentReversal(discount(), { medical_aid: 70000, patient: 27000 }, 'receptionist').ok).toBe(false);
    expect(checkAdjustmentReversal(discount(), { medical_aid: 70000, patient: 27000 }, 'doctor').ok).toBe(true);
    expect(adjustmentReversalEffect(discount())).toEqual({ medical_aid: 0, patient: 3000 });
  });
});

describe('what a discount comes off', () => {
  it("is what the patient was charged (their portion plus a shortfall moved to them), never the medical aid's claim", () => {
    expect(discountBaseCents({ billed: { medical_aid: 70000, patient: 30000 }, shortfallCents: 0 })).toBe(30000);
    expect(discountBaseCents({ billed: { medical_aid: 70000, patient: 0 }, shortfallCents: 12000 })).toBe(12000);
  });

  it('a percentage becomes an amount to the cent, rounded half up as the database checks it', () => {
    const ten = planDiscount(draft({ mode: 'percent', amountCents: null, percent: 10 }), { baseCents: 30000, patientOwesCents: 30000 }, 'doctor');
    expect(ten.plan).toMatchObject({ amountCents: 3000, percent: 10 });
    // 12.5 % of N$ 333.00 is N$ 41.625: the patient gets N$ 41.63 off
    expect(planDiscount(draft({ mode: 'percent', amountCents: null, percent: 12.5 }), { baseCents: 33300, patientOwesCents: 33300 }, 'admin').plan?.amountCents).toBe(4163);
  });

  it('is never more than the patient still owes, and says how to give back money already paid', () => {
    const result = planDiscount(draft({ amountCents: 28000 }), { baseCents: 30000, patientOwesCents: 27000 }, 'admin');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/N\$\s?270\.00.*credit note and a refund/);
  });

  it('is refused on an invoice the medical aid pays all of, explaining that a claim is corrected with a credit note', () => {
    const result = planDiscount(draft(), { baseCents: 0, patientOwesCents: 0 }, 'admin');
    expect(result.error).toMatch(/never lowers what the medical aid is claimed/);
  });

  it('needs a reason, and "Other" needs a few words, so the discount listing can say why', () => {
    expect(planDiscount(draft({ reasonCode: '' }), { baseCents: 30000, patientOwesCents: 30000 }, 'admin').error).toMatch(/Choose why/);
    expect(planDiscount(draft({ reasonCode: 'other', note: ' ' }), { baseCents: 30000, patientOwesCents: 30000 }, 'admin').error).toMatch(/Say in a few words/);
    const withNote = planDiscount(draft({ reasonCode: 'other', note: 'Agreed at the counter' }), { baseCents: 30000, patientOwesCents: 30000 }, 'admin');
    expect(withNote.plan?.reason).toBe('Agreed at the counter');
    // Without a note the reason's own words are kept (the database needs a reason)
    expect(planDiscount(draft(), { baseCents: 30000, patientOwesCents: 30000 }, 'admin').plan?.reason).toBe('Pensioner');
  });

  it('reads percentages the way staff type them and refuses the impossible ones', () => {
    expect(parsePercentInput('10')).toBe(10);
    expect(parsePercentInput('12,5 %')).toBe(12.5);
    expect(parsePercentInput('0')).toBeNull();
    expect(parsePercentInput('101')).toBeNull();
    expect(parsePercentInput('12.345')).toBeNull();
    expect(percentText(12.5)).toBe('12.5%');
    expect(percentText(10)).toBe('10%');
  });

  it('offers exactly the reasons the database accepts, so no discount is refused for its reason', () => {
    const sql = readFileSync(resolve(__dirname, '../../../proposals/2026-10-13-discounts-and-statements.sql'), 'utf8');
    const list = /reason_code IN \(([^)]*)\)/.exec(sql)?.[1] ?? '';
    const codes = [...list.matchAll(/'([a-z_]+)'/g)].map(match => match[1]);
    expect(codes).toEqual(DISCOUNT_REASONS.map(reason => reason.code));
  });
});

describe('a discount in the books', () => {
  it("takes off the patient's portion only, so what the fund owes on the claim does not move", () => {
    const figures = invoiceFigures({ medical_aid: 70000, patient: 30000 }, [], [discount()]);
    expect(figures.outstanding).toEqual({ medical_aid: 70000, patient: 27000 });
    expect(figures.discounted).toEqual({ medical_aid: 0, patient: 3000 });
    expect(discountedPortions([discount(), discount({ id: 'd2', number: 'DS-000002', reversal: { at: '2026-10-12T10:00:00Z', by: 'doc', reason: 'Wrong invoice' } })])).toEqual({ medical_aid: 0, patient: 3000 });
  });

  it('a taken-back discount no longer counts, but stays in the history', () => {
    const back = discount({ reversal: { at: '2026-10-12T10:00:00Z', by: 'doc', reason: 'Wrong invoice' } });
    expect(invoiceFigures({ medical_aid: 0, patient: 30000 }, [], [back]).outstanding.patient).toBe(30000);
    expect(standingDiscounts([back]).totalCents).toBe(0);
  });

  it('shows on the statement as its own line with its reason, and its reversal puts the amount back', () => {
    const statement = buildStatement({
      patientId: 'p1',
      invoices: [{ id: 'inv-a', invoiceNumber: 'INV-0001', dateKey: '2026-10-12', billed: { medical_aid: 70000, patient: 30000 }, cancelled: false }],
      receipts: [],
      allocations: [],
      adjustments: [discount({ reason: 'Pensioner', reversal: { at: '2026-10-13T08:00:00+02:00', by: 'admin', reason: 'Given on the wrong invoice' } })]
    });
    expect(statement.lines.map(line => line.kind)).toEqual(['invoice', 'discount', 'adjustment_reversed']);
    expect(statement.lines[1]).toMatchObject({ description: 'Discount DS-000001 on invoice INV-0001: Pensioner', patient: -3000, medicalAid: 0 });
    expect(statement.closing.patient).toBe(30000);
  });

  it('reads the reason in the practice\'s words: the label, the label with the note, or the note for "Other"', () => {
    expect(discountReasonText({ reasonCode: 'pensioner', reason: 'Pensioner' })).toBe('Pensioner');
    expect(discountReasonText({ reasonCode: 'staff', reason: 'Nurse Testing\'s son' })).toBe('Staff member or their family: Nurse Testing\'s son');
    expect(discountReasonText({ reasonCode: 'other', reason: 'Agreed at the counter' })).toBe('Agreed at the counter');
  });

  it('is a line of its own in the control totals and the day end, so the month-end proof still adds up', () => {
    const inv = invoice({ id: 'inv-a', issueDate: '2026-10-12', total: 1000, medicalAidTotal: 700, patientTotal: 300 });
    const back = discount({ id: 'd2', number: 'DS-000002', amountCents: 5000, reversal: { at: '2026-10-13T08:00:00+02:00', by: 'admin', reason: 'Wrong invoice' } });
    const sources = { invoices: [inv], receipts: [], adjustments: [discount(), back] };
    const totals = totalMovements(ledgerMovements(sources), { startKey: '2026-10-01', endKey: '2026-10-31' });
    expect(totals.discounts).toBe(-8000);
    expect(totals.adjustment_reversals).toBe(5000);
    const summary = controlSummary(sources, { startKey: '2026-10-12', endKey: '2026-10-12' });
    expect(summary.adjustments.discount).toEqual({ count: 2, cents: 8000 });
    expect(summary.netMovementCents).toBe(100000 - 8000);
  });

  it('is kept with its percentage when it was read with it, and the daybook names it', () => {
    expect(normalizeAdjustment({ id: 'd1', kind: 'discount', amount: '30.00', portion: 'patient', percent: '10.00', reason: 'Pensioner' })?.percent).toBe(10);
    expect(normalizeAdjustment({ id: 'c1', kind: 'credit_note', amount: '30.00', portion: 'patient', percent: '10.00', reason: 'Mistake' })).not.toHaveProperty('percent');
    const entry = normalizeDaybookEntry({ entry_number: 7, recorded_at: '2026-10-12T09:00:00Z', recorded_on: '2026-10-12', entry_type: 'discount', adjustment_kind: 'discount', document_number: 'DS-000001', related_document: 'INV-0001', portion: 'patient', amount: '30.00', debtors_effect: '-30.00' });
    expect(entry && describeDaybookEntry(entry)).toBe('Discount DS-000001 on INV-0001, patient portion');
  });

  it("is sent with its percentage, and always on the patient's portion", () => {
    const payload = buildAdjustmentPayload({ practiceId: 'pr', kind: 'discount', invoiceId: 'inv-a', portion: 'patient', amountCents: 3000, reason: 'Pensioner', reasonCode: 'pensioner', percent: 10 });
    expect(payload).toMatchObject({ kind: 'discount', amount: '30.00', portion: 'patient', reason_code: 'pensioner', percent: '10.00' });
    expect(buildAdjustmentPayload({ practiceId: 'pr', kind: 'credit_note', invoiceId: 'inv-a', portion: 'patient', amountCents: 3000, reason: 'Mistake' })).not.toHaveProperty('percent');
  });
});
