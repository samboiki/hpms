/**
 * Quotes (treatment estimates): statuses, validity, totals, the medical aid estimate and the re-pricing
 * done when a quote becomes an invoice. Pure functions; quoteService.ts does the database work.
 *
 * Money rules (practice owner: "people must not get wrong prices"):
 * - Quote lines are built by the visit screens' line builder (billingLines.ts), so a quote's total is the
 *   total of the invoice it becomes, to the cent, when the tariffs have not changed.
 * - The estimate splits each line between the medical aid and the patient only where the practice knows
 *   the fund's rate for the code: the fund's own price from its tariff schedule (fund_tariffs, through
 *   fundPricing.ts). Without a known rate the whole line is shown as the patient's portion, and the quote
 *   says so: an estimate must never promise cover.
 * - When a quote is converted, every line is priced again from the tariffs in effect on the visit date.
 *   Any difference is shown before the invoice is created.
 */
import type { ServiceSelection } from '../../types/billing';
import { addDaysToKey, isValidDateKey } from '../../utils/billing/dates';
import { formatNad, fromCents, multiplyCents, percentOfCents, sumCents, toCents } from '../../utils/billing/money';
import { normalizeMultiplyRule } from '../../utils/billing/pricing';
import {
  INFECTION_CONTROL_CODE,
  MATERIAL_FACTOR_CODE,
  MAX_INFECTION_CONTROL_STAFF,
  isRestorationCode
} from '../../utils/billing/tariffRules';
import {
  buildInfectionControlLine,
  buildMaterialFactorLine,
  buildTariffLine,
  type VisitTariff
} from '../visits/visitBillingLines';
import { findTariff, normalizeCode, tariffNeedsTooth } from './billingLines';

// ---------------------------------------------------------------------------------------------------
// Statuses
// ---------------------------------------------------------------------------------------------------

export const QUOTE_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'expired', 'converted'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const isQuoteStatus = (value: unknown): value is QuoteStatus =>
  typeof value === 'string' && (QUOTE_STATUSES as readonly string[]).includes(value);

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
  converted: 'Invoiced'
};

/**
 * Status changes the database allows (the quotes_guard trigger has the same table). A converted quote is
 * final; a declined or expired one can be reopened as a draft; sent goes back to draft when it is edited.
 */
export const QUOTE_TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['sent', 'accepted', 'declined', 'expired'],
  sent: ['draft', 'sent', 'accepted', 'declined', 'expired'],
  accepted: ['converted', 'declined'],
  declined: ['draft'],
  expired: ['draft'],
  converted: []
};

export const canChangeStatus = (from: QuoteStatus, to: QuoteStatus): boolean => QUOTE_TRANSITIONS[from].includes(to);

/**
 * The status to show: a draft or sent quote past its "valid until" date is expired, even before anyone
 * marks it. Accepted quotes do not expire (the patient said yes in time); converted is final.
 */
export function effectiveQuoteStatus(status: QuoteStatus, validUntil: string | null, today: string): QuoteStatus {
  if ((status === 'draft' || status === 'sent') && isValidDateKey(validUntil) && isValidDateKey(today) && validUntil < today) {
    return 'expired';
  }
  return status;
}

/** Lines and dates can be changed only while the patient has not answered. */
export const isQuoteEditable = (status: QuoteStatus): boolean => status === 'draft' || status === 'sent';

export type QuoteAction = 'edit' | 'mark_sent' | 'accept' | 'decline' | 'convert' | 'reopen' | 'delete';

/**
 * What staff may do with a quote. An expired quote cannot be accepted or sent until its validity is
 * extended (its prices may be out of date); only drafts can be deleted, sent quotes are records.
 */
