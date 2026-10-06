import { describe, it, expect } from 'vitest';
import {
  toCents,
  fromCents,
  roundToCents,
  multiplyCents,
  percentOfCents,
  sumCents,
  formatAmount,
  formatNad,
  nadParts,
  hasAtMostDecimals
} from '../money';
import { REAL_PRICES, divHalfUp, seededRandom, intBetween } from './generators';

const intlTwoDecimals = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Business rule: the price an administrator types into the tariff list is the price that is
// billed, shown and claimed, to the cent. A cent lost or gained in storage or display is a
// wrong price on a patient's invoice and a mismatch on the medical aid claim.
describe('a typed price survives storage and display unchanged', () => {
  const cases = Array.from({ length: 1600 }, (_, index) => index * 1249).map(cents => ({ cents }));

  it.each(cases)('$cents cents', ({ cents }) => {
    const price = cents / 100;
    expect(toCents(price)).toBe(cents);
    expect(formatAmount(price)).toBe(intlTwoDecimals.format(price));
    expect(formatAmount(price, { thousands: false })).toBe(intlTwoDecimals.format(price).replace(/,/g, ''));
    expect(nadParts(price)).toEqual({
      whole: intlTwoDecimals.format(price).split('.')[0],
      cents: intlTwoDecimals.format(price).split('.')[1]
    });
  });
});

// Business rule: rounding is half-up on the amount as written, the way a person checks an
// invoice by hand. Number.toFixed rounds 1.005 to "1.00" and 2.675 to "2.67" - wrong by a cent.
describe('rounding to cents is half-up on the written amount', () => {
  it.each([
    { amount: 1.005, text: '1.01' },
    { amount: 2.675, text: '2.68' },
    { amount: 1.255, text: '1.26' },
    { amount: 8.345, text: '8.35' },
    { amount: 0.005, text: '0.01' },
    { amount: 0.0049, text: '0.00' },
    { amount: 1.0049999, text: '1.00' },
    { amount: 0.1 + 0.2, text: '0.30' },
    { amount: 406.20000000000005, text: '406.20' },
    { amount: 135.4 * 3, text: '406.20' },
    { amount: 1e-7, text: '0.00' },
    { amount: 123456.785, text: '123,456.79' },
    { amount: 999999.995, text: '1,000,000.00' },
    { amount: -1.005, text: '-1.01' },
    { amount: -0.001, text: '0.00' },
    { amount: 0, text: '0.00' }
  ])('$amount -> $text', ({ amount, text }) => {
    expect(formatAmount(amount)).toBe(text);
    expect(roundToCents(amount)).toBe(Number(text.replace(/,/g, '')));
  });

  it('refuses amounts that are not numbers, so a broken price can never become N$ 0.00', () => {
    expect(() => toCents(Number.NaN)).toThrow(RangeError);
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => toCents('12' as unknown as number)).toThrow(RangeError);
  });

  it('formats N$ for display and handles negatives (credit notes)', () => {
    expect(formatNad(1234.5)).toBe('N$ 1,234.50');
    expect(formatNad(-5)).toBe('-N$ 5.00');
    expect(formatNad(0.004)).toBe('N$ 0.00');
    expect(fromCents(40620)).toBe(406.2);
    expect(sumCents([1, 2, 3])).toBe(6);
  });

  it('counts decimals as written', () => {
    expect(hasAtMostDecimals(1.5, 2)).toBe(true);
    expect(hasAtMostDecimals(1.25, 2)).toBe(true);
    expect(hasAtMostDecimals(1.005, 2)).toBe(false);
    expect(hasAtMostDecimals(Number.NaN, 2)).toBe(false);
  });
});

// Business rule: a line total is unit price x quantity, exact to the cent, for every real tariff
// price and every whole quantity a practice bills (1-30 X-ray films, injections, units).
describe('line totals are exact for real prices and whole quantities', () => {
  const cases = REAL_PRICES.flatMap(price =>
    Array.from({ length: 30 }, (_, index) => ({ price, quantity: index + 1 }))
  );

  it.each(cases)('N$ $price x $quantity', ({ price, quantity }) => {
    const unitCents = Math.round(Number(`${price}e2`));
    expect(multiplyCents(toCents(price), quantity)).toBe(unitCents * quantity);
  });
});

// Business rule: fractional quantities (e.g. 1.5 units) round half-up once, on the line total.
describe('fractional quantities round once, half-up, on the total', () => {
  const quantities = [0.01, 0.25, 0.5, 1.5, 2.25, 2.33, 3.75, 10.5];
  const cases = REAL_PRICES.flatMap(price => quantities.map(quantity => ({ price, quantity })));

  it.each(cases)('N$ $price x $quantity', ({ price, quantity }) => {
    const unitCents = Math.round(Number(`${price}e2`));
    const quantityHundredths = Math.round(Number(`${quantity}e2`));
    expect(multiplyCents(unitCents, quantity)).toBe(divHalfUp(unitCents * quantityHundredths, 100));
  });

  it('rejects negative or broken inputs instead of producing a negative bill', () => {
    expect(() => multiplyCents(-1, 1)).toThrow(RangeError);
    expect(() => multiplyCents(1.5, 1)).toThrow(RangeError);
    expect(() => multiplyCents(100, -1)).toThrow(RangeError);
    expect(() => multiplyCents(100, Number.NaN)).toThrow(RangeError);
    expect(() => percentOfCents(100, -5)).toThrow(RangeError);
    expect(() => percentOfCents(-100, 5)).toThrow(RangeError);
  });
});

// Business rule: when a medical aid pays a percentage, the fund share and the patient share
// always add up to the invoice line exactly - no cent disappears or is charged twice.
describe('percentage shares always add up to the total', () => {
  const random = seededRandom(20261006);
  const percents = [0, 1, 10, 12.5, 25, 33.33, 50, 66.67, 75, 80, 90, 99.99, 100];
  const cases = Array.from({ length: 1300 }, (_, index) => ({
    totalCents: intBetween(random, 0, 5_000_000),
    percent: percents[index % percents.length]
  }));

  it.each(cases)('$percent% of $totalCents cents', ({ totalCents, percent }) => {
    const share = percentOfCents(totalCents, percent);
    const percentHundredths = Math.round(Number(`${percent}e2`));
    expect(share).toBe(divHalfUp(totalCents * percentHundredths, 10000));
    expect(share).toBeGreaterThanOrEqual(0);
    expect(share).toBeLessThanOrEqual(totalCents);
    expect(share + (totalCents - share)).toBe(totalCents);
  });
});
