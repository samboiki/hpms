/**
 * The invoice_services row for one billing line: the one place a line's stored amounts are worked out, used when an
 * invoice is created (invoiceService) and when its lines are saved again (the visit screens).
 *
 * - The line total is unit price x quantity (computeLine, whole cents); a private patient's discount comes off it.
 * - The total is split between the fund and the patient (lineSplit.ts): medical_aid_covered + patient_portion = total.
 * - Each line carries its own service date and treating practitioner when they differ from the visit's (NULL: the
 *   visit date and the invoice's treating practitioner) and its discount, but only once the database has those
 *   columns (proposals/2026-10-07-invoicing.sql). Before that the row is exactly what it always was.
 * - Its ICD-10 codes (main code first, at most 5: what the claim carries) and a changed fee (why, the price before,
 *   who and when) once the database has those columns (proposals/2026-10-08-invoice-line-codes.sql); the claim line
 *   takes the codes from here and sends the charged fee. The narrative printed under the line is `notes`.
 * - Who pays the line when it is paid by one side only (paid_by: 'patient' lines are never claimed) and the fund's
 *   authorisation number the claim line carries, once the database has those columns
 *   (proposals/2026-10-09-line-portions.sql). Before that such a line is refused rather than claimed by mistake.
 * - The surfaces of a line's one tooth and the quadrant of a code billed per quadrant (dental), once the database has
 *   those columns (proposals/2026-10-12-line-teeth-and-billing-practitioners.sql); before that they are refused
 *   rather than lost. Surfaces are kept in the chart's order and only for a line of one tooth (lineTeeth.ts).
 * - The line's own referral (else the visit's goes on the claim), its assistant and its anaesthetist (parity D7), once
 *   the database has those columns (proposals/2026-10-12-referrals-and-authorisations.sql); before that they are refused.
 * - The promotion its discount came from and the prepaid package it was paid from, once the database has those columns
 *   (proposals/2026-10-13-billing-extras.sql); before that they are refused.
 * - A fund's levy is charged once per invoice, so only buildInvoiceLineRows (all the invoice's lines) takes it off the
 *   fund's share; buildInvoiceLineRow (one line) never charges it.
 * A line that cannot be priced throws with the reason, so it is never saved as N$ 0.00.
 */
import { computeLine } from './pricing.ts';
import { fromCents, toCents } from './money.ts';
import { isValidDateKey } from './dates.ts';
import { applyLevy, applyLineDiscount, parseAuthorisationNumber, splitLineCents, type PaidBy } from './lineSplit.ts';
import { icd10CodesOf, validateIcd10Selection } from './icd10.ts';
import { isQuadrant, lineSurfaces } from '../dental/lineTeeth.ts';

/** A fee changed from the price list: why, the unit price before, who changed it (users.id) and when (ISO time). */
export interface LineFeeOverride {
  reason: string;
  fromUnitPrice: number;
  by: string;
  at: string;
}

/** The longest reason kept for a changed fee (the database refuses longer). */
export const MAX_FEE_REASON_LENGTH = 200;

/** The billing-line fields the row needs (a ServiceSelection has them all). */
export interface InvoiceLineSource {
  tariffId: string;
  code: string;
  description: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  teethNumbers?: string[];
  /** yyyy-MM-dd; the visit date when absent */
  serviceDate?: string | null;
  /** users.id of the treating practitioner; the invoice's when absent */
  practitionerId?: string | null;
  /** N$ off the line (private patients only) */
  discountAmount?: number | null;
  /** ICD-10 codes, main code first */
  icd10Codes?: readonly string[] | null;
  /** Set when the unit price was changed from the price list */
  feeOverride?: LineFeeOverride | null;
  /** Paid by one side only (medical aid patients): 'patient' lines are never claimed; absent: the fund's rules */
  paidBy?: PaidBy | null;
  /** The fund's authorisation number for the line (claim field 31) */
  authorisationNumber?: string | null;
  /** Surfaces of the line's one tooth ("MO") */
  toothSurfaces?: string | null;
  /** The quadrant of a code billed per quadrant (1-4) */
  toothQuadrant?: number | null;
  /** users.id of the assistant and the anaesthetist on the line */
  assistantId?: string | null;
  anaesthetistId?: string | null;
  /** The line's own referral from the patient's register; absent: the visit's */
  referralId?: string | null;
  /** The promotion its discount came from, and the prepaid package it was paid from (billing extras) */
  promotionId?: string | null;
  packageId?: string | null;
}

