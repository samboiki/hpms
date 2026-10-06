import { describe, it, expect } from 'vitest';
import {
  computeLine,
  summarizeLines,
  verifyLineAmounts,
  isValidFdiTooth,
  parseToothList,
  MAX_QUANTITY,
  type MultiplyRule
} from '../pricing';
import { hasAtMostDecimals } from '../money';
import { REAL_PRICES, divHalfUp, intBetween, pick, seededRandom } from './generators';

const RULES: readonly MultiplyRule[] = ['NO', 'YES', 'SOMETIMES', 'PROGRESSIVE'];
const centsOf = (price: number): number => Math.round(Number(`${price}e2`));

// Business rule: the line total is unit price x quantity, exact to the cent. A code that cannot be
// multiplied (can_be_multiplied = NO) is billed with quantity 1 - otherwise the invoice would say
// "3 x N$ 100" but charge N$ 100, and the claim would carry 3 services for the price of one.
// SOMETIMES / PROGRESSIVE codes are priced unit x quantity and flagged for review; no invented
// discount (the old screens used 50% or 80% for extra units, which no tariff says).
describe('computeLine: quantity rules x real prices', () => {
  const quantities = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 20, 32, 0.5, 1.5, 2.25];
  const prices = [34.4, 135.4, 254.7, 373.9, 802.4, 1087.2, 1.005, 0.07];
  const cases = RULES.flatMap(rule =>
    quantities.flatMap(quantity => prices.map(price => ({ rule, quantity, price })))
  );

  it.each(cases)('$rule x $quantity at N$ $price', ({ rule, quantity, price }) => {
    const result = computeLine({ code: '8101', unitPrice: price, quantity, multiplyRule: rule, hasMedicalAid: false });
    if (rule === 'NO' && quantity !== 1) {
      expect(result.ok).toBe(false);
      expect(result.errors.join(' ')).toMatch(/quantity 1/);
      expect(result.totalCents).toBe(0);
      return;
    }
    const expected = divHalfUp(centsOf(price) * Math.round(quantity * 100), 100);
    expect(result.ok).toBe(true);
    expect(result.totalCents).toBe(expected);
    expect(result.total).toBe(expected / 100);
    expect(result.patientCents).toBe(expected);
    expect(result.medicalAidCents).toBe(0);
    expect(result.needsReview).toBe(quantity > 1 && (rule === 'SOMETIMES' || rule === 'PROGRESSIVE'));
    expect(result.warnings.some(w => w.includes('special quantity rule'))).toBe(result.needsReview);
  });
});

// Business rule: broken input must stop the line, never price it. A negative or missing price or
// a mistyped quantity (0, 1000, 1.005) produces an error and contributes N$ 0.00 to the invoice.
describe('computeLine: invalid prices and quantities are rejected', () => {
  it.each([
    { label: 'NaN price', unitPrice: Number.NaN, quantity: 1, message: /not a number/ },
    { label: 'infinite price', unitPrice: Number.POSITIVE_INFINITY, quantity: 1, message: /not a number/ },
    { label: 'negative price', unitPrice: -0.01, quantity: 1, message: /negative/ },
    { label: 'very negative price', unitPrice: -254.7, quantity: 1, message: /negative/ },
    { label: 'absurd price', unitPrice: 1_000_000.01, quantity: 1, message: /above/ },
    { label: 'string price', unitPrice: '254.70' as unknown as number, quantity: 1, message: /not a number/ },
    { label: 'zero quantity', unitPrice: 100, quantity: 0, message: /greater than 0/ },
    { label: 'negative quantity', unitPrice: 100, quantity: -2, message: /greater than 0/ },
    { label: 'NaN quantity', unitPrice: 100, quantity: Number.NaN, message: /greater than 0/ },
    { label: 'infinite quantity', unitPrice: 100, quantity: Number.POSITIVE_INFINITY, message: /greater than 0/ },
    { label: 'three decimals', unitPrice: 100, quantity: 1.005, message: /at most 2 decimals/ },
    { label: 'over the maximum', unitPrice: 100, quantity: MAX_QUANTITY + 1, message: /more than 99/ },
    { label: 'typo 1000', unitPrice: 100, quantity: 1000, message: /more than 99/ }
  ])('$label', ({ unitPrice, quantity, message }) => {
    const result = computeLine({ code: '8107', unitPrice, quantity, multiplyRule: 'YES', hasMedicalAid: true });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(message);
    expect(result.totalCents + result.medicalAidCents + result.patientCents).toBe(0);
  });

  it('accepts the maximum quantity and a zero price (with a warning to check the tariff)', () => {
    expect(computeLine({ unitPrice: 10, quantity: MAX_QUANTITY, multiplyRule: 'YES', hasMedicalAid: false }).totalCents).toBe(99000);
    const free = computeLine({ unitPrice: 0, quantity: 1, multiplyRule: 'NO', hasMedicalAid: false });
    expect(free.ok).toBe(true);
    expect(free.warnings.join(' ')).toMatch(/N\$ 0\.00/);
  });

  it('fixes the old X-ray bug: 3 films of N$ 135.40 are N$ 406.20, not 135.40 x 3 x 3', () => {
    const result = computeLine({ code: '8107', unitPrice: 135.4, quantity: 3, multiplyRule: 'YES', hasMedicalAid: false });
    expect(result.total).toBe(406.2);
  });
});

