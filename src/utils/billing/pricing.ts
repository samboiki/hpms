/**
 * Tariff selection and line pricing for billing.
 *
 * Business rules (practice owner: "people must not get wrong prices"):
 * - Only tariffs that are active and in effect on the service date can be billed.
 * - If a code appears more than once, the version with the latest effective_from wins. Two
 *   versions with the same start date but different prices are ambiguous, so the code is
 *   withheld rather than guessed.
 * - A line total is unit price x quantity, calculated in whole cents.
 * - Codes that cannot be multiplied (can_be_multiplied = NO) are billed with quantity 1;
 *   another tooth or another unit is another line, so quantity and total can never disagree.
 * - SOMETIMES / PROGRESSIVE codes are priced as unit x quantity and flagged for review. No
 *   discount is invented: earlier code applied made-up 50% / 80% rates for extra units.
 * - The medical aid share is a percentage of the line total (100% when the patient is on
 *   medical aid, unless a lower cover is given); the patient pays the rest, to the cent.
 */
import { formatNad, fromCents, hasAtMostDecimals, multiplyCents, percentOfCents, toCents } from './money.ts';
import { isValidDateKey, toDateKey } from './dates.ts';

export type MultiplyRule = 'NO' | 'YES' | 'SOMETIMES' | 'PROGRESSIVE';

export const MAX_QUANTITY = 99;
export const MAX_UNIT_PRICE = 1_000_000;

/**
 * 8346 (restorative material) is billed at this percentage of its restorative procedure's unit
 * price, for the same quantity (to be confirmed against the NAMAF dental schedule).
 */
export const MATERIAL_FACTOR_PERCENT = 10;

/**
 * The 8346 unit price for a procedure's unit price, rounded half-up to the cent, so the material
 * line's total is exactly unit x quantity like every other line.
 */
export function materialFactorUnitPrice(procedureUnitPrice: number): number {
  return fromCents(percentOfCents(toCents(procedureUnitPrice), MATERIAL_FACTOR_PERCENT));
}

/** The fields of a practice_tariffs / practice_tariffs_with_types row that billing uses. */
export interface TariffRow {
  id: string | null;
  code: string | null;
  description?: string | null;
  price: number | string | null;
  unit?: string | null;
  is_active?: boolean | null;
  effective_from?: string | null;
  effective_to?: string | null;
  can_be_multiplied?: string | boolean | null;
  requires_tooth_number?: string | boolean | null;
  business_rule_formula?: string | null;
  example_calculation?: string | null;
  notes?: string | null;
}