export interface InvoiceLineContext {
  invoiceId: string;
  hasMedicalAid: boolean;
  /** The patient's co-payment for their fund (copayFor), 0 or absent for none */
  copayPercent?: number | null;
  /** Or a fixed co-payment per line in N$ (copayFor), 0 or absent for none */
  copayAmount?: number | null;
  /** The fund's levy in N$, once per invoice: only buildInvoiceLineRows charges it */
  levy?: number | null;
  /** True once invoice_services has service_date, practitioner_id and discount_amount */
  lineDetails?: boolean;
  /** True once invoice_services has icd10_primary, icd10_secondary and the fee_override_* columns */
  lineCodes?: boolean;
  /** True once invoice_services has paid_by and authorisation_number */
  linePortions?: boolean;
  /** True once invoice_services has tooth_surfaces and tooth_quadrant */
  lineTeeth?: boolean;
  /** True once invoice_services has referral_id, assistant_id and anaesthetist_id */
  linePeople?: boolean;
  /** True once invoice_services has promotion_id and package_id */
  lineExtras?: boolean;
  defaultServiceDate?: string | null;
  defaultPractitionerId?: string | null;
}

export interface InvoiceLineRow {
  invoice_id: string;
  tariff_id: string;
  code: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  medical_aid_covered: number;
  patient_portion: number;
  notes: string;
  tooth_number: string | null;
  service_date?: string | null;
  practitioner_id?: string | null;
  discount_amount?: number;
  icd10_primary?: string | null;
  icd10_secondary?: string[];
  fee_override_reason?: string | null;
  fee_override_from?: number | null;
  fee_override_by?: string | null;
  fee_override_at?: string | null;
  paid_by?: PaidBy | null;
  authorisation_number?: string | null;
  tooth_surfaces?: string | null;
  tooth_quadrant?: number | null;
  referral_id?: string | null;
  assistant_id?: string | null;
  anaesthetist_id?: string | null;
  promotion_id?: string | null;
  package_id?: string | null;
}

type LineCodeColumns = Required<Pick<InvoiceLineRow, 'icd10_primary' | 'icd10_secondary' | 'fee_override_reason' | 'fee_override_from' | 'fee_override_by' | 'fee_override_at'>>;

/** The amounts of one line: unit price, gross (unit x quantity), discount, the total after it and the two portions, in cents. */
export interface InvoiceLineAmounts {
  unitCents: number;
  grossCents: number;
  discountCents: number;
  totalCents: number;
  fundCents: number;
  patientCents: number;
}

/** Works out a line's amounts (no levy: see invoiceLinesAmounts); throws with the reason when the line cannot be billed as it is. */
export function invoiceLineAmounts(
  service: Pick<InvoiceLineSource, 'code' | 'unitPrice' | 'quantity' | 'discountAmount' | 'paidBy'>,
  context: Pick<InvoiceLineContext, 'hasMedicalAid' | 'copayPercent' | 'copayAmount'>
): InvoiceLineAmounts {
  const line = computeLine({ code: service.code, unitPrice: service.unitPrice, quantity: service.quantity, multiplyRule: 'YES', hasMedicalAid: context.hasMedicalAid });
  if (!line.ok) throw new Error(line.errors.join(' '));
  const discount = applyLineDiscount({ code: service.code, grossCents: line.totalCents, discount: service.discountAmount, hasMedicalAid: context.hasMedicalAid });
  if (!discount.ok) throw new Error(discount.message);
  const split = splitLineCents({
    totalCents: discount.netCents,
    hasMedicalAid: context.hasMedicalAid,
    copayPercent: context.copayPercent ?? 0,
    copayAmount: context.copayAmount ?? 0,
    paidBy: service.paidBy ?? null
  });
  return {
    unitCents: line.unitCents,
    grossCents: line.totalCents,
    discountCents: discount.discountCents,
    totalCents: discount.netCents,
    fundCents: split.fundCents,
    patientCents: split.patientCents
  };
}

