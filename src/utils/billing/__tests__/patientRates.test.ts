/**
 * A patient's price rate (parity R28): a private, staff or contract rate, as a percentage of the usual price. What
 * matters to a practice: the rate is read and typed the same way everywhere, it can never price below 10% or above
 * 500% (a typing slip), a fund's own price is never touched (the claim would be cut), and staff read in plain words what
 * the patient is billed at.
 */
import { describe, expect, it } from 'vitest';
import {
  billableAtPatientRate,
  describePatientRate,
  parsePatientRate,
  patientRateFromRow,
  patientRateSentence,
  priceAtPatientRate,
  staffMedicinePrice
} from '../patientRates';

describe('the rate as typed on the patient file', () => {
  it('reads a rate and its percentage of the usual price', () => {
    expect(parsePatientRate('staff', '50')).toEqual({ ok: true, value: { kind: 'staff', percent: 50 } });
    expect(parsePatientRate('contract', '80.5%')).toEqual({ ok: true, value: { kind: 'contract', percent: 80.5 } });
  });

  // A staff rate may be only the staff medicine price on the usual fees: no percentage, or 100, is the usual price
  it('reads no percentage, or 100, as the usual price, and no kind as no rate', () => {
    expect(parsePatientRate('staff', '')).toEqual({ ok: true, value: { kind: 'staff', percent: null } });
    expect(parsePatientRate('private', '100')).toEqual({ ok: true, value: { kind: 'private', percent: null } });
    expect(parsePatientRate('', '50')).toEqual({ ok: true, value: null });
  });

  it('refuses an unknown kind and a percentage outside 10% to 500%, saying so in the words of the patient file', () => {
    expect(parsePatientRate('vip', '50')).toEqual({ ok: false, message: 'Choose a private, staff or contract rate.' });
    expect(parsePatientRate('staff', '5')).toEqual({ ok: false, message: 'A rate is from 10% to 500% of the usual price.' });
    expect(parsePatientRate('staff', 'half')).toEqual({ ok: false, message: 'Enter the rate as a percentage of the usual price, for example 120 or 95.5.' });
  });

  it('reads the stored row, and leaves out one it cannot read (priced as the usual price)', () => {
    expect(patientRateFromRow({ kind: 'staff', percent: '50.00' })).toEqual({ kind: 'staff', percent: 50 });
    expect(patientRateFromRow({ kind: 'private', percent: null })).toEqual({ kind: 'private', percent: null });
    expect(patientRateFromRow({ kind: 'vip', percent: 50 })).toBeNull();
    expect(patientRateFromRow(null)).toBeNull();
  });
});

describe('pricing at the rate', () => {
  it('prices whole cents, half up, and leaves the price alone without a rate', () => {
    expect(priceAtPatientRate(400, { kind: 'staff', percent: 50 })).toBe(200);
    // 99.99 x 80.5% = 80.49195
    expect(priceAtPatientRate(99.99, { kind: 'contract', percent: 80.5 })).toBe(80.49);
    expect(priceAtPatientRate(400, { kind: 'staff', percent: null })).toBe(400);
    expect(priceAtPatientRate(400, null)).toBe(400);
  });

  // The claim must carry the fund's own price, and a code that cannot be priced must stay refused
  it("rates only the codes at the practice tariff: a fund's own price and an unpriceable code stay", () => {
    const tariffs = [
      { code: '0190', unitPrice: 520, priceSource: { kind: 'practice_tariff' }, priceProblem: null },
      { code: '0191', unitPrice: 310, priceSource: { kind: 'fund_schedule' }, priceProblem: null },
      { code: '0192', unitPrice: 600, priceSource: { kind: 'practice_tariff' }, priceProblem: 'Two MAG1 prices on the same day' }
    ];
    expect(billableAtPatientRate(tariffs, { kind: 'staff', percent: 50 }).map(tariff => tariff.unitPrice)).toEqual([260, 310, 600]);
    expect(billableAtPatientRate(tariffs, null)).toEqual(tariffs);
  });

  it('gives a staff rate the staff medicine price, and no other rate', () => {
    expect(staffMedicinePrice({ kind: 'staff', percent: null })).toBe(true);
    expect(staffMedicinePrice({ kind: 'contract', percent: 80 })).toBe(false);
    expect(staffMedicinePrice(null)).toBe(false);
  });
});

describe('in words', () => {
  it('names the rate and what it charges', () => {
    expect(describePatientRate({ kind: 'staff', percent: 50 })).toBe('Staff rate: 50% of the usual price');
    expect(describePatientRate({ kind: 'staff', percent: null })).toBe('Staff rate: the usual price');
    expect(describePatientRate(null)).toBe('');
  });

  it('says above the billing lines when the rate changes prices, and that a fund keeps its own', () => {
    expect(patientRateSentence({ kind: 'contract', percent: 90 }, false)).toBe('This patient has a contract rate: new lines are billed at 90% of the usual price.');
    expect(patientRateSentence({ kind: 'staff', percent: 50 }, true)).toBe(
      "This patient has a staff rate: new lines are billed at 50% of the usual price for codes at the practice tariff (the fund's own prices stay)."
    );
    expect(patientRateSentence({ kind: 'staff', percent: null }, false)).toBeNull();
  });
});
