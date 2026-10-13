/**
 * A patient's price rate (parity R28): Eminance lets an account carry a rate (private, staff, contract) that sets the
 * price of what is billed to it. OneHealth keeps one rate per patient (patient_price_rates,
 * proposals/2026-10-13-patient-price-rates.sql) and builds it on the prices it already has, never a second price list:
 * - the rate is a percentage of the usual price: the price the treating practitioner charges anyone for a code at the
 *   practice's price list (the practice tariff at their own rate, practitionerBilling.ts), times the patient's rate;
 * - a medical aid's own price for a code (its schedule, the practice's agreed price, a fund contract: fundPricing.ts)
 *   is never changed, so claims keep the fund's prices; a fee changed by hand stays as typed;
 * - a staff rate also bills medicines at the practice's staff medicine price (Stock > Settings, pricingRules.ts), when
 *   the practice has set one;
 * - the co-payment and the fund's levy are worked out on the rated price as on any other line.
 * Pure: the limits are the practitioner rate's (10% to 500%, 100% is the usual price), so both read the same.
 */
import { parseRatePercent, priceAtRate, type Parsed } from './practitionerBilling.ts';

export const PATIENT_RATE_KINDS = ['private', 'staff', 'contract'] as const;
export type PatientRateKind = (typeof PATIENT_RATE_KINDS)[number];

export const PATIENT_RATE_LABELS: Readonly<Record<PatientRateKind, string>> = {
  private: 'Private rate',
  staff: 'Staff rate',
  contract: 'Contract rate'
};

export interface PatientRate {
  kind: PatientRateKind;
  /** Percentage of the usual price; null: the usual price (a staff rate may be only the staff medicine price) */
  percent: number | null;
}

export const isPatientRateKind = (value: unknown): value is PatientRateKind =>
  typeof value === 'string' && (PATIENT_RATE_KINDS as readonly string[]).includes(value);

/** A patient_price_rates row as the rate; null for a row that cannot be read (priced as the usual price) */
export function patientRateFromRow(row: { kind?: unknown; percent?: unknown } | null | undefined): PatientRate | null {
  if (!row || !isPatientRateKind(row.kind)) return null;
  if (row.percent === null || row.percent === undefined) return { kind: row.kind, percent: null };
  const percent = parseRatePercent(Number(row.percent));
  return percent.ok ? { kind: row.kind, percent: percent.value } : null;
}

/** The rate as typed on the patient file: no kind is no rate; the percentage as a practitioner rate is typed */
export function parsePatientRate(kind: string, percentText: string): Parsed<PatientRate | null> {
  if (!kind) return { ok: true, value: null };
  if (!isPatientRateKind(kind)) return { ok: false, message: 'Choose a private, staff or contract rate.' };
  const percent = parseRatePercent(percentText);
  if (!percent.ok) return { ok: false, message: percent.message.replace('the price list', 'the usual price') };
  return { ok: true, value: { kind, percent: percent.value } };
}

/** The unit price at the patient's rate (whole cents, half up); the price itself without a rate or at 100% */
export const priceAtPatientRate = (usualPrice: number, rate: PatientRate | null | undefined): number => priceAtRate(usualPrice, rate?.percent ?? null);

/** "Staff rate: 50% of the usual price", "Staff rate: the usual price"; '' without a rate */
export function describePatientRate(rate: PatientRate | null | undefined): string {
  if (!rate) return '';
  return `${PATIENT_RATE_LABELS[rate.kind]}: ${rate.percent === null ? 'the usual price' : `${rate.percent}% of the usual price`}`;
}

/** The sentence above the billing lines when the patient has a rate that changes prices; null when it does not */
export function patientRateSentence(rate: PatientRate | null | undefined, fundPrices: boolean): string | null {
  if (!rate || rate.percent === null) return null;
  return `This patient has a ${PATIENT_RATE_LABELS[rate.kind].toLowerCase()}: new lines are billed at ${rate.percent}% of the usual price${fundPrices ? ' for codes at the practice tariff (the fund\'s own prices stay)' : ''}.`;
}

/** A staff rate bills medicines at the staff medicine price, when the practice has one */
export const staffMedicinePrice = (rate: PatientRate | null | undefined): boolean => rate?.kind === 'staff';

/**
 * A tariff list priced for the patient's fund (fundPricing.ts priceBillableTariffs) at the patient's rate: only the
 * codes at the practice tariff; a fund's own price, and a code that cannot be priced, stay as they are.
 */
export function billableAtPatientRate<T extends { unitPrice: number; priceSource: { kind: string }; priceProblem: string | null }>(
  tariffs: readonly T[],
  rate: PatientRate | null | undefined
): T[] {
  if (!rate || rate.percent === null) return [...tariffs];
  return tariffs.map(tariff =>
    tariff.priceProblem || tariff.priceSource.kind !== 'practice_tariff' ? tariff : { ...tariff, unitPrice: priceAtPatientRate(tariff.unitPrice, rate) }
  );
}
