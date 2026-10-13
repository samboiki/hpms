/**
 * Prepaid packages (parity D17): the practice sells a package (10 physiotherapy sessions, 5 consultations) on its own
 * invoice; each visit line that uses it is billed at N$ 0.00 and carries the package (invoice_services.package_id), and
 * the sessions used are counted from those lines on invoices that are not cancelled (billing_patient_packages,
 * proposals/2026-10-13-billing-extras.sql). What is left and until when shows on the patient's Billing tab and on the
 * visit's Billing tab, where a covered code added to the bill is paid from the package by itself (staff can bill it
 * normally instead). A medical aid patient's package line is the patient's (never claimed: the fund is not billed a
 * N$ 0.00 line). Money is in whole cents.
 */
import { addMonthsToKey, formatServiceDate, isValidDateKey } from './dates';
import { formatNad, fromCents, toCents } from './money';
import { coversCode, formatCodeList, parseCodeList } from './codeList';
import type { ServiceSelection } from '../../types/billing';

export const PACKAGE_LIMITS = { nameMin: 2, nameMax: 60, maxCodes: 20, maxSessions: 100, maxMonths: 60, maxPriceCents: 100_000_000 } as const;

export interface PackageType {
  id: string;
  name: string;
  codes: string[];
  sessions: number;
  priceCents: number;
  validMonths: number;
  isActive: boolean;
}

export interface PackageTypeRow {
  id: string;
  name: string;
  codes: string[] | null;
  sessions: number;
  price: number | string;
  valid_months: number;
  is_active: boolean | null;
}

export const normalizePackageType = (row: PackageTypeRow): PackageType => ({
  id: row.id,
  name: row.name,
  codes: row.codes ?? [],
  sessions: row.sessions,
  priceCents: toCents(Number(row.price)),
  validMonths: row.valid_months,
  isActive: row.is_active !== false
});

/** "10 sessions of 0190 for N$ 4,500.00, valid 6 months" */
export const describePackageType = (type: PackageType): string =>
  `${type.sessions} ${type.sessions === 1 ? 'session' : 'sessions'} of ${formatCodeList(type.codes)} for ${formatNad(fromCents(type.priceCents))}, valid ${type.validMonths} ${type.validMonths === 1 ? 'month' : 'months'}`;

export interface PatientPackage {
  id: string;
  name: string;
  codes: string[];
  sessions: number;
  priceCents: number;
  soldOn: string;
  /** Usable up to and including this day */
  expiresOn: string;
  saleInvoiceId: string | null;
  saleInvoiceNumber: string | null;
  /** Its invoice was cancelled (or is gone): nothing can be used from it */
  saleCancelled: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  /** Sessions used on saved invoices (without the visit being billed, when it was left out) */
  used: number;
}

export interface PatientPackageRow {
  id: string;
  name: string;
  codes: string[] | null;
  sessions: number;
  price: number | string;
  sold_on: string;
  expires_on: string;
  sale_invoice_id: string | null;
  sale_invoice_number: string | null;
  sale_cancelled: boolean | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  used: number | null;
}

export const normalizePatientPackage = (row: PatientPackageRow): PatientPackage => ({
  id: row.id,
  name: row.name,
  codes: row.codes ?? [],
  sessions: row.sessions,
  priceCents: toCents(Number(row.price)),
  soldOn: row.sold_on.slice(0, 10),
  expiresOn: row.expires_on.slice(0, 10),
  saleInvoiceId: row.sale_invoice_id,
  saleInvoiceNumber: row.sale_invoice_number,
  saleCancelled: row.sale_cancelled === true,
  cancelledAt: row.cancelled_at,
  cancelReason: row.cancel_reason,
  used: Math.max(0, Number(row.used ?? 0))
});

export type PackageState = 'active' | 'used_up' | 'expired' | 'cancelled';

/** Sessions left after `extra` more (the lines on the screen); below 0 when over-used */
export const sessionsLeft = (pack: PatientPackage, extra = 0): number => pack.sessions - pack.used - extra;

