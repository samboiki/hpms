/**
 * Billing lines for the visit screens (AddVisitTabs and EditVisitTabs). Every amount comes from the
 * shared billing module: the tariff's own price and can_be_multiplied rule, unit price x quantity in
 * whole cents. There is no fallback price and no discount for extra units.
 * For a medical aid patient the tariff list is first priced by priceForPatient (fundPricing.ts): the fund's
 * own price where its schedule has the code, otherwise the practice tariff.
 */
import type { Database } from '../../types/database.types';
import type { ServiceSelection } from '../../types/billing';
import {
  MATERIAL_FACTOR_PERCENT,
  MAX_QUANTITY,
  computeLine,
  materialFactorUnitPrice,
  normalizeMultiplyRule,
  parseTariffPrice,
  selectBillableTariffs,
  type LineInput,
  type LineResult,
  type MultiplyRule,
  type TariffRow
} from '../../utils/billing/pricing';
import { formatNad, fromCents, hasAtMostDecimals, sumCents, toCents } from '../../utils/billing/money';
import {
  INFECTION_CONTROL_CODE,
  MATERIAL_FACTOR_CODE,
  MAX_INFECTION_CONTROL_STAFF,
  infectionControlStaffCount,
  isDentalPractice
} from '../../utils/billing/tariffRules';
import {
  describePriceSource,
  fundHasPrices,
  fundPriceFor,
  type FundPriceBook,
  type FundPriceSource,
  type PatientFundKey
} from '../../utils/billing/fundPricing';
import { MAX_FEE_REASON_LENGTH, buildInvoiceLineRow, buildInvoiceLineRows, type InvoiceLineContext } from '../../utils/billing/invoiceLineRow';
import { isPaidBy, type PaidBy } from '../../utils/billing/lineSplit';
import { describeRate, priceAtRate } from '../../utils/billing/practitionerBilling';
import { patientRateSentence, priceAtPatientRate, type PatientRate } from '../../utils/billing/patientRates';
import { isQuadrant } from '../../utils/dental/lineTeeth';

/** The practice_tariffs_with_types fields the visit screens bill from. */
export interface VisitTariff {
  id: string;
  code: string;
  description?: string | null;
  price: unknown;
  can_be_multiplied?: unknown;
  requires_tooth_number?: unknown;
  business_rule_formula?: string | null;
  example_calculation?: string | null;
  is_active?: boolean | null;
  effective_from?: string | null;
  effective_to?: string | null;
  /** Set by priceForPatient: where `price` came from (the practice tariff unless a fund price applies) */
  price_source?: FundPriceSource;
  /** Set by priceForPatient when the fund's price is ambiguous: the code cannot be billed for this patient */
  price_problem?: string | null;
  /** Set by priceForPatient when the patient's fund has its own prices but not for this code */
  price_warning?: string | null;
  /** Set by withDisciplineRules: the most one line may bill (dental 8109: one per clinical staff member, 3) */
  max_quantity?: number | null;
  /** The practice's own version of the code (Admin > Tariffs), not the shared list's */
  is_own?: boolean;
  /** Who pays new lines of the code (the practice's default portion); absent: the fund's co-payment and levy */
  default_paid_by?: PaidBy | null;
  /** Set by priceForPatient when a practitioner's rate applies: the practice's list price before it */
  list_price?: number;
  /** Set by priceForPatient: the practitioner's rate included in `price` (practitionerBilling.ts) */
  rate_percent?: number;
  /** Set by priceForPatient: the patient's own rate included in `price` (patientRates.ts) */
  patient_rate_percent?: number;
}

/** A new billing line, or why it cannot be billed (the screen shows the message and adds nothing). */
export type LineOutcome =
  | { ok: true; service: ServiceSelection; warnings: string[] }
  | { ok: false; message: string };

type InvoiceServiceInsert = Database['public']['Tables']['invoice_services']['Insert'];

// The screens look codes up among the billable tariffs, so "missing" also covers inactive, expired,
// not yet effective and conflicting rows
const notInTariffListMessage = (code: string): string =>
  `Code ${code} has no tariff in effect for this visit date in the practice's tariff list, so it was not added. Ask an administrator to check the tariff list.`;

const noPriceMessage = (code: string): string =>
  `Code ${code} has no valid price in the tariff list, so it was not added. Ask an administrator to fix the tariff.`;

const refusedMessage = (line: LineResult): string => `${line.errors.join(' ')} The line was not added.`;

