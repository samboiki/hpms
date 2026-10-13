// ---------------------------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------------------------

/** Parse a numeric DB value (numeric columns arrive as strings) into whole cents; junk is 0. */
export function toCents(value: unknown): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : NaN;
  if (!Number.isFinite(parsed)) return 0;
  const cents = Math.round(parsed * 100);
  return cents === 0 ? 0 : cents; // never -0
}

export const fromCents = (cents: number): number => cents / 100;

export const toAmount = (value: unknown): number => fromCents(toCents(value));

export const sumAmounts = (values: number[]): number =>
  fromCents(values.reduce((sum, value) => sum + toCents(value), 0));

/** Share of a whole (0..1); null when the whole is zero, so the UI never divides by zero. */
export const shareOf = (part: number, whole: number): number | null =>
  whole === 0 ? null : part / whole;

/** Percentage change; null when there is nothing to compare against (previous is zero). */
export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