export function quoteActions(stored: QuoteStatus, effective: QuoteStatus): QuoteAction[] {
  if (stored === 'converted') return [];
  if (stored === 'accepted') return ['convert', 'decline'];
  if (stored === 'declined' || stored === 'expired') return ['reopen'];
  if (effective === 'expired') return stored === 'draft' ? ['edit', 'decline', 'delete'] : ['edit', 'decline'];
  if (stored === 'draft') return ['edit', 'mark_sent', 'accept', 'decline', 'delete'];
  return ['edit', 'accept', 'decline'];
}

/** Can the quote be sent to the patient now (SMS, email)? */
export const canSendQuote = (stored: QuoteStatus, effective: QuoteStatus): boolean =>
  effective !== 'expired' && stored !== 'declined' && stored !== 'converted';

// ---------------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------------

export const DEFAULT_VALIDITY_DAYS = 90;
export const VALIDITY_PRESETS: readonly number[] = [30, 90, 180];

export const defaultValidUntil = (quoteDate: string): string => addDaysToKey(quoteDate, DEFAULT_VALIDITY_DAYS);

/** 'dd/MM/yyyy' for a yyyy-MM-dd key (dates are written day first in Namibia); '-' when missing. */
export function formatDayFirst(key: string | null | undefined): string {
  if (!isValidDateKey(key)) return '-';
  const [year, month, day] = key.split('-');
  return `${day}/${month}/${year}`;
}

export const MAX_PREAUTH_LENGTH = 40;
export const MAX_FUND_REFERENCE_LENGTH = 60;
export const MAX_QUOTE_NOTES = 1000;

export interface QuoteHeaderInput {
  quoteDate: string;
  validUntil: string;
  preauthNumber: string;
  fundReference: string;
  notes: string;
}

/** Problems that stop a quote from being saved (the lines are checked by the line builder). */
export function validateQuoteHeader(header: QuoteHeaderInput, lineCount: number): string[] {
  const errors: string[] = [];
  if (!isValidDateKey(header.quoteDate)) errors.push('Enter the quote date.');
  if (!isValidDateKey(header.validUntil)) errors.push('Enter the date the quote is valid until.');
  else if (isValidDateKey(header.quoteDate) && header.validUntil < header.quoteDate) {
    errors.push('"Valid until" cannot be before the quote date.');
  }
  if (header.preauthNumber.trim().length > MAX_PREAUTH_LENGTH) {
    errors.push(`The pre-authorisation number can have at most ${MAX_PREAUTH_LENGTH} characters.`);
  }
  if (header.fundReference.trim().length > MAX_FUND_REFERENCE_LENGTH) {
    errors.push(`The fund reference can have at most ${MAX_FUND_REFERENCE_LENGTH} characters.`);
  }
  if (header.notes.trim().length > MAX_QUOTE_NOTES) errors.push(`The notes can have at most ${MAX_QUOTE_NOTES} characters.`);
  if (lineCount === 0) errors.push('Add at least one code.');
  return errors;
}