const medicalAidFlags = (hasMedicalAid: boolean) => ({
  medicalAidCovered: hasMedicalAid,
  coveragePercentage: hasMedicalAid ? 100 : 0
});

/**
 * The tariff rows that may be billed on `serviceDate` (yyyy-MM-dd): active, in effect and one version
 * per code (selectBillableTariffs), each with its cleaned, cent-rounded price. Inactive, expired,
 * superseded and conflicting rows are left out, so a lookup by code finds the current tariff.
 */
export function billableVisitTariffs<T extends VisitTariff>(rows: readonly T[], serviceDate: string): T[] {
  const { tariffs } = selectBillableTariffs(rows as unknown as readonly TariffRow[], serviceDate);
  const rowById = new Map<string, T>();
  rows.forEach(row => {
    if (!rowById.has(row.id)) rowById.set(row.id, row);
  });
  return tariffs.flatMap(tariff => {
    const row = rowById.get(tariff.id);
    return row ? [{ ...row, price: tariff.unitPrice }] : [];
  });
}

/**
 * Tooth numbers, 8109 per staff member and 8346 are NAMAF dental rules: for other practice types (GP, specialists...)
 * a tariff never asks for a tooth, even if its row is flagged, so the screens never block a line on a tooth.
 */
export function withDisciplineRules<T extends VisitTariff>(tariffs: readonly T[], practiceType: string | null | undefined): T[] {
  if (isDentalPractice(practiceType)) {
    // 8109 is billed per dentist, hygienist and assistant, however it is added (automatically, by hand or in a bundle)
    return tariffs.map(tariff => (tariff.code === INFECTION_CONTROL_CODE ? { ...tariff, max_quantity: MAX_INFECTION_CONTROL_STAFF } : tariff));
  }
  return tariffs.map(tariff => (tariff.requires_tooth_number === 'YES' ? { ...tariff, requires_tooth_number: 'NO' } : tariff));
}

/** What priceForPatient needs besides the tariffs and the date. */
export interface VisitPricing {
  practiceId: string | null;
  /** null: no medical aid */
  fund: PatientFundKey | null;
  book: FundPriceBook;
  /** The treating practitioner's rate, a percentage of the practice's price list (practitionerBilling.ts); null: none */
  ratePercent?: number | null;
  /** The patient's own price rate (patientRates.ts); null or absent: none */
  patientRate?: PatientRate | null;
}

/**
 * The billable tariffs priced for one patient on the service date (fundPriceFor): the fund's price where it has one
 * for the code, otherwise the practice tariff, at the patient's own rate when they have one (atPatientRate) and the
 * treating practitioner's rate on top when they have one (atPractitionerRate). Without pricing (null), or for a patient
 * without medical aid or a fund without prices, the fund leaves the list unchanged.
 */
export function priceForPatient<T extends VisitTariff>(tariffs: readonly T[], serviceDate: string, pricing: VisitPricing | null): T[] {
  return atPractitionerRate(atPatientRate(priceForFund(tariffs, serviceDate, pricing), pricing?.patientRate ?? null), pricing?.ratePercent ?? null);
}

/** A tariff whose price is the practice's own list price (no fund schedule or contract price, no price problem). */
const atPracticeListPrice = (tariff: Pick<VisitTariff, 'price_source' | 'price_problem'>): boolean =>
  !tariff.price_problem && (!tariff.price_source || tariff.price_source.kind === 'practice_tariff');

/**
 * The practice's list prices at a practitioner's rate (practitionerBilling.ts priceAtRate): a code priced at the
 * practice tariff gets its list price x the rate and keeps the list price (list_price), so a line can move to another
 * practitioner's rate later; a fund's own price is never changed. No rate: the list as it is.
 */
export function atPractitionerRate<T extends VisitTariff>(tariffs: readonly T[], ratePercent: number | null): T[] {
  if (ratePercent === null || ratePercent === 100) return [...tariffs];
  return tariffs.map(tariff => {
    const listPrice = atPracticeListPrice(tariff) ? parseTariffPrice(tariff.price) : null;
    return listPrice === null ? tariff : { ...tariff, price: priceAtRate(listPrice, ratePercent), list_price: listPrice, rate_percent: ratePercent };
  });
}

/**
 * The practice's list prices at the patient's own rate (patientRates.ts): a code priced at the practice tariff gets
 * its price x the rate, and that rated price is the list a practitioner's rate then works from (so a line moving to
 * another practitioner keeps the patient's rate); a fund's own price is never changed. No rate, or 100%: as it is.
 */
