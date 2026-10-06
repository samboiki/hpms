// Deterministic case generators for the billing test suites. A fixed seed means every run checks
// exactly the same thousands of cases, so a failure is always reproducible.

/** Small seeded PRNG (mulberry32): returns floats in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const intBetween = (random: () => number, min: number, max: number): number =>
  min + Math.floor(random() * (max - min + 1));

export const pick = <T>(random: () => number, items: readonly T[]): T => items[Math.floor(random() * items.length)];

/** Real 2025 NAMAF dental prices (N$) plus awkward values that expose float rounding. */
export const REAL_PRICES: readonly number[] = [
  34.4, 45, 135.4, 137.4, 234.4, 254.7, 373.9, 479, 802.4, 988.3, 1087.2, 1647.2, 3456.8,
  0.01, 0.07, 0.1, 0.29, 1.005, 2.675, 19.99, 33.33, 99.99, 100, 1234.56
];

/** Integer-only half-up rounding of a / b for non-negative integers (independent oracle). */
export const divHalfUp = (a: number, b: number): number => Math.floor((2 * a + b) / (2 * b));

/** Builds yyyy-MM-dd from a JS Date's local calendar fields (oracle for date tests). */
export const localKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Every day from start (inclusive) for `count` days, as yyyy-MM-dd, via local Date arithmetic. */
export const dayRange = (start: string, count: number, step = 1): string[] => {
  const [year, month, day] = start.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => localKey(new Date(year, month - 1, day + index * step)));
};
