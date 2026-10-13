/**
 * Money helpers for N$ amounts.
 *
 * Every calculation is done in whole cents (integers) so a price typed as 135.40 is billed as
 * exactly 135.40, and 135.40 x 3 is exactly 406.20 - never 406.20000000000005 or 406.19.
 * Rounding is half-up on the decimal value as written (1.005 -> 1.01, 2.675 -> 2.68), which is
 * what a person checking the invoice by hand expects; Number.toFixed gets several of these wrong.
 *
 * This file has no imports so it can also be imported by Deno edge functions.
 */

/** Shifts the decimal point of a number using its decimal string form (avoids binary drift). */
const shiftDecimal = (value: number, places: number): number => {
  const [mantissa, exponent] = String(value).split('e');
  const shiftedExponent = (exponent ? Number(exponent) : 0) + places;
  return Number(`${mantissa}e${shiftedExponent}`);
};

/** Integer division of non-negative integers, rounding half up. */
const divideRoundHalfUp = (numerator: number, denominator: number): number => {
  let quotient = Math.floor(numerator / denominator);
  let remainder = numerator - quotient * denominator;
  // Guard against floating point error in the division for very large numerators
  if (remainder < 0) {
    quotient -= 1;
    remainder += denominator;
  } else if (remainder >= denominator) {
    quotient += 1;
    remainder -= denominator;
  }
  return remainder * 2 >= denominator ? quotient + 1 : quotient;
};

/** Converts N$ to whole cents, rounding half away from zero. Throws on NaN/Infinity. */
export function toCents(amount: number): number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new RangeError(`Not a valid amount: ${String(amount)}`);
  }
  const cents = Math.round(shiftDecimal(Math.abs(amount), 2));
  if (cents === 0) return 0;
  return amount < 0 ? -cents : cents;
}

/** Converts whole cents back to N$. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/** Rounds an N$ amount to the nearest cent (half up). */
export function roundToCents(amount: number): number {
  return fromCents(toCents(amount));
}

/** True when the number has no more than the given number of decimals (as written). */
export function hasAtMostDecimals(value: number, decimals: number): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const shifted = shiftDecimal(Math.abs(value), decimals);
  return Number.isInteger(shifted);
}

/**
 * Multiplies a cent amount by a quantity with up to 2 decimals (e.g. 1, 3, 1.5) and rounds the
 * result to whole cents, half up. Both inputs must be non-negative.
 */
export function multiplyCents(cents: number, quantity: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`Cents must be a non-negative integer: ${String(cents)}`);
  }
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative number: ${String(quantity)}`);
  }
  const quantityHundredths = Math.round(shiftDecimal(quantity, 2));
  return divideRoundHalfUp(cents * quantityHundredths, 100);
}

/**
 * Returns `percent`% of a cent amount, rounded to whole cents half up. Percent may have up to
 * 2 decimals (e.g. 33.33). Both inputs must be non-negative.
 */
export function percentOfCents(cents: number, percent: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new RangeError(`Cents must be a non-negative integer: ${String(cents)}`);
  }
  if (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0) {
    throw new RangeError(`Percent must be a non-negative number: ${String(percent)}`);
  }
  const percentHundredths = Math.round(shiftDecimal(percent, 2));
  return divideRoundHalfUp(cents * percentHundredths, 10000);
}

/** Sums cent amounts. */
export function sumCents(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Formats an amount with exactly 2 decimals. With `thousands` (default) the whole part is
 * grouped with commas ("1,234.50"); without it the result is plain ("1234.50") as used in
 * claim files, where a comma would split the field.
 */
export function formatAmount(amount: number, options: { thousands?: boolean } = {}): string {
  const { thousands = true } = options;
  const cents = toCents(amount);
  const absolute = Math.abs(cents);
  const whole = String(Math.floor(absolute / 100));
  const fraction = String(absolute % 100).padStart(2, '0');
  const wholeText = thousands ? groupThousands(whole) : whole;
  return `${cents < 0 ? '-' : ''}${wholeText}.${fraction}`;
}

/** Formats an amount as Namibian dollars, e.g. "N$ 1,234.50" or "-N$ 5.00". */
export function formatNad(amount: number): string {
  const text = formatAmount(amount);
  return text.startsWith('-') ? `-N$ ${text.slice(1)}` : `N$ ${text}`;
}

/**
 * Splits an amount into its whole and cents parts for styled display ("N$ 1,234" + ".50").
 * Both parts come from the same rounded value, so 99.996 shows as 100.00 (not "99" + ".00").
 */
export function nadParts(amount: number): { whole: string; cents: string } {
  const [whole, cents] = formatAmount(amount).split('.');
  return { whole, cents };
}