/** A tariff that may be billed on a given service date. */
export interface BillableTariff {
  id: string;
  code: string;
  description: string;
  unitPrice: number;
  unit: string;
  multiplyRule: MultiplyRule;
  requiresTooth: boolean;
  businessRule: string | null;
  exampleCalculation: string | null;
  notes: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export type TariffExclusionReason =
  | 'missing_code'
  | 'inactive'
  | 'invalid_dates'
  | 'not_yet_effective'
  | 'expired'
  | 'invalid_price'
  | 'superseded'
  | 'conflicting_duplicate';

export interface TariffExclusion {
  id: string | null;
  code: string;
  reason: TariffExclusionReason;
}

export const TARIFF_EXCLUSION_LABELS: Record<TariffExclusionReason, string> = {
  missing_code: 'missing code',
  inactive: 'inactive',
  invalid_dates: 'invalid effective dates',
  not_yet_effective: 'not yet in effect',
  expired: 'expired',
  invalid_price: 'missing or invalid price',
  superseded: 'replaced by a newer price',
  conflicting_duplicate: 'duplicate code with conflicting prices'
};

/** Reads can_be_multiplied. Anything unknown is treated as NO (quantity 1), the safe default. */
export function normalizeMultiplyRule(value: unknown): MultiplyRule {
  if (value === true) return 'YES';
  if (typeof value !== 'string') return 'NO';
  const text = value.trim().toUpperCase();
  if (text === 'YES' || text === 'Y' || text === 'TRUE') return 'YES';
  if (text === 'SOMETIMES') return 'SOMETIMES';
  if (text === 'PROGRESSIVE') return 'PROGRESSIVE';
  return 'NO';
}

/** Reads YES/NO style flags such as requires_tooth_number. */
export function parseYesNo(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const text = value.trim().toUpperCase();
  return text === 'YES' || text === 'Y' || text === 'TRUE';
}

/** Parses a tariff price (number or numeric string) to N$ rounded to cents; null when unusable. */
export function parseTariffPrice(value: unknown): number | null {
  let amount: number;
  if (typeof value === 'number') {
    amount = value;
  } else if (typeof value === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(value)) {
    amount = Number(value);
  } else {
    return null;
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_UNIT_PRICE) return null;
  return fromCents(toCents(amount));
}

const blankToNull = (value: string | null | undefined): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const codeKey = (code: string): string => code.trim().toUpperCase();

/** Why a tariff row cannot be billed on `serviceDate` (yyyy-MM-dd), or null when it can. */
export function getTariffExclusion(row: TariffRow, serviceDate: string): TariffExclusionReason | null {
  if (!row.id || !blankToNull(row.code)) return 'missing_code';
  if (row.is_active === false) return 'inactive';
  const rawFrom = blankToNull(row.effective_from);
  const rawTo = blankToNull(row.effective_to);
  const from = rawFrom ? toDateKey(rawFrom) : null;
  const to = rawTo ? toDateKey(rawTo) : null;
  if ((rawFrom && !from) || (rawTo && !to) || (from && to && from > to)) return 'invalid_dates';
  if (from && serviceDate < from) return 'not_yet_effective';
  if (to && serviceDate > to) return 'expired';
  if (parseTariffPrice(row.price) === null) return 'invalid_price';
  return null;
}

const toBillable = (row: TariffRow): BillableTariff => ({
  id: String(row.id),
  code: String(row.code).trim(),
  description: blankToNull(row.description) ?? '',
  unitPrice: parseTariffPrice(row.price) as number,
  unit: blankToNull(row.unit) ?? '',
  multiplyRule: normalizeMultiplyRule(row.can_be_multiplied),
  requiresTooth: parseYesNo(row.requires_tooth_number),
  businessRule: blankToNull(row.business_rule_formula),
  exampleCalculation: blankToNull(row.example_calculation),
  notes: blankToNull(row.notes),
  effectiveFrom: row.effective_from ? toDateKey(row.effective_from) : null,
  effectiveTo: row.effective_to ? toDateKey(row.effective_to) : null
});

/** Orders tariff codes naturally ('0190' < '0191' < '8101'), then by id for stable results. */
export const compareTariffCodes = (a: { code: string; id?: string }, b: { code: string; id?: string }): number =>
  a.code.localeCompare(b.code, 'en', { numeric: true }) || (a.id ?? '').localeCompare(b.id ?? '');

/**
 * Returns the tariffs that can be billed on `serviceDate` (one per code) and the rows that were
 * left out, with the reason, so the screen can tell staff what to fix in the tariff list.
 */
export function selectBillableTariffs(
  rows: readonly TariffRow[],
  serviceDate: string
): { tariffs: BillableTariff[]; excluded: TariffExclusion[] } {
  if (!isValidDateKey(serviceDate)) {
    throw new RangeError(`serviceDate must be a yyyy-MM-dd date: ${serviceDate}`);
  }
  const excluded: TariffExclusion[] = [];
  const groups = new Map<string, BillableTariff[]>();

  for (const row of rows) {
    const reason = getTariffExclusion(row, serviceDate);
    if (reason) {
      excluded.push({ id: row.id ?? null, code: (row.code ?? '').trim(), reason });
      continue;
    }
    const tariff = toBillable(row);
    const key = codeKey(tariff.code);
    groups.set(key, [...(groups.get(key) ?? []), tariff]);
  }

  const tariffs: BillableTariff[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort(
      (a, b) => (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? '') || a.id.localeCompare(b.id)
    );
    const latestFrom = ordered[0].effectiveFrom;
    const latest = ordered.filter(t => t.effectiveFrom === latestFrom);
    ordered
      .filter(t => t.effectiveFrom !== latestFrom)
      .forEach(t => excluded.push({ id: t.id, code: t.code, reason: 'superseded' }));

    const first = latest[0];
    const sameTerms = latest.every(
      t =>
        toCents(t.unitPrice) === toCents(first.unitPrice) &&
        t.multiplyRule === first.multiplyRule &&
        t.requiresTooth === first.requiresTooth
    );
    if (sameTerms) {
      tariffs.push(first);
      latest.slice(1).forEach(t => excluded.push({ id: t.id, code: t.code, reason: 'superseded' }));
    } else {
      latest.forEach(t => excluded.push({ id: t.id, code: t.code, reason: 'conflicting_duplicate' }));
    }
  }

  return { tariffs: tariffs.sort(compareTariffCodes), excluded };
}

/** Counts exclusions by reason (for a short "n codes hidden" note). */
export function summarizeExclusions(excluded: readonly TariffExclusion[]): Partial<Record<TariffExclusionReason, number>> {
  return excluded.reduce<Partial<Record<TariffExclusionReason, number>>>((counts, item) => {
    counts[item.reason] = (counts[item.reason] ?? 0) + 1;
    return counts;
  }, {});
}

/**
 * Searches by code and description. Every word typed must match the code or the description.
 * Exact code first, then codes starting with the text, then other matches; ties by code.
 */
export function searchTariffs<T extends { code: string; description: string; id?: string }>(
  tariffs: readonly T[],
  query: string
): T[] {
  const text = query.trim().toLowerCase();
  if (!text) return [...tariffs].sort(compareTariffCodes);
  const words = text.split(/\s+/);
  const rank = (tariff: T): number => {
    const code = tariff.code.toLowerCase();
    const description = tariff.description.toLowerCase();
    if (code === text) return 0;
    if (code.startsWith(text)) return 1;
    if (code.includes(text)) return 2;
    if (description.startsWith(words[0]) || description.includes(` ${words[0]}`)) return 3;
    return 4;
  };
  return tariffs
    .filter(tariff => {
      const code = tariff.code.toLowerCase();
      const description = tariff.description.toLowerCase();
      return words.every(word => code.includes(word) || description.includes(word));
    })
    .map(tariff => ({ tariff, rank: rank(tariff) }))
    .sort((a, b) => a.rank - b.rank || compareTariffCodes(a.tariff, b.tariff))
    .map(item => item.tariff);
}

const FDI_TOOTH_PATTERN = /^(?:[1-4][1-8]|[5-8][1-5])$/;

/** FDI tooth numbers: permanent 11-18, 21-28, 31-38, 41-48; primary (milk) 51-55 ... 81-85. */
export function isValidFdiTooth(tooth: string): boolean {
  return FDI_TOOTH_PATTERN.test(tooth.trim());
}

/** Splits "11 12, 21" into ['11', '12', '21']. */
export function parseToothList(text: string): string[] {
  return text.split(/[\s,;]+/).map(part => part.trim()).filter(Boolean);
}

export interface LineInput {
  /** Tariff code, used in messages. */
  code?: string;
  /** N$ per unit, from the tariff. */
  unitPrice: number;
  quantity: number;
  multiplyRule: MultiplyRule;
  requiresTooth?: boolean;
  toothNumbers?: readonly string[];
  /** Whether this patient's bill goes to a medical aid. */
  hasMedicalAid: boolean;
  /** Share of the line the medical aid pays, 0-100 (default 100 when hasMedicalAid). */
  coveragePercent?: number;
  /** Tariff business rule text, shown when the line needs review. */
  businessRule?: string | null;
}

export interface LineResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Quantity > 1 on a SOMETIMES / PROGRESSIVE code: check the price against the tariff. */
  needsReview: boolean;
  unitPrice: number;
  quantity: number;
  total: number;
  medicalAidAmount: number;
  patientAmount: number;
  unitCents: number;
  totalCents: number;
  medicalAidCents: number;
  patientCents: number;
}