// Business rule: a medical aid patient's line goes to the fund (100% unless a lower cover is
// given); a private patient pays it all. The two shares always add up to the line total.
describe('computeLine: medical aid / patient split', () => {
  const random = seededRandom(424242);
  const covers = [undefined, 0, 10, 33.33, 50, 66.67, 80, 90, 100];
  const cases = Array.from({ length: 1200 }, (_, index) => ({
    index,
    price: pick(random, REAL_PRICES),
    quantity: intBetween(random, 1, 12),
    hasMedicalAid: random() < 0.6,
    cover: pick(random, covers)
  }));

  it.each(cases)('case $index', ({ price, quantity, hasMedicalAid, cover }) => {
    const result = computeLine({
      unitPrice: price,
      quantity,
      multiplyRule: 'YES',
      hasMedicalAid,
      coveragePercent: cover
    });
    const total = centsOf(price) * quantity;
    expect(result.ok).toBe(true);
    expect(result.totalCents).toBe(total);
    expect(result.medicalAidCents + result.patientCents).toBe(total);
    if (!hasMedicalAid) {
      expect(result.medicalAidCents).toBe(0);
    } else {
      const percent = cover ?? 100;
      expect(result.medicalAidCents).toBe(divHalfUp(total * Math.round(percent * 100), 10000));
      if (percent === 100) expect(result.patientCents).toBe(0);
    }
  });

  it.each([-1, 100.01, 150, Number.NaN, 12.345])('rejects a cover of %s%%', cover => {
    const result = computeLine({ unitPrice: 100, quantity: 1, multiplyRule: 'NO', hasMedicalAid: true, coveragePercent: cover });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/between 0% and 100%/);
  });

  it('ignores a cover percentage for private patients', () => {
    const result = computeLine({ unitPrice: 100, quantity: 1, multiplyRule: 'NO', hasMedicalAid: false, coveragePercent: 80 });
    expect(result.patientCents).toBe(10000);
    expect(result.medicalAidCents).toBe(0);
  });
});

