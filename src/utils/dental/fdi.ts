/**
 * FDI tooth numbers, as NAMAF, the funds and the claim file use them: the first digit is the quadrant (1 upper right,
 * 2 upper left, 3 lower left, 4 lower right; 5 to 8 the same for milk teeth), the second the position counted from
 * the middle (1 central incisor ... 8 wisdom tooth). Whether a number is valid is decided in one place for billing and
 * the chart: isValidFdiTooth in src/utils/billing/pricing.ts.
 */
// Explicit .ts extensions: the claim checks (claimValidation.ts) reach this file through workTypes.ts
import { isValidFdiTooth, parseToothList } from '../billing/pricing.ts';
import { isValidDateKey, toDateKey } from '../billing/dates.ts';

/** Which teeth the chart shows: permanent, milk, or both (a child between about 6 and 12 has both). */
export type Dentition = 'adult' | 'child' | 'mixed';

export const DENTITION_LABELS: Readonly<Record<Dentition, string>> = {
  adult: 'Adult',
  child: 'Child',
  mixed: 'Mixed'
};

/** The teeth of one quadrant from the middle outwards: quadrant 1 with 8 teeth is 11, 12 ... 18. */
const quadrantTeeth = (quadrant: number, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `${quadrant}${index + 1}`);

/**
 * One row of the chart as a practitioner reads it, facing the patient: the patient's right is on the left of the
 * screen, so the right-hand quadrants run from the back tooth to the middle and the left-hand ones from the middle out.
 */
export interface ChartRow {
  key: 'upper' | 'lower' | 'upper-milk' | 'lower-milk';
  label: string;
  /** Tooth numbers in screen order, left to right: the right-hand quadrant first */
  teeth: readonly string[];
  milk: boolean;
}

const row = (key: ChartRow['key'], label: string, right: number, left: number, count: number, milk: boolean): ChartRow => ({
  key,
  label,
  teeth: [...quadrantTeeth(right, count).reverse(), ...quadrantTeeth(left, count)],
  milk
});

export const ADULT_UPPER = row('upper', 'Upper teeth', 1, 2, 8, false);
export const ADULT_LOWER = row('lower', 'Lower teeth', 4, 3, 8, false);
export const MILK_UPPER = row('upper-milk', 'Upper milk teeth', 5, 6, 5, true);
export const MILK_LOWER = row('lower-milk', 'Lower milk teeth', 8, 7, 5, true);

/** The rows of the chart, top to bottom; mixed puts the milk teeth between the permanent arches, as they sit. */
export function chartRows(dentition: Dentition): ChartRow[] {
  if (dentition === 'child') return [MILK_UPPER, MILK_LOWER];
  if (dentition === 'mixed') return [ADULT_UPPER, MILK_UPPER, MILK_LOWER, ADULT_LOWER];
  return [ADULT_UPPER, ADULT_LOWER];
}

const quadrantOf = (tooth: string): number => Number(tooth.trim().charAt(0));
const positionOf = (tooth: string): number => Number(tooth.trim().charAt(1));

/** Milk (primary) teeth: quadrants 5 to 8. */
export const isMilkTooth = (tooth: string): boolean => isValidFdiTooth(tooth) && quadrantOf(tooth) >= 5;

/** Upper jaw: quadrants 1, 2, 5 and 6. The inside surface of an upper tooth is palatal, of a lower one lingual. */
export const isUpperTooth = (tooth: string): boolean => [1, 2, 5, 6].includes(quadrantOf(tooth));

/** Front teeth (incisors and canines, positions 1 to 3): they bite with an edge, and their fillings have anterior codes. */
export const isFrontTooth = (tooth: string): boolean => positionOf(tooth) >= 1 && positionOf(tooth) <= 3;

/** Molars: positions 6 to 8, or 4 and 5 for milk teeth. Root canal codes differ for molars. */
export const isMolar = (tooth: string): boolean => (isMilkTooth(tooth) ? positionOf(tooth) >= 4 : positionOf(tooth) >= 6);

/** On the left half of the chart (the patient's right side): its middle (mesial) side faces right on screen. */
export const isOnChartLeft = (tooth: string): boolean => [1, 4, 5, 8].includes(quadrantOf(tooth));