/**
 * THE line calculation: validates a billing line and returns its total and the medical aid /
 * patient split in whole cents. An invalid line returns ok=false and zero amounts, so it can
 * never add money to an invoice silently.
 */
export function computeLine(input: LineInput): LineResult {
  const label = input.code ? `Code ${input.code}` : 'This service';
  const errors: string[] = [];
  const warnings: string[] = [];

  let unitCents: number | null = null;
  if (typeof input.unitPrice !== 'number' || !Number.isFinite(input.unitPrice)) {
    errors.push(`${label}: the price is missing or not a number.`);
  } else if (input.unitPrice < 0) {
    errors.push(`${label}: the price cannot be negative.`);
  } else if (input.unitPrice > MAX_UNIT_PRICE) {
    errors.push(`${label}: the price is above ${formatNad(MAX_UNIT_PRICE)}; check the tariff.`);
  } else {
    unitCents = toCents(input.unitPrice);
    if (unitCents === 0) warnings.push(`${label}: the price is N$ 0.00; check the tariff before billing.`);
  }

  const quantity = input.quantity;
  let quantityOk = false;
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) {
    errors.push(`${label}: the quantity must be a number greater than 0.`);
  } else if (!hasAtMostDecimals(quantity, 2)) {
    errors.push(`${label}: the quantity can have at most 2 decimals.`);
  } else if (quantity > MAX_QUANTITY) {
    errors.push(`${label}: the quantity cannot be more than ${MAX_QUANTITY}.`);
  } else if (input.multiplyRule === 'NO' && quantity !== 1) {
    errors.push(`${label} is billed once per line (quantity 1). Add another line instead.`);
  } else {
    quantityOk = true;
  }

  const needsReview =
    quantityOk && quantity > 1 && (input.multiplyRule === 'SOMETIMES' || input.multiplyRule === 'PROGRESSIVE');
  if (needsReview) {
    const rule = input.businessRule ? `: ${input.businessRule}` : '';
    warnings.push(
      `${label} has a special quantity rule (${input.multiplyRule.toLowerCase()})${rule}. ` +
        'The price shown is unit price x quantity; check it against the tariff.'
    );
  }

  const teeth = (input.toothNumbers ?? []).map(tooth => tooth.trim()).filter(Boolean);
  if (input.requiresTooth && teeth.length === 0) {
    errors.push(`${label} needs a tooth number.`);
  }
  const seenTeeth = new Set<string>();
  for (const tooth of teeth) {
    if (!isValidFdiTooth(tooth)) {
      errors.push(`${label}: "${tooth}" is not a valid tooth number (FDI 11-48, or 51-85 for milk teeth).`);
    } else if (seenTeeth.has(tooth)) {
      errors.push(`${label}: tooth ${tooth} is listed twice.`);
    }
    seenTeeth.add(tooth);
  }
  if (quantityOk && teeth.length > 1 && input.multiplyRule === 'NO') {
    warnings.push(
      `${label} is priced once per line but ${teeth.length} teeth are listed; if it is charged per tooth, add one line per tooth.`
    );
  } else if (quantityOk && teeth.length > 0 && input.multiplyRule !== 'NO' && teeth.length !== quantity) {
    warnings.push(`${label}: quantity ${quantity} but ${teeth.length} tooth number(s) listed; check the quantity.`);
  }

  let coverage = 0;
  if (input.hasMedicalAid) {
    const percent = input.coveragePercent ?? 100;
    if (
      typeof percent !== 'number' ||
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent > 100 ||
      !hasAtMostDecimals(percent, 2)
    ) {
      errors.push(`${label}: the medical aid cover must be between 0% and 100%.`);
    } else {
      coverage = percent;
    }
  }

  if (errors.length > 0 || unitCents === null) {
    return {
      ok: false,
      errors,
      warnings,
      needsReview,
      unitPrice: 0,
      quantity: quantityOk ? quantity : 0,
      total: 0,
      medicalAidAmount: 0,
      patientAmount: 0,
      unitCents: 0,
      totalCents: 0,
      medicalAidCents: 0,
      patientCents: 0
    };
  }

  const totalCents = multiplyCents(unitCents, quantity);
  const medicalAidCents = percentOfCents(totalCents, coverage);
  const patientCents = totalCents - medicalAidCents;
  return {
    ok: true,
    errors,
    warnings,
    needsReview,
    unitPrice: fromCents(unitCents),
    quantity,
    total: fromCents(totalCents),
    medicalAidAmount: fromCents(medicalAidCents),
    patientAmount: fromCents(patientCents),
    unitCents,
    totalCents,
    medicalAidCents,
    patientCents
  };
}