export function packageState(pack: PatientPackage, dateKey: string, extra = 0): PackageState {
  if (pack.cancelledAt || pack.saleCancelled) return 'cancelled';
  if (dateKey > pack.expiresOn) return 'expired';
  if (sessionsLeft(pack, extra) <= 0) return 'used_up';
  return 'active';
}

/** "7 of 10 left, until 12 Apr 2027" */
export function describePackageBalance(pack: PatientPackage, dateKey: string, extra = 0): string {
  const state = packageState(pack, dateKey, extra);
  if (state === 'cancelled') return pack.cancelledAt ? `Cancelled${pack.cancelReason ? `: ${pack.cancelReason}` : ''}` : 'Its invoice was cancelled';
  const left = Math.max(sessionsLeft(pack, extra), 0);
  if (state === 'expired') return `Expired on ${formatServiceDate(pack.expiresOn)} with ${left} of ${pack.sessions} left`;
  if (state === 'used_up') return `All ${pack.sessions} used`;
  return `${left} of ${pack.sessions} left, until ${formatServiceDate(pack.expiresOn)}`;
}

type BillLine = Pick<ServiceSelection, 'id' | 'code' | 'tariffId' | 'unitPrice' | 'quantity' | 'totalPrice' | 'serviceDate' | 'packageId' | 'promotionId' | 'discountAmount' | 'paidBy' | 'isAutoGenerated'>;

/** Sessions each package pays for on these lines */
export function usesOnLines(lines: readonly Pick<ServiceSelection, 'packageId' | 'quantity'>[]): Map<string, number> {
  const uses = new Map<string, number>();
  for (const line of lines) {
    if (!line.packageId) continue;
    const quantity = Number(line.quantity);
    uses.set(line.packageId, (uses.get(line.packageId) ?? 0) + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1));
  }
  return uses;
}

/** The package a code is paid from on a day: the one that runs out soonest among those with enough sessions left */
export function packageFor(packages: readonly PatientPackage[], code: string, dateKey: string, quantity: number, uses: ReadonlyMap<string, number>): PatientPackage | null {
  const usable = packages
    .filter(pack => pack.soldOn <= dateKey && coversCode(pack.codes, code) && packageState(pack, dateKey, uses.get(pack.id) ?? 0) === 'active'
      && sessionsLeft(pack, uses.get(pack.id) ?? 0) >= quantity)
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.soldOn.localeCompare(b.soldOn));
  return usable[0] ?? null;
}

export interface UsedPackage {
  lineId: string;
  code: string;
  pack: PatientPackage;
}

/**
 * The lines with each new line in `lineIds` that a package covers paid from it: N$ 0.00, the package named, any
 * discount or promotion taken off, the patient's for a medical aid patient (a N$ 0.00 line is never claimed).
 */
export function payFromPackages<T extends BillLine>(
  lines: readonly T[],
  packages: readonly PatientPackage[],
  options: { lineIds: ReadonlySet<string>; visitDateKey: string; hasMedicalAid: boolean }
): { lines: T[]; used: UsedPackage[] } {
  const uses = usesOnLines(lines);
  const used: UsedPackage[] = [];
  const next = lines.map(line => {
    if (!options.lineIds.has(line.id) || line.packageId || line.isAutoGenerated) return line;
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return line;
    const pack = packageFor(packages, line.code, line.serviceDate || options.visitDateKey, quantity, uses);
    if (!pack) return line;
    uses.set(pack.id, (uses.get(pack.id) ?? 0) + quantity);
    used.push({ lineId: line.id, code: line.code, pack });
    const paid = { ...line, unitPrice: 0, totalPrice: 0, packageId: pack.id, discountAmount: undefined, promotionId: undefined };
    return (options.hasMedicalAid ? { ...paid, paidBy: 'patient' } : paid) as T;
  });
  return { lines: next, used };
}

/**
 * The line billed normally again: the tariff's price for the visit (null when the code is no longer in the visit's
 * tariffs, then the line is left as it is and staff remove it instead), the fund's rules for who pays.
 */