const SIDE_NAMES: Readonly<Record<number, string>> = {
  1: 'Upper right',
  2: 'Upper left',
  3: 'Lower left',
  4: 'Lower right',
  5: 'Upper right',
  6: 'Upper left',
  7: 'Lower left',
  8: 'Lower right'
};

/**
 * The quadrant a tooth is in, 1 to 4 (1 upper right, 2 upper left, 3 lower left, 4 lower right): a milk tooth (5-8)
 * sits in the same quadrant as the permanent teeth of its side. Null for anything that is not a tooth.
 */
export function quadrantOfTooth(tooth: string): number | null {
  if (!isValidFdiTooth(tooth)) return null;
  const quadrant = quadrantOf(tooth);
  return quadrant > 4 ? quadrant - 4 : quadrant;
}

/** "Upper right" for quadrant 1 ... "Lower right" for quadrant 4. */
export const quadrantName = (quadrant: number): string => SIDE_NAMES[quadrant] ?? `Quadrant ${quadrant}`;

const PERMANENT_NAMES = ['central incisor', 'lateral incisor', 'canine', 'first premolar', 'second premolar', 'first molar', 'second molar', 'wisdom tooth'];
const MILK_NAMES = ['central incisor', 'lateral incisor', 'canine', 'first molar', 'second molar'];

/** Plain name of a tooth: '36' -> 'Lower left first molar', '54' -> 'Upper right milk first molar'. */
export function toothName(tooth: string): string {
  const number = tooth.trim();
  if (!isValidFdiTooth(number)) return `Tooth ${number}`;
  const position = positionOf(number) - 1;
  const side = SIDE_NAMES[quadrantOf(number)];
  return isMilkTooth(number) ? `${side} milk ${MILK_NAMES[position]}` : `${side} ${PERMANENT_NAMES[position]}`;
}

/**
 * The teeth on a billed line. Lines from the screens hold "36" or "11,12"; the claim file and Eminance write up to
 * eight numbers without a separator ("1112"), so a run of digit pairs is split when every pair is a tooth. Anything
 * else is returned as invalid, so the screen can say a line could not be placed on the chart.
 */
export function parseBilledTeeth(text: string | null | undefined): { teeth: string[]; invalid: string[] } {
  const teeth: string[] = [];
  const invalid: string[] = [];
  for (const token of parseToothList(text ?? '')) {
    const pairs = /^\d{4,16}$/.test(token) && token.length % 2 === 0 ? token.match(/\d{2}/g) ?? [] : [token];
    if (pairs.every(pair => isValidFdiTooth(pair))) {
      pairs.forEach(pair => {
        if (!teeth.includes(pair)) teeth.push(pair);
      });
    } else {
      invalid.push(token);
    }
  }
  return { teeth, invalid };
}

/** Whole years from a date of birth to a day (both yyyy-MM-dd); null when either is missing or invalid. */
export function ageInYears(dateOfBirth: string | null | undefined, today: string): number | null {
  const born = toDateKey(dateOfBirth ?? null);
  if (!born || !isValidDateKey(today) || born > today) return null;
  const [bornYear, bornMonth, bornDay] = born.split('-').map(Number);
  const [year, month, day] = today.split('-').map(Number);
  const hadBirthday = month > bornMonth || (month === bornMonth && day >= bornDay);
  return year - bornYear - (hadBirthday ? 0 : 1);
}

/**
 * The chart to show first. By age: milk teeth only before 6, both from 6 to 12, permanent teeth from 13 (an unknown
 * age shows the permanent teeth). Records on the other set of teeth widen it to mixed, so nothing recorded is hidden.
 */
export function defaultDentition(dateOfBirth: string | null | undefined, today: string, recordedTeeth: readonly string[] = []): Dentition {
  const age = ageInYears(dateOfBirth, today);
  const byAge: Dentition = age === null || age >= 13 ? 'adult' : age < 6 ? 'child' : 'mixed';
  if (byAge === 'mixed') return byAge;
  const hasMilk = recordedTeeth.some(isMilkTooth);
  const hasPermanent = recordedTeeth.some(tooth => isValidFdiTooth(tooth) && !isMilkTooth(tooth));
  if (byAge === 'adult' && hasMilk) return 'mixed';
  if (byAge === 'child' && hasPermanent) return 'mixed';
  return byAge;
}