// Business rule: only real teeth can be billed and claimed (FDI notation: permanent 11-18, 21-28,
// 31-38, 41-48; milk teeth 51-55, 61-65, 71-75, 81-85). The old check accepted 19, 20, 29, 30...
describe('FDI tooth numbers', () => {
  const valid = new Set<string>();
  for (let quadrant = 1; quadrant <= 4; quadrant += 1) for (let tooth = 1; tooth <= 8; tooth += 1) valid.add(`${quadrant}${tooth}`);
  for (let quadrant = 5; quadrant <= 8; quadrant += 1) for (let tooth = 1; tooth <= 5; tooth += 1) valid.add(`${quadrant}${tooth}`);
  const cases = Array.from({ length: 100 }, (_, index) => {
    const tooth = String(index).padStart(2, '0');
    return { tooth, expected: valid.has(tooth) };
  });

  it.each(cases)('tooth $tooth valid: $expected', ({ tooth, expected }) => {
    expect(isValidFdiTooth(tooth)).toBe(expected);
    const line = computeLine({
      code: '8341',
      unitPrice: 373.9,
      quantity: 1,
      multiplyRule: 'YES',
      requiresTooth: true,
      toothNumbers: [tooth],
      hasMedicalAid: true
    });
    expect(line.ok).toBe(expected);
  });

  it('requires a tooth when the tariff says so, and rejects the same tooth twice', () => {
    const missing = computeLine({ code: '8341', unitPrice: 373.9, quantity: 1, multiplyRule: 'YES', requiresTooth: true, hasMedicalAid: false });
    expect(missing.errors.join(' ')).toMatch(/needs a tooth number/);
    const twice = computeLine({
      code: '8341', unitPrice: 373.9, quantity: 2, multiplyRule: 'YES', requiresTooth: true, toothNumbers: ['11', '11'], hasMedicalAid: false
    });
    expect(twice.errors.join(' ')).toMatch(/listed twice/);
  });

  it('warns when a once-per-line code lists several teeth, or quantity and teeth disagree', () => {
    const several = computeLine({ code: '8211', unitPrice: 802.4, quantity: 1, multiplyRule: 'NO', toothNumbers: ['18', '28'], hasMedicalAid: false });
    expect(several.ok).toBe(true);
    expect(several.warnings.join(' ')).toMatch(/one line per tooth/);
    const mismatch = computeLine({ code: '8107', unitPrice: 135.4, quantity: 3, multiplyRule: 'YES', toothNumbers: ['11', '12'], hasMedicalAid: false });
    expect(mismatch.warnings.join(' ')).toMatch(/quantity 3 but 2/);
  });

  it('parses typed tooth lists', () => {
    expect(parseToothList(' 11 12,21;  22 ')).toEqual(['11', '12', '21', '22']);
    expect(parseToothList('')).toEqual([]);
  });
});

// Business rule: invoice totals are the sum of the valid lines only; an invalid line is counted
// so the screen can block saving, but it adds nothing.
describe('summarizeLines', () => {
  it('adds valid lines in cents and counts invalid and review lines', () => {
    const lines = [
      computeLine({ unitPrice: 0.1, quantity: 3, multiplyRule: 'YES', hasMedicalAid: true }),
      computeLine({ unitPrice: 0.2, quantity: 1, multiplyRule: 'NO', hasMedicalAid: false }),
      computeLine({ unitPrice: -5, quantity: 1, multiplyRule: 'NO', hasMedicalAid: false }),
      computeLine({ unitPrice: 10, quantity: 2, multiplyRule: 'PROGRESSIVE', hasMedicalAid: true, coveragePercent: 50 })
    ];
    const summary = summarizeLines(lines);
    expect(summary.subtotal).toBe(20.5);
    expect(summary.medicalAid).toBe(10.3);
    expect(summary.patient).toBe(10.2);
    expect(summary.invalidCount).toBe(1);
    expect(summary.reviewCount).toBe(1);
    expect(summary.lineCount).toBe(4);
  });
});

// Business rule: before invoice lines are saved, every stored line must satisfy
// total = unit price x quantity. This catches screens that price a line one way and store another.
describe('verifyLineAmounts', () => {
  const random = seededRandom(77);
  // Stored prices have at most 2 decimals (numeric(10,2)); 1.005-style values are not real prices
  const storedPrices = REAL_PRICES.filter(price => hasAtMostDecimals(price, 2));
  const consistent = Array.from({ length: 400 }, (_, index) => {
    const price = pick(random, storedPrices);
    const quantity = intBetween(random, 1, 20);
    return { index, price, quantity, total: (centsOf(price) * quantity) / 100 };
  });

  it.each(consistent)('accepts consistent line $index', ({ price, quantity, total }) => {
    expect(verifyLineAmounts(price, quantity, total).ok).toBe(true);
    expect(verifyLineAmounts(price, quantity, price * quantity).ok).toBe(true);
  });

  it.each([
    { label: 'progressive 50% discount (old dental screen)', unit: 100, quantity: 3, total: 100 + 2 * 100 * 0.5 },
    { label: 'fixed-price code with quantity 3', unit: 145.2, quantity: 3, total: 145.2 },
    { label: 'X-ray double multiplication', unit: 135.4, quantity: 3, total: 135.4 * 9 },
    { label: 'one cent short', unit: 254.7, quantity: 1, total: 254.69 },
    { label: 'negative unit', unit: -10, quantity: 1, total: -10 },
    { label: 'zero quantity', unit: 10, quantity: 0, total: 0 },
    { label: 'missing total', unit: 10, quantity: 1, total: Number.NaN }
  ])('rejects $label', ({ unit, quantity, total }) => {
    expect(verifyLineAmounts(unit, quantity, total).ok).toBe(false);
  });
});