export function billNormally<T extends BillLine>(line: T, tariffs: ReadonlyArray<{ id: string; price: unknown; default_paid_by?: ServiceSelection['paidBy'] | null }>): T | null {
  const tariff = tariffs.find(item => item.id === line.tariffId);
  const price = tariff ? Number(tariff.price) : NaN;
  if (!tariff || !Number.isFinite(price) || price < 0) return null;
  const quantity = Number(line.quantity);
  const { packageId: _package, ...rest } = line;
  void _package;
  return {
    ...rest,
    unitPrice: price,
    totalPrice: fromCents(Math.round(toCents(price) * (Number.isFinite(quantity) && quantity > 0 ? quantity : 1))),
    paidBy: tariff.default_paid_by ?? undefined
  } as T;
}

// ---------------------------------------------------------------------------------------------
// The administrator's form
// ---------------------------------------------------------------------------------------------

export interface PackageTypeDraft {
  id?: string;
  name: string;
  codes: string;
  sessions: string;
  price: string;
  validMonths: string;
  isActive: boolean;
}

export interface PackageTypePayload {
  id: string | null;
  practice_id: string;
  name: string;
  codes: string[];
  sessions: number;
  price: number;
  valid_months: number;
  is_active: boolean;
}

const wholeNumber = (text: string): number | null => (/^\d+$/.test(text.trim()) ? Number(text.trim()) : null);

/** The payload billing_save_package_type takes, or what to fix (the database checks the same) */
export function packageTypePayload(draft: PackageTypeDraft, practiceId: string): { payload: PackageTypePayload; error: null } | { payload: null; error: string } {
  const fail = (error: string) => ({ payload: null, error });
  const name = draft.name.trim();
  if (name.length < PACKAGE_LIMITS.nameMin || name.length > PACKAGE_LIMITS.nameMax) return fail('Give the package a name of 2 to 60 characters, for example "10 physio sessions".');
  const codes = parseCodeList(draft.codes, PACKAGE_LIMITS.maxCodes);
  if (codes.error !== null) return fail(codes.error);
  const sessions = wholeNumber(draft.sessions);
  if (sessions === null || sessions < 1 || sessions > PACKAGE_LIMITS.maxSessions) return fail(`Give the number of sessions, 1 to ${PACKAGE_LIMITS.maxSessions}.`);
  const priceText = draft.price.trim().replace(/^N\$\s*/i, '').replace(/,/g, '');
  const price = /^\d+(\.\d{1,2})?$/.test(priceText) ? Number(priceText) : NaN;
  if (!Number.isFinite(price) || price <= 0 || toCents(price) > PACKAGE_LIMITS.maxPriceCents) return fail('Give the price in N$, for example 4500 or 4,500.00.');
  const months = wholeNumber(draft.validMonths);
  if (months === null || months < 1 || months > PACKAGE_LIMITS.maxMonths) return fail(`Give how many months it is valid, 1 to ${PACKAGE_LIMITS.maxMonths}.`);
  return {
    payload: { id: draft.id ?? null, practice_id: practiceId, name, codes: codes.codes, sessions, price, valid_months: months, is_active: draft.isActive },
    error: null
  };
}

export function draftFromPackageType(type: PackageType | null): PackageTypeDraft {
  if (!type) return { name: '', codes: '', sessions: '10', price: '', validMonths: '6', isActive: true };
  return {
    id: type.id,
    name: type.name,
    codes: formatCodeList(type.codes),
    sessions: String(type.sessions),
    price: fromCents(type.priceCents).toFixed(2),
    validMonths: String(type.validMonths),
    isActive: type.isActive
  };
}

/** The day a package sold on `soldOn` is valid until: the same day N months on (the database's rule, end of a shorter month) */
export const validUntil = (soldOn: string, months: number): string | null =>
  isValidDateKey(soldOn) && Number.isInteger(months) && months >= 1 ? addMonthsToKey(soldOn, months) : null;