export function atPatientRate<T extends VisitTariff>(tariffs: readonly T[], rate: PatientRate | null): T[] {
  const percent = rate?.percent ?? null;
  if (!rate || percent === null) return [...tariffs];
  return tariffs.map(tariff => {
    const listPrice = atPracticeListPrice(tariff) ? parseTariffPrice(tariff.price) : null;
    return listPrice === null ? tariff : { ...tariff, price: priceAtPatientRate(listPrice, rate), patient_rate_percent: percent };
  });
}

/** The fund's prices for the patient (see priceForPatient). */
function priceForFund<T extends VisitTariff>(tariffs: readonly T[], serviceDate: string, pricing: VisitPricing | null): T[] {
  const fund = pricing?.fund;
  if (!pricing || !fund?.reference) return [...tariffs];
  const context = { serviceDate, practiceId: pricing.practiceId, fund, book: pricing.book };
  const fundPrices = fundHasPrices(context);
  const fundLabel = fund.name?.trim() ? `${fund.name.trim()} (${fund.reference})` : fund.reference;
  return tariffs.map(tariff => {
    const practicePrice = parseTariffPrice(tariff.price);
    if (practicePrice === null) return tariff;
    const price = fundPriceFor(tariff.code, practicePrice, context);
    if (!price.ok) return { ...tariff, price_problem: price.message };
    if (price.source.kind !== 'practice_tariff') return { ...tariff, price: price.unitPrice, price_source: price.source };
    if (!fundPrices) return tariff;
    return {
      ...tariff,
      price_source: price.source,
      price_warning: `${fundLabel} has no price for code ${tariff.code} on this date, so the practice tariff is billed. Check the fund's rate before claiming.`
    };
  });
}

/**
 * The sentence above a patient's billing lines when their fund has its own prices on the service date; null when
 * every line is billed at the practice tariff (private patients, funds without a schedule).
 */
export function fundPricingNotice(pricing: VisitPricing | null, serviceDate: string): string | null {
  const fund = pricing?.fund;
  const fundPrices = Boolean(pricing && fund?.reference && fundHasPrices({ serviceDate, practiceId: pricing.practiceId, fund, book: pricing.book }));
  const label = fund?.name?.trim() ? `${fund.name.trim()} (${fund.reference})` : fund?.reference;
  const fundSentence = fundPrices ? `${label} prices: codes on the fund's schedule are billed at the fund's price, other codes at the practice tariff.` : null;
  // A practitioner's own rate (parity D31) prices the practice tariff's codes, never the fund's own prices
  const rate = describeRate(pricing?.ratePercent);
  const rateSentence = rate ? `New lines are priced at the treating practitioner's rate: ${rate}${fundPrices ? ' for codes at the practice tariff' : ''}.` : null;
  // The patient's own rate (R28) works on the same prices, never the fund's own
  return [fundSentence, rateSentence, patientRateSentence(pricing?.patientRate, fundPrices)].filter(Boolean).join(' ') || null;
}

/** Plain words for where a tariff's price comes from ("MAG1 fund schedule", "practice tariff"). */
export const priceSourceLabel = (tariff: Pick<VisitTariff, 'price_source'>): string =>
  describePriceSource(tariff.price_source ?? { kind: 'practice_tariff' });

/** The visit's billing total, added up in whole cents so it equals the sum of the lines shown. */
export function sumServiceTotals(services: readonly ServiceSelection[]): number {
  return fromCents(sumCents(services.map(service => (Number.isFinite(service.totalPrice) ? toCents(service.totalPrice) : 0))));
}

/** computeLine input for `quantity` of a tariff (its own price and quantity rule); null without a usable price. */
export function tariffLineInput(tariff: VisitTariff, quantity: number, hasMedicalAid: boolean): LineInput | null {
  if (tariff.price_problem) return null;
  const unitPrice = parseTariffPrice(tariff.price);
  if (unitPrice === null) return null;
  return {
    code: tariff.code,
    unitPrice,
    quantity,
    // A tariff with its own limit (8109) is billed per unit up to that limit, whatever its row's quantity flag says
    multiplyRule: tariff.max_quantity ? 'YES' : normalizeMultiplyRule(tariff.can_be_multiplied),
    hasMedicalAid,
    businessRule: tariff.business_rule_formula ?? null
  };
}

const overLimitMessage = (code: string, max: number): string =>
  `Code ${code} is billed per clinical staff member: a whole number from 1 to ${max}. The line was not added.`;