type LevyContext = Pick<InvoiceLineContext, 'hasMedicalAid' | 'copayPercent' | 'copayAmount' | 'levy'>;

/** The levy in cents for a context: none for private patients or without one. */
const levyCentsOf = (context: LevyContext): number => (context.hasMedicalAid && (context.levy ?? 0) > 0 ? toCents(context.levy ?? 0) : 0);

/**
 * Every line's amounts on one invoice, with the fund's levy taken off the fund's share once (applyLevy: first line
 * first, never from a line paid by one side only). A line that cannot be priced is null and carries no levy; the
 * screen shows why. `levyCents` is the levy charged.
 */
export function invoiceLinesAmounts(
  services: readonly Pick<InvoiceLineSource, 'code' | 'unitPrice' | 'quantity' | 'discountAmount' | 'paidBy'>[],
  context: LevyContext
): { amounts: (InvoiceLineAmounts | null)[]; levyCents: number } {
  const priced = services.map(service => {
    try {
      return invoiceLineAmounts(service, context);
    } catch {
      return null;
    }
  });
  const levied = applyLevy(
    priced.map((amounts, index) => ({
      fundCents: amounts?.fundCents ?? 0,
      patientCents: amounts?.patientCents ?? 0,
      levyApplies: amounts !== null && context.hasMedicalAid && !services[index].paidBy
    })),
    levyCentsOf(context)
  );
  return {
    amounts: priced.map((amounts, index) => (amounts ? { ...amounts, fundCents: levied.lines[index].fundCents, patientCents: levied.lines[index].patientCents } : null)),
    levyCents: levied.levyCents
  };
}

const text = (value: string | null | undefined): string | null => (value?.trim() ? value.trim() : null);

/**
 * A line's ICD-10 and changed-fee columns: the codes tidied (each once, main code first) and checked as the claim
 * checks them, so a code the fund would refuse is never stored; the fee change only when the price really differs from
 * the price before it, and only with a reason, a name and a time.
 */
function lineCodeColumns(service: InvoiceLineSource, unitCents: number): LineCodeColumns {
  const listed = service.icd10Codes ?? [];
  const codes = icd10CodesOf({ primary: listed[0] ?? '', secondary: listed.slice(1) });
  if (codes.length > 0) {
    const { errors } = validateIcd10Selection({ primary: codes[0], secondary: codes.slice(1) });
    if (errors.length > 0) throw new Error(`Code ${service.code}: ${errors.join(' ')}`);
  }
  const fee = service.feeOverride && toCents(service.feeOverride.fromUnitPrice) !== unitCents ? service.feeOverride : null;
  if (fee) {
    const reason = fee.reason.trim();
    if (!reason) throw new Error(`Code ${service.code}: say why the fee was changed.`);
    if (reason.length > MAX_FEE_REASON_LENGTH) throw new Error(`Code ${service.code}: the reason for the new fee can be at most ${MAX_FEE_REASON_LENGTH} characters.`);
    if (!Number.isFinite(fee.fromUnitPrice) || fee.fromUnitPrice < 0) throw new Error(`Code ${service.code}: the price before the change is not a valid amount.`);
    if (!text(fee.by) || Number.isNaN(Date.parse(fee.at))) throw new Error(`Code ${service.code}: the fee change has no name or time. Change the fee again.`);
  }
  return {
    icd10_primary: codes[0] ?? null,
    icd10_secondary: codes.slice(1),
    fee_override_reason: fee ? fee.reason.trim() : null,
    fee_override_from: fee ? fromCents(toCents(fee.fromUnitPrice)) : null,
    fee_override_by: fee ? fee.by : null,
    fee_override_at: fee ? fee.at : null
  };
}

