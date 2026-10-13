import { describe, expect, it } from 'vitest';
import {
  applyLevy,
  applyLineDiscount,
  copayFor,
  describeCopayRule,
  parseAuthorisationNumber,
  parseCopayPercent,
  parseCopayRules,
  parseShareAmount,
  parseTariffPortions,
  shareOf,
  splitLineCents,
  tariffPortionsSetting
} from '../lineSplit';
import { divHalfUp, intBetween, pick, seededRandom } from './generators';

describe('splitting a line between the fund and the patient', () => {
  it('lets a private patient pay the whole line', () => {
    expect(splitLineCents({ totalCents: 50_010, hasMedicalAid: false, copayPercent: 5 })).toEqual({ fundCents: 0, patientCents: 50_010, copayCents: 0 });
  });

  it('sends a medical aid line to the fund when the fund has no co-payment', () => {
    expect(splitLineCents({ totalCents: 50_010, hasMedicalAid: true })).toEqual({ fundCents: 50_010, patientCents: 0, copayCents: 0 });
  });

  // PSEMAS-style 5% co-payment: the patient pays 5% at the counter, the fund the rest
  it('charges the patient the co-payment, rounded half up to the cent, and the fund the rest', () => {
    expect(splitLineCents({ totalCents: 50_010, hasMedicalAid: true, copayPercent: 5 })).toEqual({ fundCents: 47_509, patientCents: 2_501, copayCents: 2_501 });
    // 5% of N$ 0.10 is 0.5 cent: half up, the patient pays 1 cent
    expect(splitLineCents({ totalCents: 10, hasMedicalAid: true, copayPercent: 5 })).toEqual({ fundCents: 9, patientCents: 1, copayCents: 1 });
  });

  // Receipts allocate against the two portions: a cent lost or gained would leave the invoice open or overpaid
  it('always adds the two portions up to the line total exactly (thousands of cases)', () => {
    const random = seededRandom(20261007);
    for (let i = 0; i < 5000; i += 1) {
      const totalCents = intBetween(random, 0, 2_000_000);
      const copayPercent = pick(random, [0, 0.5, 5, 10, 12.5, 33.33, 100]);
      const hasMedicalAid = random() < 0.7;
      const split = splitLineCents({ totalCents, hasMedicalAid, copayPercent });
      expect(split.fundCents + split.patientCents).toBe(totalCents);
      expect(split.fundCents).toBeGreaterThanOrEqual(0);
      expect(split.patientCents).toBeGreaterThanOrEqual(0);
      if (hasMedicalAid) expect(split.copayCents).toBe(divHalfUp(totalCents * Math.round(copayPercent * 100), 10_000));
    }
  });

  it('refuses a co-payment outside 0-100% and a total that is not whole cents', () => {
    expect(() => splitLineCents({ totalCents: 100, hasMedicalAid: true, copayPercent: 101 })).toThrow(RangeError);
    expect(() => splitLineCents({ totalCents: 100.5, hasMedicalAid: true })).toThrow(RangeError);
    expect(() => splitLineCents({ totalCents: -1, hasMedicalAid: false })).toThrow(RangeError);
  });
});

describe('co-payment rules (practice setting)', () => {
  const rules = parseCopayRules([
    { fundReference: 'mag1 ', percent: 5 },
    { fundReference: 'NHPM', planOption: 'Gold', percent: '10' },
    { fundReference: 'NHPM', percent: 2.5 },
    { fundReference: '', percent: 5 },
    { fundReference: 'NMC1', percent: 0 },
    { fundReference: 'NAMM', percent: 5.555 },
    'nonsense'
  ]);

  // A wrong setting must never become a made-up co-payment
  it('keeps only usable rules, with the fund code in capitals', () => {
    expect(rules).toEqual([
      { fundReference: 'MAG1', planOption: null, percent: 5 },
      { fundReference: 'NHPM', planOption: null, percent: 2.5 },
      { fundReference: 'NHPM', planOption: 'Gold', percent: 10 }
    ]);
  });

  it('also reads the setting stored as { rules: [...] } and ignores anything else', () => {
    expect(parseCopayRules({ rules: [{ fundReference: 'MAG1', percent: 5 }] })).toHaveLength(1);
    expect(parseCopayRules(null)).toEqual([]);
    expect(parseCopayRules({ MAG1: 5 })).toEqual([]);
  });

  it("uses the plan option's own rule first, then the fund-wide rule", () => {
    expect(copayFor(rules, { reference: 'NHPM', planOptions: ['gold'] })?.percent).toBe(10);
    expect(copayFor(rules, { reference: 'nhpm', planOptions: ['Silver'] })?.percent).toBe(2.5);
    expect(copayFor(rules, { reference: 'MAG1', planOptions: [] })?.percent).toBe(5);
  });

  it('has no co-payment for funds without a rule, private patients and unknown funds', () => {
    expect(copayFor(rules, { reference: 'NMC1', planOptions: [] })).toBeNull();
    expect(copayFor(rules, null)).toBeNull();
    expect(copayFor(rules, { reference: null, planOptions: [] })).toBeNull();
  });

  it('reads percentages from numbers and text', () => {
    expect(parseCopayPercent('5')).toBe(5);
    expect(parseCopayPercent(' ')).toBeNull();
    expect(parseCopayPercent(100)).toBe(100);
    expect(parseCopayPercent(0)).toBeNull();
  });
});