/** A line for a tariff picked on the visit screen, priced by computeLine. */
export function buildTariffLine(
  tariff: VisitTariff,
  quantity: number,
  toothNumber: string,
  hasMedicalAid: boolean
): LineOutcome {
  if (tariff.price_problem) return { ok: false, message: tariff.price_problem };
  const max = tariff.max_quantity ?? null;
  if (max !== null && (!Number.isInteger(quantity) || quantity < 1 || quantity > max)) {
    return { ok: false, message: overLimitMessage(tariff.code, max) };
  }
  const input = tariffLineInput(tariff, quantity, hasMedicalAid);
  if (!input) return { ok: false, message: noPriceMessage(tariff.code) };
  const requiresTooth = tariff.requires_tooth_number === 'YES';
  const line = computeLine({ ...input, requiresTooth, toothNumbers: toothNumber ? [toothNumber] : [] });
  if (!line.ok) return { ok: false, message: refusedMessage(line) };
  return {
    ok: true,
    warnings: tariff.price_warning ? [...line.warnings, tariff.price_warning] : line.warnings,
    service: {
      id: crypto.randomUUID(),
      tariffId: tariff.id,
      code: tariff.code,
      description: `${tariff.description}${toothNumber ? ` (Tooth ${toothNumber})` : ''}`,
      category: 'Dental Service',
      subcategory: 'General',
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      totalPrice: line.total,
      requiresPreAuth: false,
      ...medicalAidFlags(hasMedicalAid),
      businessRule: tariff.business_rule_formula ?? undefined,
      exampleCalculation: tariff.example_calculation ?? undefined,
      requiresTeethNumbers: requiresTooth,
      // SOMETIMES / PROGRESSIVE codes may have quantity > 1; invoiceService refuses that only for NO codes
      canBeMultiplied: input.multiplyRule !== 'NO',
      teethNumbers: toothNumber ? [toothNumber] : undefined,
      ...(max !== null ? { maxQuantity: max } : {}),
      // The code's default portion (Admin > Tariffs): a medical aid patient's line starts paid by that side only
      ...(hasMedicalAid && tariff.default_paid_by ? { paidBy: tariff.default_paid_by } : {})
    }
  };
}

/**
 * The 8109 infection-control line (dental practices, once per visit), priced from the 8109 tariff; no tariff, no
 * line. NAMAF bills it per dentist, hygienist and assistant, so the quantity is the clinical staff count (1-3: the
 * practice setting, 1 without one) and staff can change it on the line.
 */
export function buildInfectionControlLine(
  tariffs: readonly VisitTariff[],
  hasMedicalAid: boolean,
  parentServiceId?: string,
  staffCount: number = 1
): LineOutcome {
  const tariff = tariffs.find(item => item.code === INFECTION_CONTROL_CODE);
  if (!tariff) return { ok: false, message: notInTariffListMessage(INFECTION_CONTROL_CODE) };
  if (tariff.price_problem) return { ok: false, message: tariff.price_problem };
  const input = tariffLineInput(tariff, infectionControlStaffCount(staffCount), hasMedicalAid);
  if (!input) return { ok: false, message: noPriceMessage(INFECTION_CONTROL_CODE) };
  // The staff count is NAMAF's rule for 8109, whatever quantity flag the tariff row carries
  const line = computeLine({ ...input, multiplyRule: 'YES' });
  if (!line.ok) return { ok: false, message: refusedMessage(line) };
  return {
    ok: true,
    warnings: tariff.price_warning ? [...line.warnings, tariff.price_warning] : line.warnings,
    service: {
      id: crypto.randomUUID(),
      tariffId: tariff.id,
      code: INFECTION_CONTROL_CODE,
      description: 'Infection control per visit (Auto-added)',
      category: 'Dental Service',
      subcategory: 'Infection Control',
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      totalPrice: line.total,
      requiresPreAuth: false,
      ...medicalAidFlags(hasMedicalAid),
      businessRule: `Per clinical staff member at the visit (dentist, hygienist, assistant), at most ${MAX_INFECTION_CONTROL_STAFF}`,
      exampleCalculation: `${line.quantity} staff x ${formatNad(line.unitPrice)}`,
      requiresTeethNumbers: false,
      canBeMultiplied: true,
      maxQuantity: MAX_INFECTION_CONTROL_STAFF,
      teethNumbers: undefined,
      isAutoGenerated: true,
      isRequired: true,
      ...(parentServiceId ? { parentServiceId } : {})
    }
  };
}