/**
 * Who pays the line and its authorisation number, checked: before the database has the columns a line paid by one
 * side or with an authorisation number is refused, because the claim would ignore both (a patient's own line would be
 * claimed from the fund). A private patient's line is the patient's anyway, so it never stores a payer.
 */
function linePortionColumns(service: InvoiceLineSource, context: InvoiceLineContext): Pick<InvoiceLineRow, 'paid_by' | 'authorisation_number'> | null {
  const paidBy = context.hasMedicalAid ? service.paidBy ?? null : null;
  const authorisation = parseAuthorisationNumber(service.authorisationNumber);
  if (!authorisation.ok) throw new Error(`Code ${service.code}: ${authorisation.message}`);
  if (!context.linePortions) {
    if (paidBy) throw new Error(`Code ${service.code}: "${paidBy === 'patient' ? 'patient pays all' : 'medical aid pays all'}" can be saved once the line-portions update is applied.`);
    if (authorisation.value) throw new Error(`Code ${service.code}: authorisation numbers can be saved once the line-portions update is applied.`);
    return null;
  }
  return { paid_by: paidBy, authorisation_number: authorisation.value };
}

/**
 * The surfaces of the line's one tooth (in the chart's order; none for a line of several teeth) and its quadrant.
 * Before the database has the columns, a line with either is refused: the claim would go out without them.
 */
function lineTeethColumns(service: InvoiceLineSource, context: InvoiceLineContext): Pick<InvoiceLineRow, 'tooth_surfaces' | 'tooth_quadrant'> | null {
  const quadrant = service.toothQuadrant ?? null;
  if (quadrant !== null && !isQuadrant(quadrant)) throw new Error(`Code ${service.code}: a quadrant is 1, 2, 3 or 4.`);
  const surfaces = lineSurfaces(service.teethNumbers, service.toothSurfaces);
  if (!context.lineTeeth) {
    if (surfaces || quadrant !== null) throw new Error(`Code ${service.code}: tooth surfaces and quadrants can be saved once the tooth-surfaces update is applied.`);
    return null;
  }
  return { tooth_surfaces: surfaces, tooth_quadrant: quadrant };
}

/**
 * The people on the line: its own referral (claim fields 25, 43, 44; none: the visit's), the assistant and the
 * anaesthetist. Before the database has the columns a line naming any of them is refused: the claim would go out with
 * the visit's referral instead, and the people would be lost.
 */
function linePeopleColumns(service: InvoiceLineSource, context: InvoiceLineContext): Pick<InvoiceLineRow, 'referral_id' | 'assistant_id' | 'anaesthetist_id'> | null {
  const people = { referral_id: text(service.referralId), assistant_id: text(service.assistantId), anaesthetist_id: text(service.anaesthetistId) };
  if (!context.linePeople) {
    if (people.referral_id || people.assistant_id || people.anaesthetist_id) {
      throw new Error(`Code ${service.code}: a line's own referral, assistant or anaesthetist can be saved once the referrals update is applied.`);
    }
    return null;
  }
  return people;
}

/**
 * The promotion a line's discount came from (named only while the line has a discount) and the prepaid package it was
 * paid from (proposals/2026-10-13-billing-extras.sql). Before the database has the columns a line naming either is
 * refused: Discounts given would lose the promotion and the package would never count the session.
 */
function lineExtraColumns(service: InvoiceLineSource, context: InvoiceLineContext, amounts: InvoiceLineAmounts): Pick<InvoiceLineRow, 'promotion_id' | 'package_id'> | null {
  const extras = { promotion_id: amounts.discountCents > 0 ? text(service.promotionId) : null, package_id: text(service.packageId) };
  if (!context.lineExtras) {
    if (extras.promotion_id || extras.package_id) {
      throw new Error(`Code ${service.code}: a promotion or a prepaid package can be saved once the billing extras update is applied.`);
    }
    return null;
  }
  return extras;
}