describe('fixed co-payments, lines paid by one side, and levies (parity D8)', () => {
  // A fund that asks N$ 50 per line: the patient pays that much at the counter, never more than the line itself
  it('charges a fixed co-payment per line, at most the line', () => {
    expect(splitLineCents({ totalCents: 40_000, hasMedicalAid: true, copayAmount: 50 })).toEqual({ fundCents: 35_000, patientCents: 5_000, copayCents: 5_000 });
    expect(splitLineCents({ totalCents: 3_000, hasMedicalAid: true, copayAmount: 50 })).toEqual({ fundCents: 0, patientCents: 3_000, copayCents: 3_000 });
    expect(splitLineCents({ totalCents: 3_000, hasMedicalAid: false, copayAmount: 50 })).toEqual({ fundCents: 0, patientCents: 3_000, copayCents: 0 });
  });

  // A co-payment is one or the other: both at once would double-charge the patient
  it('refuses a percentage and a fixed amount together, and amounts with fractions of a cent', () => {
    expect(() => splitLineCents({ totalCents: 100, hasMedicalAid: true, copayPercent: 5, copayAmount: 1 })).toThrow(RangeError);
    expect(() => splitLineCents({ totalCents: 100, hasMedicalAid: true, copayAmount: 0.005 })).toThrow(RangeError);
  });

  // A patient's own line (for example a cosmetic procedure) is never claimed, so none of it may sit on the fund's side
  it("puts all of a patient's own line on the patient and all of a fund-only line on the fund, whatever the co-payment", () => {
    expect(splitLineCents({ totalCents: 9_999, hasMedicalAid: true, copayPercent: 5, paidBy: 'patient' })).toEqual({ fundCents: 0, patientCents: 9_999, copayCents: 0 });
    expect(splitLineCents({ totalCents: 9_999, hasMedicalAid: true, copayPercent: 5, paidBy: 'fund' })).toEqual({ fundCents: 9_999, patientCents: 0, copayCents: 0 });
    expect(splitLineCents({ totalCents: 9_999, hasMedicalAid: false, paidBy: 'fund' })).toEqual({ fundCents: 0, patientCents: 9_999, copayCents: 0 });
  });

  // The levy is per visit: a N$ 20 levy on a three-line invoice is N$ 20, not N$ 60
  it('takes a levy once per invoice off the fund, first line first, skipping lines paid by one side', () => {
    const result = applyLevy(
      [
        { fundCents: 0, patientCents: 5_000, levyApplies: false },
        { fundCents: 1_200, patientCents: 0, levyApplies: true },
        { fundCents: 30_000, patientCents: 0, levyApplies: true }
      ],
      2_000
    );
    expect(result.levyCents).toBe(2_000);
    expect(result.lines.map(line => [line.fundCents, line.patientCents])).toEqual([[0, 5_000], [0, 1_200], [29_200, 800]]);
  });

  // The patient never pays a levy larger than what the fund would have paid on the invoice
  it('charges at most the fund share of the invoice, and every line still adds up (thousands of cases)', () => {
    const random = seededRandom(20261009);
    for (let i = 0; i < 2_000; i += 1) {
      const lines = Array.from({ length: intBetween(random, 0, 5) }, () => {
        const total = intBetween(random, 0, 200_000);
        const fund = intBetween(random, 0, total);
        return { fundCents: fund, patientCents: total - fund, levyApplies: random() < 0.8 };
      });
      const levy = intBetween(random, 0, 100_000);
      const result = applyLevy(lines, levy);
      const fundBefore = lines.filter(line => line.levyApplies).reduce((sum, line) => sum + line.fundCents, 0);
      expect(result.levyCents).toBe(Math.min(levy, fundBefore));
      result.lines.forEach((line, index) => {
        expect(line.fundCents + line.patientCents).toBe(lines[index].fundCents + lines[index].patientCents);
        expect(line.fundCents).toBeGreaterThanOrEqual(0);
      });
    }
  });

  it('keeps fixed co-payments and levies in the setting, and refuses a rule asking for both a percentage and an amount', () => {
    const rules = parseCopayRules([
      { fundReference: 'NHPM', amount: '50' },
      { fundReference: 'NMC1', percent: 5, levy: 20 },
      { fundReference: 'NAMM', levy: 'N$ 15.50' },
      { fundReference: 'PROS', percent: 5, amount: 50 },
      { fundReference: 'MAG1', percent: 5, levy: -1 }
    ]);
    expect(rules).toEqual([
      { fundReference: 'NAMM', planOption: null, percent: 0, levy: 15.5 },
      { fundReference: 'NHPM', planOption: null, percent: 0, amount: 50 },
      { fundReference: 'NMC1', planOption: null, percent: 5, levy: 20 }
    ]);
    expect(shareOf(rules[2])).toEqual({ copayPercent: 5, copayAmount: 0, levy: 20 });
    expect(shareOf(null)).toEqual({ copayPercent: 0, copayAmount: 0, levy: 0 });
    expect(describeCopayRule(rules[2])).toBe('5% of each line and a N$ 20.00 levy per visit');
    expect(describeCopayRule(rules[1])).toBe('N$ 50.00 of each line');
    expect(parseShareAmount('0')).toBeNull();
    expect(parseShareAmount(100_001)).toBeNull();
  });

  // A typo in the setting must never turn a code into "patient pays all" for another code
  it('reads the default portion per tariff code, in capitals, ignoring anything unknown', () => {
    const portions = parseTariffPortions([{ code: ' 8101 ', paidBy: 'patient' }, { code: 'gp1', paidBy: 'fund' }, { code: '8102', paidBy: 'someone' }, 'x']);
    expect([...portions.entries()]).toEqual([['8101', 'patient'], ['GP1', 'fund']]);
    expect(tariffPortionsSetting(portions)).toEqual([{ code: '8101', paidBy: 'patient' }, { code: 'GP1', paidBy: 'fund' }]);
    expect(parseTariffPortions(null).size).toBe(0);
  });

  // Claim field 31 is 21 characters in a comma-separated file: a longer number or a comma would break the claim
  it('accepts authorisation numbers the claim file can carry', () => {
    expect(parseAuthorisationNumber(' AB-12/34 ')).toEqual({ ok: true, value: 'AB-12/34' });
    expect(parseAuthorisationNumber('')).toEqual({ ok: true, value: null });
    expect(parseAuthorisationNumber('12,34').ok).toBe(false);
    expect(parseAuthorisationNumber('1'.repeat(22)).ok).toBe(false);
  });
});