/** Tariffs usually change on 1 January, so a quote valid into the next year may not hold its prices. */
export function validityNote(quoteDate: string, validUntil: string): string | null {
  if (!isValidDateKey(quoteDate) || !isValidDateKey(validUntil)) return null;
  if (validUntil.slice(0, 4) > quoteDate.slice(0, 4)) {
    return 'Tariffs usually change on 1 January. If the treatment is next year, the invoice uses the tariffs in effect then.';
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------
// Medical aid estimate
// ---------------------------------------------------------------------------------------------------

/** What a fund pays for a code, when the practice knows it (the fund's own price on its tariff schedule). */
export interface FundRate {
  code: string;
  /** N$ the fund pays per unit */
  coveredAmount: number | null;
  /** Share of the line the patient pays, 0-100 */
  patientCopayPercent: number | null;
}

const readNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * The fund's rates by code, from the tariff list priced for the patient (priceForPatient): a code priced from the
 * fund's own schedule or the practice's contract with the fund is what the fund pays per unit. A code billed at the
 * practice tariff has no known rate, so its line stays on the patient. The 8346 material line is 10% of its
 * restoration's fund price, so the fund pays it in full wherever it pays the restorations.
 */
export function fundRatesFromTariffs(tariffs: readonly VisitTariff[]): Map<string, FundRate> {
  const rates = new Map<string, FundRate>();
  tariffs.forEach(tariff => {
    if (!tariff.price_source || tariff.price_source.kind === 'practice_tariff' || tariff.price_problem) return;
    const coveredAmount = readNumber(tariff.price as number | string | null);
    if (coveredAmount === null || coveredAmount < 0) return;
    rates.set(normalizeCode(tariff.code), { code: normalizeCode(tariff.code), coveredAmount, patientCopayPercent: null });
  });
  if ([...rates.keys()].some(isRestorationCode)) {
    rates.set(MATERIAL_FACTOR_CODE, { code: MATERIAL_FACTOR_CODE, coveredAmount: null, patientCopayPercent: 0 });
  }
  return rates;
}

export type LineEstimateBasis = 'private' | 'fund_rate' | 'no_rate';
export type QuoteEstimateBasis = 'private' | 'all_rates' | 'some_rates' | 'no_rates';

export const isQuoteEstimateBasis = (value: unknown): value is QuoteEstimateBasis =>
  value === 'private' || value === 'all_rates' || value === 'some_rates' || value === 'no_rates';

export interface EstimateContext {
  /** The patient has a medical aid record (as invoiceService decides) */
  hasMedicalAid: boolean;
  fundName: string | null;
  rates: ReadonlyMap<string, FundRate>;
}

export interface LineEstimate {
  fundCents: number;
  patientCents: number;
  basis: LineEstimateBasis;
}

export interface QuoteEstimate {
  lines: LineEstimate[];
  totalCents: number;
  fundCents: number;
  patientCents: number;
  basis: QuoteEstimateBasis;
  /** Codes without a known fund rate (their full amount is in the patient's portion) */
  unknownCodes: string[];
  /** Plain-language explanation printed on the quote */
  note: string;
}

const lineTotalCents = (line: Pick<ServiceSelection, 'totalPrice'>): number =>
  Number.isFinite(line.totalPrice) && line.totalPrice >= 0 ? toCents(line.totalPrice) : 0;

function estimateLine(line: Pick<ServiceSelection, 'code' | 'quantity' | 'totalPrice'>, context: EstimateContext): LineEstimate {
  const totalCents = lineTotalCents(line);
  if (!context.hasMedicalAid) return { fundCents: 0, patientCents: totalCents, basis: 'private' };
  const rate = context.rates.get(normalizeCode(line.code));
  const copay = rate?.patientCopayPercent ?? null;
  let fundCents: number;
  if (rate && rate.coveredAmount !== null && Number.isFinite(rate.coveredAmount) && rate.coveredAmount >= 0) {
    // The fund pays its rate per unit, never more than the line
    fundCents = Math.min(multiplyCents(toCents(rate.coveredAmount), line.quantity), totalCents);
  } else if (copay !== null && Number.isFinite(copay) && copay >= 0 && copay <= 100) {
    fundCents = totalCents - percentOfCents(totalCents, copay);
  } else {
    return { fundCents: 0, patientCents: totalCents, basis: 'no_rate' };
  }
  return { fundCents, patientCents: totalCents - fundCents, basis: 'fund_rate' };
}

/** Splits each line between the medical aid and the patient, in whole cents, and explains the basis. */
export function estimateQuote(
  lines: readonly Pick<ServiceSelection, 'code' | 'quantity' | 'totalPrice'>[],
  context: EstimateContext
): QuoteEstimate {
  const estimates = lines.map(line => estimateLine(line, context));
  const totalCents = sumCents(lines.map(lineTotalCents));
  const fundCents = sumCents(estimates.map(estimate => estimate.fundCents));
  const unknownCodes = [
    ...new Set(lines.filter((_, index) => estimates[index].basis === 'no_rate').map(line => normalizeCode(line.code)))
  ];
  const fund = context.fundName?.trim() || 'the medical aid';
  let basis: QuoteEstimateBasis;
  let note: string;
  if (!context.hasMedicalAid) {
    basis = 'private';
    note = 'No medical aid is on file for this patient, so the patient pays the full amount.';
  } else if (lines.length > 0 && unknownCodes.length === 0) {
    basis = 'all_rates';
    note = `Estimate based on the ${fund} rates the practice has on file. The fund decides what it pays; the patient pays any shortfall.`;
  } else if (unknownCodes.length < new Set(lines.map(line => normalizeCode(line.code))).size) {
    basis = 'some_rates';
    note = `The practice has no ${fund} rate for ${unknownCodes.join(', ')}, so the full amount of those lines is shown as the patient's portion. Ask the fund for pre-authorisation to confirm what it pays.`;
  } else {
    basis = 'no_rates';
    note = `The practice has no ${fund} rates on file for these codes, so the full amount is shown as the patient's portion. Ask the fund for pre-authorisation to confirm what it pays.`;
  }
  return { lines: estimates, totalCents, fundCents, patientCents: totalCents - fundCents, basis, unknownCodes, note };
}

// ---------------------------------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------------------------------

export interface QuoteLineRecord {
  id: string;
  lineNo: number;
  tariffId: string | null;
  code: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  toothNumbers: string[];
  notes: string | null;
  isAutoGenerated: boolean;
  parentLineId: string | null;
  medicalAidEstimate: number;
  patientEstimate: number;
  estimateBasis: LineEstimateBasis;
}

export interface QuoteRecord {
  id: string;
  practiceId: string;
  patientId: string;
  patientName: string | null;
  quoteNumber: string;
  status: QuoteStatus;
  quoteDate: string;
  validUntil: string;
  practitionerId: string | null;
  visitId: string | null;
  medicalAidName: string | null;
  medicalAidScheme: string | null;
  membershipNumber: string | null;
  estimateBasis: QuoteEstimateBasis;
  estimateNote: string | null;
  preauthNumber: string | null;
  fundReference: string | null;
  notes: string | null;
  subtotal: number;
  medicalAidEstimate: number;
  patientEstimate: number;
  sentAt: string | null;
  sentVia: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  convertedInvoiceId: string | null;
  convertedVisitId: string | null;
  convertedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface QuoteRow {
  id: string;
  practice_id: string;
  patient_id: string;
  quote_number: string | null;
  status: string | null;
  quote_date: string | null;
  valid_until: string | null;
  practitioner_id?: string | null;
  visit_id?: string | null;
  medical_aid_name?: string | null;
  medical_aid_scheme?: string | null;
  membership_number?: string | null;
  estimate_basis?: string | null;
  estimate_note?: string | null;
  preauth_number?: string | null;
  fund_reference?: string | null;
  notes?: string | null;
  subtotal?: number | string | null;
  medical_aid_estimate?: number | string | null;
  patient_estimate?: number | string | null;
  sent_at?: string | null;
  sent_via?: string | null;
  accepted_at?: string | null;
  declined_at?: string | null;
  converted_invoice_id?: string | null;
  converted_visit_id?: string | null;
  converted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface QuoteLineRow {
  id: string;
  line_no: number;
  tariff_id: string | null;
  code: string;
  description: string | null;
  quantity: number | string;
  unit_price: number | string;
  total_price: number | string;
  tooth_numbers: string | null;
  notes: string | null;
  is_auto_generated: boolean | null;
  parent_line_id: string | null;
  medical_aid_estimate: number | string | null;
  patient_estimate: number | string | null;
  estimate_basis: string | null;
}

const amount = (value: number | string | null | undefined): number => readNumber(value) ?? 0;
const text = (value: string | null | undefined): string | null => value?.trim() || null;

export function toQuoteRecord(row: QuoteRow, patientName: string | null = null): QuoteRecord {
  return {
    id: row.id,
    practiceId: row.practice_id,
    patientId: row.patient_id,
    patientName,
    quoteNumber: row.quote_number?.trim() || '-',
    status: isQuoteStatus(row.status) ? row.status : 'draft',
    quoteDate: row.quote_date ?? '',
    validUntil: row.valid_until ?? '',
    practitionerId: row.practitioner_id ?? null,
    visitId: row.visit_id ?? null,
    medicalAidName: text(row.medical_aid_name),
    medicalAidScheme: text(row.medical_aid_scheme),
    membershipNumber: text(row.membership_number),
    estimateBasis: isQuoteEstimateBasis(row.estimate_basis) ? row.estimate_basis : 'no_rates',
    estimateNote: text(row.estimate_note),
    preauthNumber: text(row.preauth_number),
    fundReference: text(row.fund_reference),
    notes: text(row.notes),
    subtotal: amount(row.subtotal),
    medicalAidEstimate: amount(row.medical_aid_estimate),
    patientEstimate: amount(row.patient_estimate),
    sentAt: row.sent_at ?? null,
    sentVia: row.sent_via ?? null,
    acceptedAt: row.accepted_at ?? null,
    declinedAt: row.declined_at ?? null,
    convertedInvoiceId: row.converted_invoice_id ?? null,
    convertedVisitId: row.converted_visit_id ?? null,
    convertedAt: row.converted_at ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null
  };
}

const splitTeeth = (value: string | null): string[] =>
  (value ?? '').split(',').map(tooth => tooth.trim()).filter(Boolean);

export function toQuoteLineRecord(row: QuoteLineRow): QuoteLineRecord {
  const basis = row.estimate_basis;
  return {
    id: row.id,
    lineNo: row.line_no,
    tariffId: row.tariff_id,
    code: normalizeCode(row.code),
    description: row.description?.trim() || normalizeCode(row.code),
    quantity: amount(row.quantity),
    unitPrice: amount(row.unit_price),
    totalPrice: amount(row.total_price),
    toothNumbers: splitTeeth(row.tooth_numbers),
    notes: text(row.notes),
    isAutoGenerated: row.is_auto_generated === true,
    parentLineId: row.parent_line_id,
    medicalAidEstimate: amount(row.medical_aid_estimate),
    patientEstimate: amount(row.patient_estimate),
    estimateBasis: basis === 'private' || basis === 'fund_rate' || basis === 'no_rate' ? basis : 'no_rate'
  };
}

/** The lines to save for a quote: billing lines in screen order, each with its estimate. */
export function servicesToQuoteLines(services: readonly ServiceSelection[], estimate: QuoteEstimate): QuoteLineRecord[] {
  // A link to a line that is not in this quote is dropped (the database only accepts links within the quote)
  const ids = new Set(services.map(service => service.id));
  return services.map((service, index) => {
    const line = estimate.lines[index] ?? { fundCents: 0, patientCents: lineTotalCents(service), basis: 'no_rate' as const };
    return {
      id: service.id,
      lineNo: index + 1,
      tariffId: service.tariffId || null,
      code: normalizeCode(service.code),
      description: service.description,
      quantity: service.quantity,
      unitPrice: service.unitPrice,
      totalPrice: service.totalPrice,
      toothNumbers: (service.teethNumbers ?? []).map(tooth => tooth.trim()).filter(Boolean),
      notes: service.notes?.trim() || null,
      isAutoGenerated: service.isAutoGenerated === true,
      parentLineId: service.parentServiceId && ids.has(service.parentServiceId) ? service.parentServiceId : null,
      medicalAidEstimate: fromCents(line.fundCents),
      patientEstimate: fromCents(line.patientCents),
      estimateBasis: line.basis
    };
  });
}

/** A saved quote's lines as billing lines for the editor, at the prices that were quoted. */
export function quoteLinesToServices(
  lines: readonly QuoteLineRecord[],
  tariffs: readonly VisitTariff[],
  hasMedicalAid: boolean
): ServiceSelection[] {
  return [...lines]
    .sort((a, b) => a.lineNo - b.lineNo)
    .map(line => {
      const tariff = (line.tariffId ? tariffs.find(item => item.id === line.tariffId) : undefined) ?? findTariff(tariffs, line.code);
      const isInfectionControl = line.code === INFECTION_CONTROL_CODE && line.isAutoGenerated;
      return {
        id: line.id,
        tariffId: line.tariffId ?? '',
        code: line.code,
        description: line.description,
        category: 'Dental Service',
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        totalPrice: line.totalPrice,
        notes: line.notes ?? undefined,
        medicalAidCovered: hasMedicalAid,
        coveragePercentage: hasMedicalAid ? 100 : 0,
        requiresTeethNumbers: line.toothNumbers.length > 0 || (tariff ? tariffNeedsTooth(tariff) : false),
        // The 8109 line is one per clinical staff member (1-3), whatever its tariff row's quantity flag says
        canBeMultiplied: isInfectionControl || (tariff ? normalizeMultiplyRule(tariff.can_be_multiplied) !== 'NO' : line.quantity !== 1),
        teethNumbers: line.toothNumbers.length > 0 ? [...line.toothNumbers] : undefined,
        isAutoGenerated: line.isAutoGenerated || undefined,
        parentServiceId: line.parentLineId ?? undefined,
        isRequired: isInfectionControl || undefined,
        ...(isInfectionControl ? { maxQuantity: MAX_INFECTION_CONTROL_STAFF } : {})
      };
    });
}

// ---------------------------------------------------------------------------------------------------
// Re-pricing (conversion to an invoice, "use current prices")
// ---------------------------------------------------------------------------------------------------

export interface PriceChange {
  lineId: string;
  code: string;
  description: string;
  quantity: number;
  oldUnitPrice: number;
  newUnitPrice: number;
  oldTotal: number;
  newTotal: number;
  differenceCents: number;
}

export interface RepriceResult {
  /** The lines priced from the tariffs given, ready for invoiceService (empty lines are left out) */
  services: ServiceSelection[];
  changes: PriceChange[];
  /** Lines that cannot be priced: the invoice must not be created until they are fixed */
  problems: string[];
  oldTotalCents: number;
  newTotalCents: number;
  differenceCents: number;
}

/**
 * Prices a quote's lines again with the visit screens' line builder and the tariffs in effect on the
 * service date: 8109 from its tariff, 8346 from its procedure's new price, every other line from its own
 * tariff at the quoted quantity and tooth. A line whose code is no longer billable is a problem, not a
 * line at the old price.
 */
export function repriceQuoteLines(
  lines: readonly QuoteLineRecord[],
  context: { tariffs: readonly VisitTariff[]; hasMedicalAid: boolean }
): RepriceResult {
  const ordered = [...lines].sort((a, b) => a.lineNo - b.lineNo);
  const priced = new Map<string, ServiceSelection>();
  const problems: string[] = [];
  // 8346 is always priced from its procedure (never from its own tariff row)
  const isMaterial = (line: QuoteLineRecord): boolean => line.code === MATERIAL_FACTOR_CODE;

  for (const line of ordered.filter(item => !isMaterial(item))) {
    if (line.code === INFECTION_CONTROL_CODE && line.isAutoGenerated) {
      // The quoted staff count is kept: the patient was quoted that many
      const outcome = buildInfectionControlLine(context.tariffs, context.hasMedicalAid, line.parentLineId ?? undefined, line.quantity);
      if (outcome.ok) priced.set(line.id, { ...outcome.service, id: line.id });
      else problems.push(outcome.message);
      continue;
    }
    const tariff = findTariff(context.tariffs, line.code);
    if (!tariff) {
      problems.push(`Code ${line.code} (${line.description}) has no tariff in effect on this date. Remove it from the quote or ask an administrator to check the tariff list.`);
      continue;
    }
    if (line.toothNumbers.length > 1) {
      problems.push(`Code ${line.code} lists several teeth on one line. Put each tooth on its own line in the quote.`);
      continue;
    }
    const outcome = buildTariffLine(tariff, line.quantity, line.toothNumbers[0] ?? '', context.hasMedicalAid);
    if (!outcome.ok) {
      problems.push(outcome.message);
      continue;
    }
    priced.set(line.id, {
      ...outcome.service,
      id: line.id,
      notes: line.notes ?? undefined,
      parentServiceId: line.parentLineId ?? undefined
    });
  }

  for (const line of ordered.filter(isMaterial)) {
    const procedure = line.parentLineId ? priced.get(line.parentLineId) : undefined;
    if (!procedure) {
      problems.push(`The ${MATERIAL_FACTOR_CODE} material line has no procedure to follow. Remove the procedure and add it again.`);
      continue;
    }
    const outcome = buildMaterialFactorLine(context.tariffs, procedure, context.hasMedicalAid);
    if (outcome.ok) priced.set(line.id, { ...outcome.service, id: line.id });
    else problems.push(outcome.message);
  }

  const services = ordered.flatMap(line => {
    const service = priced.get(line.id);
    return service ? [service] : [];
  });
  const changes = ordered.flatMap(line => {
    const service = priced.get(line.id);
    if (!service) return [];
    const differenceCents = toCents(service.totalPrice) - toCents(line.totalPrice);
    if (toCents(service.unitPrice) === toCents(line.unitPrice) && differenceCents === 0) return [];
    return [
      {
        lineId: line.id,
        code: line.code,
        description: line.description,
        quantity: line.quantity,
        oldUnitPrice: line.unitPrice,
        newUnitPrice: service.unitPrice,
        oldTotal: line.totalPrice,
        newTotal: service.totalPrice,
        differenceCents
      }
    ];
  });
  const oldTotalCents = sumCents(ordered.map(line => toCents(line.totalPrice)));
  const newTotalCents = sumCents(services.map(service => toCents(service.totalPrice)));
  return { services, changes, problems, oldTotalCents, newTotalCents, differenceCents: newTotalCents - oldTotalCents };
}

// ---------------------------------------------------------------------------------------------------
// Messages to the patient (sent through communicationService only)
// ---------------------------------------------------------------------------------------------------

const clip = (value: string, max: number): string => (value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}.`);

/** Plain ASCII so the SMS stays in the cheaper GSM alphabet. */
const asciiOnly = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');

export interface QuoteSmsInput {
  practiceName: string;
  practicePhone: string | null;
  patientFirstName: string | null;
  quoteNumber: string;
  totalCents: number;
  patientCents: number;
  basis: QuoteEstimateBasis;
  validUntil: string;
}

/** The SMS staff can edit before it is sent: total, the patient's share where known, validity. */
export function quoteSmsText(input: QuoteSmsInput): string {
  const name = clip(asciiOnly(input.patientFirstName?.trim() ?? ''), 20);
  const practice = clip(asciiOnly(input.practiceName.trim()) || 'Your practice', 40);
  const total = formatNad(fromCents(input.totalCents));
  let share = '';
  if (input.basis === 'all_rates') share = ` (your estimated share after medical aid: ${formatNad(fromCents(input.patientCents))})`;
  else if (input.basis === 'some_rates' || input.basis === 'no_rates') share = ' (what your medical aid pays is not confirmed yet)';
  const phone = asciiOnly(input.practicePhone?.trim() ?? '');
  return [
    `${name ? `Hi ${name}, ` : ''}${practice}: your treatment estimate ${input.quoteNumber} is ${total}${share}.`,
    `Valid until ${formatDayFirst(input.validUntil)}.`,
    phone ? `Questions? Call ${clip(phone, 20)}.` : ''
  ]
    .filter(Boolean)
    .join(' ');
}

export const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export interface QuoteEmailInput {
  practiceName: string;
  practicePhone: string | null;
  practiceEmail: string | null;
  patientName: string;
  quote: Pick<QuoteRecord, 'quoteNumber' | 'quoteDate' | 'validUntil' | 'subtotal' | 'medicalAidEstimate' | 'patientEstimate' | 'estimateNote' | 'preauthNumber'>;
  lines: readonly Pick<QuoteLineRecord, 'code' | 'description' | 'quantity' | 'totalPrice'>[];
}

/** Email subject, HTML and text. The PDF of the quote is attached by the caller. */
export function quoteEmailContent(input: QuoteEmailInput): { subject: string; html: string; text: string } {
  const { quote } = input;
  const subject = `Treatment estimate ${quote.quoteNumber} from ${input.practiceName}`;
  const rows = input.lines
    .map(
      line =>
        `<tr><td style="padding:4px 8px">${escapeHtml(line.code)}</td><td style="padding:4px 8px">${escapeHtml(line.description)}</td>` +
        `<td style="padding:4px 8px;text-align:right">${line.quantity}</td><td style="padding:4px 8px;text-align:right">${escapeHtml(formatNad(line.totalPrice))}</td></tr>`
    )
    .join('');
  const contact = [input.practicePhone, input.practiceEmail].filter((value): value is string => Boolean(value?.trim()));
  const html = `
    <p>Dear ${escapeHtml(input.patientName)},</p>
    <p>Please find attached your treatment estimate <strong>${escapeHtml(quote.quoteNumber)}</strong> from ${escapeHtml(input.practiceName)},
    dated ${formatDayFirst(quote.quoteDate)} and valid until ${formatDayFirst(quote.validUntil)}.</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px">
      <tr style="background:#f3f4f6"><th style="padding:4px 8px;text-align:left">Code</th><th style="padding:4px 8px;text-align:left">Description</th><th style="padding:4px 8px;text-align:right">Qty</th><th style="padding:4px 8px;text-align:right">Amount</th></tr>
      ${rows}
    </table>
    <p><strong>Total: ${escapeHtml(formatNad(quote.subtotal))}</strong><br/>
    Medical aid (estimated): ${escapeHtml(formatNad(quote.medicalAidEstimate))}<br/>
    Your portion (estimated): ${escapeHtml(formatNad(quote.patientEstimate))}</p>
    ${quote.estimateNote ? `<p style="color:#4b5563">${escapeHtml(quote.estimateNote)}</p>` : ''}
    ${quote.preauthNumber ? `<p>Pre-authorisation number: ${escapeHtml(quote.preauthNumber)}</p>` : ''}
    <p>This is an estimate, not an invoice. ${contact.length ? `Questions? Contact us on ${escapeHtml(contact.join(' or '))}.` : ''}</p>
    <p>Kind regards,<br/>${escapeHtml(input.practiceName)}</p>`;
  const body = [
    `Your treatment estimate ${quote.quoteNumber} from ${input.practiceName} (dated ${formatDayFirst(quote.quoteDate)}, valid until ${formatDayFirst(quote.validUntil)}) is attached.`,
    ...input.lines.map(line => `${line.code} ${line.description} x${line.quantity}: ${formatNad(line.totalPrice)}`),
    `Total: ${formatNad(quote.subtotal)}`,
    `Medical aid (estimated): ${formatNad(quote.medicalAidEstimate)}`,
    `Your portion (estimated): ${formatNad(quote.patientEstimate)}`,
    quote.estimateNote ?? '',
    quote.preauthNumber ? `Pre-authorisation number: ${quote.preauthNumber}` : '',
    'This is an estimate, not an invoice.',
    contact.length ? `Questions? Contact us on ${contact.join(' or ')}.` : ''
  ].filter(line => line !== '');
  return { subject, html, text: [`Dear ${input.patientName},`, '', ...body, '', input.practiceName].join('\n') };
}