/** The 8346 amount: MATERIAL_FACTOR_PERCENT of the procedure's unit price, rounded to the cent, x quantity. */
export function priceMaterialFactor(procedureUnitPrice: number, quantity: number, hasMedicalAid: boolean): LineResult {
  const unitPrice =
    Number.isFinite(procedureUnitPrice) && procedureUnitPrice >= 0 ? materialFactorUnitPrice(procedureUnitPrice) : Number.NaN;
  return computeLine({ code: MATERIAL_FACTOR_CODE, unitPrice, quantity, multiplyRule: 'YES', hasMedicalAid });
}

/** The 8346 line for a restorative procedure line: same quantity and teeth; it needs the 8346 tariff. */
export function buildMaterialFactorLine(
  tariffs: readonly VisitTariff[],
  procedure: ServiceSelection,
  hasMedicalAid: boolean
): LineOutcome {
  const tariff = tariffs.find(item => item.code === MATERIAL_FACTOR_CODE);
  if (!tariff) return { ok: false, message: notInTariffListMessage(MATERIAL_FACTOR_CODE) };
  const line = priceMaterialFactor(procedure.unitPrice, procedure.quantity, hasMedicalAid);
  if (!line.ok) return { ok: false, message: refusedMessage(line) };
  const teeth = procedure.teethNumbers ?? [];
  return {
    ok: true,
    warnings: line.warnings,
    service: {
      id: crypto.randomUUID(),
      tariffId: tariff.id,
      code: MATERIAL_FACTOR_CODE,
      description: `Material factor (${MATERIAL_FACTOR_PERCENT}% of ${procedure.code})${teeth.length > 0 ? ` - Tooth ${teeth.join(', ')}` : ''}`,
      category: 'Dental Service',
      subcategory: 'Material Factor',
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      totalPrice: line.total,
      requiresPreAuth: false,
      ...medicalAidFlags(hasMedicalAid),
      businessRule: `${MATERIAL_FACTOR_PERCENT}% material factor of primary service`,
      exampleCalculation: `${formatNad(procedure.unitPrice)} x ${MATERIAL_FACTOR_PERCENT}% = ${formatNad(line.unitPrice)}`,
      requiresTeethNumbers: teeth.length > 0,
      // It follows the procedure's quantity, so it may be multiplied exactly when the procedure may
      canBeMultiplied: procedure.canBeMultiplied,
      teethNumbers: teeth.length > 0 ? [...teeth] : undefined,
      isAutoGenerated: true,
      parentServiceId: procedure.id,
      // The material of a procedure the patient pays all of is the patient's too (never claimed on its own)
      ...(procedure.paidBy ? { paidBy: procedure.paidBy } : {})
    }
  };
}

/** A line's quantity rule: from its tariff when the tariff is loaded, otherwise its stored flag. */
export function serviceMultiplyRule(service: ServiceSelection, tariffs: readonly VisitTariff[]): MultiplyRule {
  // A line with its own limit (8109, per staff member) may be multiplied up to that limit
  if (service.maxQuantity !== undefined) return 'YES';
  const tariff = tariffs.find(item => item.id === service.tariffId);
  if (tariff) return normalizeMultiplyRule(tariff.can_be_multiplied);
  return service.canBeMultiplied ? 'YES' : 'NO';
}

const isMaterialLine = (service: ServiceSelection): boolean => service.code === MATERIAL_FACTOR_CODE && service.isAutoGenerated === true;

const isMaterialLineOf = (service: ServiceSelection, procedureId: string): boolean => isMaterialLine(service) && service.parentServiceId === procedureId;

/** A refused quantity change, shaped like computeLine's refusal (no amounts). */
const refusedQuantity = (message: string): LineResult => ({
  ok: false,
  errors: [message],
  warnings: [],
  needsReview: false,
  unitPrice: 0,
  quantity: 0,
  total: 0,
  medicalAidAmount: 0,
  patientAmount: 0,
  unitCents: 0,
  totalCents: 0,
  medicalAidCents: 0,
  patientCents: 0
});

/**
 * Whether staff may change a line's quantity on the screen, and up to what. A line with its own limit (8109, one per
 * clinical staff member) can be changed up to it; other required or automatic lines keep their quantity.
 */
