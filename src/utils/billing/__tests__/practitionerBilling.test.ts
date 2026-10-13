import { describe, it, expect } from 'vitest';
import {
  billingPracticeNumber,
  describeRate,
  parsePracticeNumber,
  parseRatePercent,
  practitionerBillingFromRows,
  priceAtRate,
  rateOf
} from '../practitionerBilling';

// Invented numbers: the practice's and a partner's own
const PRACTICE = '0111222333444';
const PARTNER_OWN = '0999888777666';
const billing = new Map([
  ['partner', { practiceNumber: PARTNER_OWN, ratePercent: 120 }],
  ['junior', { practiceNumber: null, ratePercent: 80 }]
]);

// Business rule: a partner who bills under their own practice number is paid by the fund on that number (claim field
// 29); everyone else's lines are the practice's. A wrong number sends the fund's money to the wrong practice.
describe('the practice number a line bills under', () => {
  it("is the treating practitioner's own number when they have one", () => {
    expect(billingPracticeNumber('partner', billing, PRACTICE)).toEqual({ number: PARTNER_OWN, own: true });
  });

  it("is the practice's number for everyone else, and for a line without a practitioner", () => {
    expect(billingPracticeNumber('junior', billing, PRACTICE)).toEqual({ number: PRACTICE, own: false });
    expect(billingPracticeNumber('someone-else', billing, PRACTICE)).toEqual({ number: PRACTICE, own: false });
    expect(billingPracticeNumber(null, billing, PRACTICE)).toEqual({ number: PRACTICE, own: false });
  });
});

// Business rule: a practitioner's rate prices their lines from the practice's price list, to the cent; 100% (or no
// rate) is the list itself, so practices that never set a rate bill exactly as before.
describe('a price at a practitioner rate', () => {
  it('multiplies the list price and rounds to the cent', () => {
    expect(priceAtRate(373.9, 120)).toBe(448.68);
    expect(priceAtRate(254.7, 80)).toBe(203.76);
    // 33.35 x 1.155 = 38.51925, to the cent 38.52; half a cent rounds up (0.055 -> 0.06)
    expect(priceAtRate(33.35, 115.5)).toBe(38.52);
    expect(priceAtRate(0.05, 110)).toBe(0.06);
  });

  it('leaves the list price alone without a rate', () => {
    [null, undefined, 100].forEach(rate => expect(priceAtRate(373.9, rate)).toBe(373.9));
  });

  it("reads a practitioner's rate, and says it in words", () => {
    expect(rateOf('partner', billing)).toBe(120);
    expect(rateOf('nobody', billing)).toBeNull();
    expect(rateOf(null, billing)).toBeNull();
    expect(describeRate(120)).toBe('120% of the price list');
    expect(describeRate(null)).toBe('');
  });
});

// Business rule: an administrator types these numbers; a mistyped practice number or a rate of 1200% must be caught
// before it reaches a claim or a patient's bill.
describe('what an administrator may type', () => {
  it('takes a practice number with spaces, or none', () => {
    expect(parsePracticeNumber(' 0999 888777666 ')).toEqual({ ok: true, value: PARTNER_OWN });
    expect(parsePracticeNumber('')).toEqual({ ok: true, value: null });
    expect(parsePracticeNumber('PR12345').ok).toBe(false);
    expect(parsePracticeNumber('123456').ok).toBe(false);
    expect(parsePracticeNumber('1234567890123456').ok).toBe(false);
  });

  it('takes a rate from 10% to 500%, and treats 100% as the price list itself', () => {
    expect(parseRatePercent('120')).toEqual({ ok: true, value: 120 });
    expect(parseRatePercent('95.5%')).toEqual({ ok: true, value: 95.5 });
    expect(parseRatePercent('100')).toEqual({ ok: true, value: null });
    expect(parseRatePercent('')).toEqual({ ok: true, value: null });
    ['9', '501', '1200', '-10', '12.345', 'abc'].forEach(text => expect(parseRatePercent(text).ok).toBe(false));
  });

  it('reads stored rows, leaving out rows with nothing set', () => {
    const map = practitionerBillingFromRows([
      { user_id: 'a', practice_number: PARTNER_OWN, rate_percent: '120.00' },
      { user_id: 'b', practice_number: null, rate_percent: null },
      { user_id: 'c', practice_number: null, rate_percent: 95.5 }
    ]);
    expect([...map.entries()]).toEqual([
      ['a', { practiceNumber: PARTNER_OWN, ratePercent: 120 }],
      ['c', { practiceNumber: null, ratePercent: 95.5 }]
    ]);
  });
});