export interface LinesSummary {
  subtotal: number;
  medicalAid: number;
  patient: number;
  subtotalCents: number;
  medicalAidCents: number;
  patientCents: number;
  lineCount: number;
  invalidCount: number;
  reviewCount: number;
}

/** Adds up computed lines (invalid lines count as invalid and add nothing). */
export function summarizeLines(lines: readonly LineResult[]): LinesSummary {
  const valid = lines.filter(line => line.ok);
  const subtotalCents = valid.reduce((sum, line) => sum + line.totalCents, 0);
  const medicalAidCents = valid.reduce((sum, line) => sum + line.medicalAidCents, 0);
  const patientCents = valid.reduce((sum, line) => sum + line.patientCents, 0);
  return {
    subtotal: fromCents(subtotalCents),
    medicalAid: fromCents(medicalAidCents),
    patient: fromCents(patientCents),
    subtotalCents,
    medicalAidCents,
    patientCents,
    lineCount: lines.length,
    invalidCount: lines.length - valid.length,
    reviewCount: lines.filter(line => line.needsReview).length
  };
}

/**
 * Checks that a stored line is internally consistent: total = unit price x quantity to the cent,
 * with a non-negative price and a positive quantity. Used before invoice lines are saved.
 */
export function verifyLineAmounts(
  unitPrice: number,
  quantity: number,
  totalPrice: number
): { ok: true; total: number } | { ok: false; message: string } {
  if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > MAX_UNIT_PRICE) {
    return { ok: false, message: 'the unit price is missing, negative or too large' };
  }
  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > MAX_QUANTITY ||
    !hasAtMostDecimals(quantity, 2)
  ) {
    return { ok: false, message: `the quantity must be between 0 and ${MAX_QUANTITY} with at most 2 decimals` };
  }
  if (typeof totalPrice !== 'number' || !Number.isFinite(totalPrice)) {
    return { ok: false, message: 'the line total is missing' };
  }
  const expectedCents = multiplyCents(toCents(unitPrice), quantity);
  if (toCents(totalPrice) !== expectedCents) {
    return {
      ok: false,
      message: `the total ${formatNad(totalPrice)} does not equal ${quantity} x ${formatNad(unitPrice)} = ${formatNad(fromCents(expectedCents))}`
    };
  }
  return { ok: true, total: fromCents(expectedCents) };
}