export function quantityControls(service: ServiceSelection): { editable: boolean; max: number } {
  if (service.maxQuantity !== undefined) return { editable: true, max: service.maxQuantity };
  const editable = service.canBeMultiplied === true && service.isRequired !== true && service.isAutoGenerated !== true;
  return { editable, max: MAX_QUANTITY };
}

/**
 * Sets one line's quantity, priced by computeLine at the line's own unit price; its auto-added 8346
 * line follows. When the change is refused the lines come back unchanged and `line.errors` says why.
 */
export function changeLineQuantity(
  services: readonly ServiceSelection[],
  serviceId: string,
  quantity: number,
  tariffs: readonly VisitTariff[],
  hasMedicalAid: boolean
): { services: ServiceSelection[]; line: LineResult | null } {
  const target = services.find(service => service.id === serviceId);
  if (!target) return { services: [...services], line: null };
  if (target.maxQuantity !== undefined && (!Number.isInteger(quantity) || quantity < 1 || quantity > target.maxQuantity)) {
    return {
      services: [...services],
      line: refusedQuantity(`Code ${target.code} is billed per clinical staff member: a whole number from 1 to ${target.maxQuantity}.`)
    };
  }
  const line = computeLine({
    code: target.code,
    unitPrice: target.unitPrice,
    quantity,
    multiplyRule: serviceMultiplyRule(target, tariffs),
    requiresTooth: target.requiresTeethNumbers ?? false,
    toothNumbers: target.teethNumbers,
    hasMedicalAid,
    businessRule: target.businessRule ?? null
  });
  if (!line.ok) return { services: [...services], line };
  const material = services.some(service => isMaterialLineOf(service, serviceId))
    ? priceMaterialFactor(line.unitPrice, line.quantity, hasMedicalAid)
    : null;
  if (material && !material.ok) return { services: [...services], line: material };
  return {
    services: services.map(service => {
      if (service.id === serviceId) return { ...service, quantity: line.quantity, totalPrice: line.total };
      if (material && isMaterialLineOf(service, serviceId)) {
        return { ...service, unitPrice: material.unitPrice, quantity: material.quantity, totalPrice: material.total };
      }
      return service;
    }),
    line
  };
}

/** A stored invoice line's ICD-10 and changed-fee columns (present once the invoice-line update is applied). */
export interface StoredLineCodes {
  icd10_primary?: unknown;
  icd10_secondary?: unknown;
  fee_override_reason?: unknown;
  fee_override_from?: unknown;
  fee_override_by?: unknown;
  fee_override_at?: unknown;
}

const storedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * A stored line's ICD-10 codes and changed fee as billing-line fields, so saving the visit again keeps them. A line
 * stored without codes gets none here: on the Billing tab it then follows the suggestion like a new line.
 */
export function lineCodesFromRow(row: StoredLineCodes): Pick<ServiceSelection, 'icd10Codes' | 'feeOverride'> {
  const secondary = Array.isArray(row.icd10_secondary) ? row.icd10_secondary.map(storedText) : [];
  const codes = [storedText(row.icd10_primary), ...secondary].filter(Boolean);
  const reason = storedText(row.fee_override_reason);
  const from = Number(row.fee_override_from);
  const fee = reason && Number.isFinite(from) && storedText(row.fee_override_by) && storedText(row.fee_override_at)
    ? { reason, fromUnitPrice: from, by: storedText(row.fee_override_by), at: storedText(row.fee_override_at) }
    : null;
  return { ...(codes.length > 0 ? { icd10Codes: codes } : {}), ...(fee ? { feeOverride: fee } : {}) };
}

/**
 * A stored line's payer and authorisation number as billing-line fields (present once the line-portions update is
 * applied), so saving the visit again keeps a "patient pays all" line out of the claim and keeps its authorisation.
 */
export function linePortionFromRow(row: { paid_by?: unknown; authorisation_number?: unknown }): Pick<ServiceSelection, 'paidBy' | 'authorisationNumber'> {
  const authorisation = storedText(row.authorisation_number);
  return { ...(isPaidBy(row.paid_by) ? { paidBy: row.paid_by } : {}), ...(authorisation ? { authorisationNumber: authorisation } : {}) };
}

/**
 * A stored line's tooth surfaces and quadrant as billing-line fields (present once the line-teeth update is applied),
 * so saving the visit again keeps them on the invoice and the claim.
 */