describe('discounts', () => {
  it("takes a private patient's discount off the line", () => {
    expect(applyLineDiscount({ grossCents: 50_000, discount: 50, hasMedicalAid: false })).toEqual({ ok: true, discountCents: 5_000, netCents: 45_000 });
    expect(applyLineDiscount({ grossCents: 50_000, discount: undefined, hasMedicalAid: true })).toEqual({ ok: true, discountCents: 0, netCents: 50_000 });
  });

  // The claim goes out at the agreed price and the fund works out its share: a discount there would short the claim
  it('refuses a discount on a medical aid line, saying why', () => {
    const result = applyLineDiscount({ code: '0190', grossCents: 50_000, discount: 10, hasMedicalAid: true });
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/Code 0190: a medical aid line .* cannot be discounted/) });
  });

  it('refuses a discount larger than the line, negative or with fractions of a cent', () => {
    expect(applyLineDiscount({ grossCents: 1_000, discount: 10.01, hasMedicalAid: false })).toMatchObject({ ok: false, message: expect.stringMatching(/more than the line \(N\$ 10\.00\)/) });
    expect(applyLineDiscount({ grossCents: 1_000, discount: -1, hasMedicalAid: false }).ok).toBe(false);
    expect(applyLineDiscount({ grossCents: 1_000, discount: 1.005, hasMedicalAid: false }).ok).toBe(false);
    expect(applyLineDiscount({ grossCents: 1_000, discount: 10, hasMedicalAid: false })).toEqual({ ok: true, discountCents: 1_000, netCents: 0 });
  });
});