/** The invoice_services row for a line (see the file comment). It never charges the fund's levy: that is per invoice. */
export function buildInvoiceLineRow(service: InvoiceLineSource, context: InvoiceLineContext): InvoiceLineRow {
  return rowFor(service, context, invoiceLineAmounts(service, context));
}

/**
 * The invoice_services rows for all of an invoice's lines, in order: each priced and checked as buildInvoiceLineRow
 * does, and the fund's levy taken off the fund's share once (invoiceLinesAmounts). Throws on the first line that
 * cannot be billed, so nothing is written for a refused invoice.
 */
export function buildInvoiceLineRows(services: readonly InvoiceLineSource[], context: InvoiceLineContext): InvoiceLineRow[] {
  // Priced one by one first, so a refused line throws with its own reason
  services.forEach(service => invoiceLineAmounts(service, context));
  const { amounts } = invoiceLinesAmounts(services, context);
  return services.map((service, index) => rowFor(service, context, amounts[index] as InvoiceLineAmounts));
}

function rowFor(service: InvoiceLineSource, context: InvoiceLineContext, amounts: InvoiceLineAmounts): InvoiceLineRow {
  const codes = context.lineCodes ? lineCodeColumns(service, amounts.unitCents) : null;
  const portions = linePortionColumns(service, context);
  const teeth = lineTeethColumns(service, context);
  const people = linePeopleColumns(service, context);
  const extras = lineExtraColumns(service, context, amounts);
  // Before the database has the columns a changed fee cannot say why or who changed it, so it is refused rather than lost
  if (!codes && service.feeOverride && toCents(service.feeOverride.fromUnitPrice) !== amounts.unitCents) {
    throw new Error(`Code ${service.code}: a changed fee can be saved once the invoice-line update is applied.`);
  }
  // system_transaction_number is left out: an insert trigger numbers the lines in sequence (ADD_SYSTEM_TRANSACTION_NUMBER.sql)
  const row: InvoiceLineRow = {
    invoice_id: context.invoiceId,
    tariff_id: service.tariffId,
    code: service.code,
    description: service.description,
    quantity: service.quantity,
    unit_price: fromCents(amounts.unitCents),
    total_price: fromCents(amounts.totalCents),
    medical_aid_covered: fromCents(amounts.fundCents),
    patient_portion: fromCents(amounts.patientCents),
    notes: service.notes || '',
    tooth_number: service.teethNumbers ? service.teethNumbers.join(',') : null
  };
  if (!context.lineDetails) {
    // Before the database has the columns a discount cannot be stored, so it is refused rather than lost
    if (amounts.discountCents > 0) throw new Error(`Code ${service.code}: discounts can be saved once the invoicing update is applied.`);
    return { ...row, ...(codes ?? {}), ...(portions ?? {}), ...(teeth ?? {}), ...(people ?? {}), ...(extras ?? {}) };
  }
  // A line stores only what differs from the visit: NULL follows the visit's date and treating practitioner, so
  // correcting the visit later moves those lines with it (claims and the printed invoice read NULL as the visit's)
  const ownDate = text(service.serviceDate);
  if (ownDate !== null && !isValidDateKey(ownDate)) throw new Error(`Code ${service.code}: the service date "${ownDate}" is not a valid date.`);
  const ownPractitioner = text(service.practitionerId);
  return {
    ...row,
    service_date: ownDate !== null && ownDate !== text(context.defaultServiceDate) ? ownDate : null,
    practitioner_id: ownPractitioner !== null && ownPractitioner !== text(context.defaultPractitionerId) ? ownPractitioner : null,
    discount_amount: fromCents(amounts.discountCents),
    ...(codes ?? {}),
    ...(portions ?? {}),
    ...(teeth ?? {}),
    ...(people ?? {}),
    ...(extras ?? {})
  };
}