export function lineTeethFromRow(row: { tooth_surfaces?: unknown; tooth_quadrant?: unknown }): Pick<ServiceSelection, 'toothSurfaces' | 'toothQuadrant'> {
  const surfaces = storedText(row.tooth_surfaces);
  const quadrant = row.tooth_quadrant === null || row.tooth_quadrant === undefined ? null : Number(row.tooth_quadrant);
  return { ...(surfaces ? { toothSurfaces: surfaces } : {}), ...(isQuadrant(quadrant) ? { toothQuadrant: quadrant } : {}) };
}

/**
 * A stored line's own referral, assistant and anaesthetist as billing-line fields (present once the referrals update is
 * applied), so saving the visit again keeps who referred the patient for that line and who assisted.
 */
export function linePeopleFromRow(row: { referral_id?: unknown; assistant_id?: unknown; anaesthetist_id?: unknown }): Pick<ServiceSelection, 'referralId' | 'assistantId' | 'anaesthetistId'> {
  const referral = storedText(row.referral_id);
  const assistant = storedText(row.assistant_id);
  const anaesthetist = storedText(row.anaesthetist_id);
  return { ...(referral ? { referralId: referral } : {}), ...(assistant ? { assistantId: assistant } : {}), ...(anaesthetist ? { anaesthetistId: anaesthetist } : {}) };
}

/**
 * The lines in `lineIds` priced at a practitioner's rate (parity D31), when the practitioner who treats them changes:
 * a line from the practice's price list gets its list price x the rate (the list price atPractitionerRate kept on the
 * tariff, else the tariff's price), at its own quantity rule, and its 8346 material line follows. A line at a fund's
 * own price, a fee changed by hand, a line whose tariff is not in the list, and a line the rules refuse at the new
 * price keep the price they have.
 */
export function priceLinesAtRate(
  services: readonly ServiceSelection[],
  lineIds: ReadonlySet<string>,
  ratePercent: number | null,
  tariffs: readonly VisitTariff[],
  hasMedicalAid: boolean
): ServiceSelection[] {
  let lines = [...services];
  for (const target of services) {
    if (!lineIds.has(target.id) || target.feeOverride || isMaterialLine(target)) continue;
    const tariff = tariffs.find(item => item.id === target.tariffId);
    if (!tariff || !atPracticeListPrice(tariff)) continue;
    const listPrice = tariff.list_price ?? parseTariffPrice(tariff.price);
    if (listPrice === null) continue;
    const unitPrice = priceAtRate(listPrice, ratePercent);
    if (toCents(unitPrice) === toCents(target.unitPrice)) continue;
    const line = computeLine({
      code: target.code,
      unitPrice,
      quantity: target.quantity,
      multiplyRule: serviceMultiplyRule(target, tariffs),
      requiresTooth: target.requiresTeethNumbers ?? false,
      toothNumbers: target.teethNumbers,
      hasMedicalAid,
      businessRule: target.businessRule ?? null
    });
    if (!line.ok) continue;
    const material = lines.some(service => isMaterialLineOf(service, target.id)) ? priceMaterialFactor(line.unitPrice, line.quantity, hasMedicalAid) : null;
    if (material && !material.ok) continue;
    lines = lines.map(service => {
      if (service.id === target.id) return { ...service, unitPrice: line.unitPrice, totalPrice: line.total };
      if (material && isMaterialLineOf(service, target.id)) return { ...service, unitPrice: material.unitPrice, quantity: material.quantity, totalPrice: material.total };
      return service;
    });
  }
  return lines;
}

/** A new fee for one line: the unit price and why; who and when are recorded with it. */
export interface FeeChange {
  unitPrice: number;
  reason: string;
  /** users.id of the person changing it */
  by: string;
  /** ISO time of the change */
  at: string;
}

/**
 * Why `unitPrice` cannot be a line's new fee (null when it can): a price the billing rules accept (computeLine: not
 * negative, at most the highest unit price, cents), a reason, and room for a discount already on the line.
 */
export function feeChangeProblem(
  service: Pick<ServiceSelection, 'code' | 'quantity' | 'discountAmount' | 'isAutoGenerated'>,
  unitPrice: number,
  reason: string
): string | null {
  if (service.isAutoGenerated) return `Code ${service.code} is priced by its rule; change the line it belongs to.`;
  if (!Number.isFinite(unitPrice) || !hasAtMostDecimals(unitPrice, 2)) return 'Enter the fee as an amount such as 400 or 400.00.';
  const priced = computeLine({ code: service.code, unitPrice, quantity: service.quantity, multiplyRule: 'YES', hasMedicalAid: false });
  if (!priced.ok) return priced.errors.join(' ');
  if (!reason.trim()) return 'Say why the fee is changed (for example "Pensioner rate").';
  if (reason.trim().length > MAX_FEE_REASON_LENGTH) return `Keep the reason to ${MAX_FEE_REASON_LENGTH} characters.`;
  if (toCents(service.discountAmount ?? 0) > priced.totalCents) return `The line's discount is more than ${formatNad(priced.total)}; lower the discount first.`;
  return null;
}

/**
 * Changes one line's fee (its unit price) with a reason, priced by computeLine at the line's quantity; its auto-added
 * 8346 line follows, as it does a quantity change. The price before the first change (the tariff or the fund's price)
 * is kept, so the invoice shows what was changed and `change` null puts the line back on it. A fee equal to that price
 * is no change. A refused change leaves the lines as they were and says why.
 */
export function changeLineFee(
  services: readonly ServiceSelection[],
  serviceId: string,
  change: FeeChange | null,
  tariffs: readonly VisitTariff[],
  hasMedicalAid: boolean
): { services: ServiceSelection[]; error: string | null } {
  const target = services.find(service => service.id === serviceId);
  if (!target || (change === null && !target.feeOverride)) return { services: [...services], error: null };
  const before = target.feeOverride?.fromUnitPrice ?? target.unitPrice;
  const unitPrice = change ? change.unitPrice : before;
  if (change) {
    const problem = feeChangeProblem(target, unitPrice, change.reason);
    if (problem) return { services: [...services], error: problem };
  }
  const line = computeLine({
    code: target.code,
    unitPrice,
    quantity: target.quantity,
    multiplyRule: serviceMultiplyRule(target, tariffs),
    requiresTooth: target.requiresTeethNumbers ?? false,
    toothNumbers: target.teethNumbers,
    hasMedicalAid,
    businessRule: target.businessRule ?? null
  });
  if (!line.ok) return { services: [...services], error: line.errors.join(' ') };
  const material = services.some(service => isMaterialLineOf(service, serviceId))
    ? priceMaterialFactor(line.unitPrice, line.quantity, hasMedicalAid)
    : null;
  if (material && !material.ok) return { services: [...services], error: material.errors.join(' ') };
  const feeOverride =
    change && toCents(change.unitPrice) !== toCents(before)
      ? { reason: change.reason.trim(), fromUnitPrice: before, by: change.by, at: change.at }
      : undefined;
  return {
    error: null,
    services: services.map(service => {
      if (service.id === serviceId) return { ...service, unitPrice: line.unitPrice, totalPrice: line.total, feeOverride };
      if (material && isMaterialLineOf(service, serviceId)) {
        return { ...service, unitPrice: material.unitPrice, quantity: material.quantity, totalPrice: material.total };
      }
      return service;
    })
  };
}

/**
 * The invoice_services row for a line, exactly as invoiceService writes it when it creates an invoice
 * (buildInvoiceLineRow): the amounts from computeLine split between the fund and the patient (co-payment), the
 * tooth numbers the claim needs and, once the database has the columns, the line's date, treating practitioner and
 * discount. Check lines with findInvoiceLineProblems first; a line that cannot be priced throws rather than being
 * saved as N$ 0.00.
 */
export function toInvoiceServiceRow(
  service: ServiceSelection,
  invoiceId: string,
  hasMedicalAid: boolean,
  options: Omit<InvoiceLineContext, 'invoiceId' | 'hasMedicalAid'> = {}
): InvoiceServiceInsert {
  // system_transaction_number is left out: an insert trigger numbers the lines in sequence
  // (ADD_SYSTEM_TRANSACTION_NUMBER.sql). The generated types don't know about that trigger or the new columns.
  return buildInvoiceLineRow(service, { ...options, invoiceId, hasMedicalAid }) as unknown as InvoiceServiceInsert;
}

/**
 * All of a visit's invoice_services rows, as invoiceService writes them (buildInvoiceLineRows): each line as
 * toInvoiceServiceRow builds it, and the fund's levy (options.levy) charged once for the invoice, never per line.
 */
export function toInvoiceServiceRows(
  services: readonly ServiceSelection[],
  invoiceId: string,
  hasMedicalAid: boolean,
  options: Omit<InvoiceLineContext, 'invoiceId' | 'hasMedicalAid'> = {}
): InvoiceServiceInsert[] {
  return buildInvoiceLineRows(services, { ...options, invoiceId, hasMedicalAid }) as unknown as InvoiceServiceInsert[];
}
