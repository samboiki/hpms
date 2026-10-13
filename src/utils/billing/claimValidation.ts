/**
 * Claim line and batch validation, run before a claim file is generated or submitted.
 *
 * Every rule below is a reason a fund rejects or short-pays a claim: missing membership or
 * member details, wrong practice or practitioner number, a tariff code that is not a NAMAF
 * code, no ICD-10 code (or one the medical aids' ICD-10 list does not accept there), a service
 * date past the fund's deadline, or amounts that do not add up.
 * Errors block submission; warnings are shown but do not block.
 */
import { checkClaimDeadline, deadlineCaveat, deadlineFromService, describeDeadline, type DeadlineCheck, type FundRule } from './fundRules.ts';
import { isValidDateKey, daysBetweenKeys } from './dates.ts';
import { formatNad, hasAtMostDecimals, sumCents, toCents } from './money.ts';
import { MAX_QUANTITY, isValidFdiTooth, parseToothList, verifyLineAmounts } from './pricing.ts';
import { normalizeIcd10, validateIcd10Selection } from './icd10.ts';
import { icd10ListProblems, type Icd10MasterEntry } from './icd10Master.ts';
import { isReversalTransactionType, joinDiagnosisCodes } from './claimFile.ts';
import { checkTariffRules, isDentalPractice } from './tariffRules.ts';
import { CLAIM_FIELD_MAX, MEDICINE_TARIFF_CODE, claimInvoiceReference, isDependantRelationship, isMedicineLine, normalizeGender, normalizeRegistrationNumber, type ClaimLine } from './claimLine.ts';
import { isTemporaryIdNumber } from '../patients/temporaryPatient.ts';
import { PRACTICE_NUMBER_PATTERN } from './practitionerBilling.ts';
import { surfaceCodeProblem } from '../dental/workTypes.ts';

export type ClaimField =
  | 'membershipNumber'
  | 'memberSurname'
  | 'memberInitials'
  | 'patientName'
  | 'patientDateOfBirth'
  | 'patientIdNumber'
  | 'patientReference'
  | 'gender'
  | 'practiceNumber'
  | 'treatingDoctorHpcnaNumber'
  | 'tariffCode'
  | 'description'
  | 'serviceDate'
  | 'quantity'
  | 'amount'
  | 'icd10'
  | 'toothNumbers'
  | 'invoiceNumber'
  | 'fundReference'
  | 'transactionNumber'
  | 'systemTransactionNumber'
  | 'batch';

export interface ClaimIssue {
  field: ClaimField;
  severity: 'error' | 'warning';
  message: string;
}

export interface ClaimValidationContext {
  /** Submission date, yyyy-MM-dd. */
  today: string;
  fundRule: FundRule;
  /** The practice's own practice number, when known. */
  practiceNumber?: string | null;
  /** practices.practice_type: the NAMAF dental rules run for dental practices only. */
  practiceType?: string | null;
  /**
   * The batch header's transaction type. A credit file (C) reverses lines the fund already received, for the amount
   * credited: the fund's deadline (counted from the service date) and the unit price check do not apply to it.
   */
  transactionType?: string | null;
  /**
   * The medical aids' ICD-10 list entries for the codes on the batch (lookupIcd10Codes: one query); a code missing from
   * it is not in the list. Null or left out while the list cannot be read: codes are then checked by their shape only.
   */
  icd10Master?: ReadonlyMap<string, Icd10MasterEntry> | null;
}

export interface LineValidation {
  key: string;
  errors: ClaimIssue[];
  warnings: ClaimIssue[];
  deadline: DeadlineCheck;
}

export const MAX_MEMBER_SURNAME_LENGTH = 50;
const MEMBERSHIP_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/-]{1,19}$/;
const NAME_PATTERN = /^\p{L}[\p{L}' .-]*$/u;
const INITIALS_PATTERN = /^[A-Za-z]{1,10}$/;
const ID_NUMBER_PATTERN = /^[A-Za-z0-9]{5,20}$/;
const HPCNA_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 /-]{2,19}$/;
const TARIFF_CODE_PATTERN = /^\d{4}$/;
const MAX_AGE_YEARS = 130;

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

/** A line billed under its treating practitioner's own practice number (a partner; practitioner_billing). */
const billsUnderOwnNumber = (line: Pick<ClaimLine, 'practiceNumber' | 'practitionerPracticeNumber'>): boolean =>
  text(line.practitionerPracticeNumber) !== '' && text(line.practiceNumber) === text(line.practitionerPracticeNumber);

/** Validates one claim line. */
export function validateClaimLine(line: ClaimLine, context: ClaimValidationContext): LineValidation {
  const issues: ClaimIssue[] = [];
  const error = (field: ClaimField, message: string) => issues.push({ field, severity: 'error', message });
  const warn = (field: ClaimField, message: string) => issues.push({ field, severity: 'warning', message });

  // Who the claim is for
  const membership = text(line.membershipNumber);
  if (!membership) error('membershipNumber', 'Medical aid membership number is missing.');
  else if (!MEMBERSHIP_PATTERN.test(membership)) {
    error('membershipNumber', `Membership number "${membership}" may only contain letters, digits, "/" or "-" (2-20 characters).`);
  }

  const surname = text(line.memberSurname);
  if (!surname) error('memberSurname', 'Main member surname is missing.');
  else if (surname.length > MAX_MEMBER_SURNAME_LENGTH) error('memberSurname', 'Main member surname is longer than 50 characters.');
  else if (!NAME_PATTERN.test(surname)) error('memberSurname', 'Main member surname contains characters that are not allowed.');
  else if (surname.length > CLAIM_FIELD_MAX.memberSurname) {
    warn('memberSurname', `The claim carries only the first ${CLAIM_FIELD_MAX.memberSurname} characters of the main member surname.`);
  }

  const initials = text(line.memberInitials).replace(/[\s.]/g, '');
  if (!initials && line.memberNameSource === 'main-member') {
    error('memberInitials', "Main member initials are missing: add the main member's first name(s) to the patient's medical aid details.");
  } else if (!initials) error('memberInitials', 'Main member initials are missing.');
  else if (!INITIALS_PATTERN.test(initials)) error('memberInitials', 'Main member initials may only contain letters (at most 10).');
  else if (initials.length > CLAIM_FIELD_MAX.memberInitials) {
    warn('memberInitials', `The claim carries only the first ${CLAIM_FIELD_MAX.memberInitials} initials.`);
  }

  // Funds match a dependant through the main member; naming the dependant as the member is rejected
  if (isDependantRelationship(line.relationshipToMainMember) && line.memberNameSource !== 'main-member') {
    warn('memberSurname', `The patient is the main member's ${text(line.relationshipToMainMember).toLowerCase()}, but the medical aid details have no main member name, so the claim names the patient as the member; funds often reject that.`);
  }

  if (!text(line.patientName)) error('patientName', 'Patient name is missing.');
  // The practice decided not to send this patient's invoices to a medical aid; the line must leave the batch first
  if (line.doNotClaim) {
    const reason = text(line.doNotClaim.reason);
    error('patientName', `This patient is marked "Do not claim"${reason ? ` (${reason})` : ''}. Remove the invoice from this batch, or clear the flag on the patient's account first.`);
  }

  const dob = line.patientDateOfBirth;
  if (!isValidDateKey(dob)) {
    error('patientDateOfBirth', 'Patient date of birth is missing or not a valid date.');
  } else if (dob > context.today) {
    error('patientDateOfBirth', 'Patient date of birth is in the future.');
  } else if (isValidDateKey(line.serviceDate) && dob > line.serviceDate) {
    error('patientDateOfBirth', 'Patient date of birth is after the service date.');
  } else if (daysBetweenKeys(dob, context.today) > MAX_AGE_YEARS * 366) {
    error('patientDateOfBirth', 'Patient date of birth is more than 130 years ago.');
  }

  // Optional in the claim layout: the funds paid lines without one (often children), so only warn
  const idNumber = text(line.patientIdNumber);
  if (!idNumber) warn('patientIdNumber', 'No patient ID number: the fund can still pay, but it helps it find the right dependant.');
  else if (isTemporaryIdNumber(idNumber)) {
    // Booked with a name and cell only: the ID number, and possibly the date of birth and gender, are placeholders
    error('patientIdNumber', "The patient's file is not complete (booked with a name and cell number only). Add the ID number, date of birth and gender on the patient's file first.");
  } else if (!ID_NUMBER_PATTERN.test(idNumber)) {
    error('patientIdNumber', 'Patient ID number may only contain letters and digits (5-20 characters).');
  } else if (!/^\d{11}$/.test(idNumber)) {
    warn('patientIdNumber', `Patient ID "${idNumber}" is not an 11-digit Namibian ID number; check it (passport numbers are allowed).`);
  }

  const reference = text(line.patientReference);
  if (!reference) error('patientReference', 'Patient reference number is missing.');
  else if (!/^\d{1,7}$/.test(reference)) error('patientReference', 'Patient reference must be a number of up to 7 digits.');

  if (!normalizeGender(line.gender)) error('gender', 'Patient gender must be M or F.');

  // Who claims
  const practiceNumber = text(line.practiceNumber);
  if (!practiceNumber) error('practiceNumber', 'Practice number is missing.');
  else if (!PRACTICE_NUMBER_PATTERN.test(practiceNumber)) error('practiceNumber', `Practice number "${practiceNumber}" must be 7-15 digits.`);
  else if (context.practiceNumber && practiceNumber !== text(context.practiceNumber) && !billsUnderOwnNumber(line)) {
    // A partner's own number on their line is allowed (claim field 29, practitionerBilling.ts); any other is refused
    error('practiceNumber', `Practice number ${practiceNumber} differs from this practice's number ${text(context.practiceNumber)}.`);
  }

  const hpcna = text(line.treatingDoctorHpcnaNumber);
  const practitionerName = text(line.treatingPractitionerName);
  if (!hpcna && practitionerName) {
    // Parity D31: never claimed under a colleague's number in its place
    error('treatingDoctorHpcnaNumber', `${practitionerName} treated this line and has no HPCNA registration number on record: add it under Settings > Users before the line is claimed.`);
  } else if (!hpcna) error('treatingDoctorHpcnaNumber', 'Treating doctor HPCNA registration number is missing.');
  else if (!HPCNA_PATTERN.test(hpcna)) error('treatingDoctorHpcnaNumber', `HPCNA number "${hpcna}" is not in a valid format.`);
  else if (line.doctorHpcnaNumber && normalizeRegistrationNumber(line.doctorHpcnaNumber) !== normalizeRegistrationNumber(hpcna)) {
    warn('treatingDoctorHpcnaNumber', `HPCNA number ${hpcna} differs from the treating doctor's registered number ${text(line.doctorHpcnaNumber)}.`);
  }

  // What was done
  const tariffCode = text(line.tariffCode);
  if (!tariffCode) error('tariffCode', 'Tariff code is missing.');
  else if (isMedicineLine(line)) {
    // A medicine is claimed as GMED with its NAPPI code (claim specification, field 13 and 26)
    if (tariffCode.toUpperCase() !== MEDICINE_TARIFF_CODE) error('tariffCode', `A medicine is claimed with the code ${MEDICINE_TARIFF_CODE}, not "${tariffCode}".`);
    if (!text(line.extra?.nappiCode)) error('tariffCode', "This medicine has no NAPPI code: add it to the stock item and save the invoice line again.");
  } else if (!TARIFF_CODE_PATTERN.test(tariffCode)) error('tariffCode', `Tariff code "${tariffCode}" is not a 4-digit NAMAF code.`);

  if (!text(line.description)) warn('description', 'Service description is empty.');
  if (!text(line.invoiceNumber)) error('invoiceNumber', 'Invoice number is missing.');
  if (!text(line.fundReference)) error('fundReference', 'Medical aid fund reference is missing.');
  if (!Number.isInteger(line.transactionNumber) || line.transactionNumber < 1) {
    error('transactionNumber', 'Line number in the batch is missing.');
  }
  if (line.systemTransactionNumber === null || line.systemTransactionNumber === undefined) {
    warn('systemTransactionNumber', 'No system transaction number: the fund cannot match its response to this line.');
  }

  // When (a reversal is never late: it takes back what the fund was claimed, however long ago)
  const reversal = isReversalTransactionType(context.transactionType);
  const deadline = checkClaimDeadline(line.serviceDate, context.today, context.fundRule);
  if (deadline.status === 'invalid') error('serviceDate', 'Service date is missing or not a valid date.');
  else if (deadline.status === 'future') error('serviceDate', 'Service date is in the future.');
  else if (deadline.status === 'expired' && !reversal) {
    // Only a deadline confirmed with the fund blocks; a guessed one must not stop a claim the fund may still pay
    if (context.fundRule.confirmed) {
      error('serviceDate', `The claim deadline passed on ${deadline.lastDay} (${context.fundRule.label}: ${deadlineFromService(context.fundRule)}).`);
    } else {
      warn('serviceDate', `The claim deadline (${deadlineFromService(context.fundRule)}, ${deadlineCaveat(context.fundRule)}) passed on ${deadline.lastDay}. The line can still be sent; the fund may refuse it.`);
    }
  } else if (deadline.status === 'expiring' && !reversal) {
    warn('serviceDate', `Submit by ${deadline.lastDay}: ${deadline.daysLeft} day(s) left before the fund deadline.`);
  }

  // How much
  const quantity = line.quantity;
  const quantityOk =
    typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 && quantity <= MAX_QUANTITY && hasAtMostDecimals(quantity, 2);
  if (!quantityOk) error('quantity', `Number of services must be more than 0 and at most ${MAX_QUANTITY}.`);
  // A code the practice charges by time: field 18 carries the minutes, or the fund refuses the line (QEDI D036)
  if (line.chargedByTime && !(typeof line.timeMinutes === 'number' && line.timeMinutes > 0) && !reversal) {
    warn(
      'quantity',
      `Code ${text(line.tariffCode)} is charged by time, but its line's note does not say how long it took (for example "45 minutes"), so the fund gets the number of services instead of the minutes and may refuse the line.`
    );
  }

  if (typeof line.amount !== 'number' || !Number.isFinite(line.amount) || toCents(line.amount) <= 0) {
    error('amount', 'The line amount must be more than N$ 0.00.');
  } else if (quantityOk && typeof line.unitPrice === 'number' && !reversal) {
    // A reversal carries the amount credited, which need not be a whole number of units
    const check = verifyLineAmounts(line.unitPrice, quantity, line.amount);
    if (!check.ok) error('amount', `The line amount is wrong: ${check.message}.`);
  }

  // Diagnosis
  const icd = validateIcd10Selection({ primary: line.icd10Primary, secondary: line.icd10Secondary });
  icd.errors.forEach(message => error('icd10', message));
  icd.warnings.forEach(message => warn('icd10', message));
  // The funds check every code against the medical aids' ICD-10 list: a category heading, an asterisk code first, a
  // discontinued code or one not in the list is rejected; a code that may not come first, or that is meant for the
  // other sex or another age, is questioned. A reversal carries the codes the fund already received, so it is not held up
  if (context.icd10Master && !reversal) {
    icd10ListProblems([line.icd10Primary, ...line.icd10Secondary], context.icd10Master, {
      serviceDate: line.serviceDate,
      patient: { gender: normalizeGender(line.gender), dateOfBirth: line.patientDateOfBirth }
    }).forEach(problem => (problem.severity === 'error' ? error : warn)('icd10', problem.message));
  }
  // The claim carries at most 5 codes in 64 characters (field 33): name the ones that will not reach the fund
  const sentCodes = joinDiagnosisCodes(line.icd10Primary, line.icd10Secondary).split('/').filter(Boolean);
  const notSent = [...new Set([line.icd10Primary, ...line.icd10Secondary].map(code => normalizeIcd10(code ?? '')).filter(Boolean))]
    .filter(code => !sentCodes.includes(code));
  if (sentCodes.length > 0 && notSent.length > 0) {
    warn('icd10', `Only ${sentCodes.length} ICD-10 codes fit on a claim line; not sent: ${notSent.join(', ')}. Put the codes that matter most first.`);
  }
  if (text(line.icd10Primary) && !line.icd10Confirmed) {
    error('icd10', "Confirm the suggested ICD-10 code (the practice's usual code for this service, or the visit's diagnosis).");
  }

  // Teeth (dental)
  const teeth = parseToothList(text(line.toothNumbers));
  if (line.requiresTooth && teeth.length === 0) error('toothNumbers', `Code ${tariffCode || '?'} needs a tooth number.`);
  teeth.filter(tooth => !isValidFdiTooth(tooth)).forEach(tooth => error('toothNumbers', `"${tooth}" is not a valid tooth number.`));
  if (teeth.length > CLAIM_FIELD_MAX.teeth) error('toothNumbers', `At most ${CLAIM_FIELD_MAX.teeth} teeth fit on one claim line; split the line.`);
  else if (teeth.length > 1) warn('toothNumbers', 'More than one tooth on one line; funds usually expect one tooth per line.');

  // Surfaces (dental, parity D5): the claim says "TOOTH: 46 MO", so a filling's code must be the one for that many
  // surfaces; the fund pays the code, so a mismatch over- or under-charges. The message names the code that fits
  const surfaceProblem = surfaceCodeProblem(tariffCode, line.toothSurfaces);
  if (surfaceProblem) warn('tariffCode', surfaceProblem.message);

  return {
    key: line.key,
    errors: issues.filter(issue => issue.severity === 'error'),
    warnings: issues.filter(issue => issue.severity === 'warning'),
    deadline
  };
}

export interface BatchValidation {
  lines: LineValidation[];
  batchIssues: ClaimIssue[];
  errorCount: number;
  warningCount: number;
  validLineCount: number;
  totalCents: number;
  canSubmit: boolean;
}

/** Validates all lines of one batch plus the rules that span lines. */
export function validateClaimBatch(
  lines: readonly ClaimLine[],
  context: ClaimValidationContext & { storedTotal?: number | null }
): BatchValidation {
  // NAMAF dental rules that span lines (same visit, same tooth, 8346 after its restoration), shown on the line they
  // concern; a GP's or specialist's codes follow other schedules
  const ruleIssues = isDentalPractice(context.practiceType) ? checkTariffRules(lines) : [];
  const results = lines.map(line => {
    const result = validateClaimLine(line, context);
    const own = ruleIssues.filter(issue => issue.key === line.key);
    const asIssues = (severity: 'error' | 'warning'): ClaimIssue[] =>
      own.filter(issue => issue.severity === severity).map(issue => ({ field: 'tariffCode', severity, message: issue.message }));
    return own.length === 0 ? result : { ...result, errors: [...result.errors, ...asIssues('error')], warnings: [...result.warnings, ...asIssues('warning')] };
  });
  const batchIssues: ClaimIssue[] = [];
  const error = (message: string) => batchIssues.push({ field: 'batch', severity: 'error', message });
  const warn = (message: string) => batchIssues.push({ field: 'batch', severity: 'warning', message });

  if (lines.length === 0) error('The batch has no claim lines.');

  const funds = [...new Set(lines.map(line => text(line.fundReference)).filter(Boolean))];
  if (funds.length > 1) error(`A batch must be for one fund, but it has lines for ${funds.join(', ')}.`);

  // One practice per batch; a partner's own number on their lines (claim field 29) is theirs, not another practice's
  const practices = [...new Set(lines.filter(line => !billsUnderOwnNumber(line)).map(line => text(line.practiceNumber)).filter(Boolean))];
  if (practices.length > 1) error(`A batch must be for one practice number, but it has ${practices.join(', ')}.`);

  const findDuplicates = (values: string[]) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
  findDuplicates(lines.map(line => String(line.transactionNumber))).forEach(number =>
    error(`Line number ${number} is used more than once in the batch.`)
  );
  findDuplicates(
    lines
      .filter(line => line.systemTransactionNumber !== null && line.systemTransactionNumber !== undefined)
      .map(line => String(line.systemTransactionNumber))
  ).forEach(number => error(`System transaction number ${number} is used more than once in the batch.`));

  // Field 24 carries a shortened invoice number; two invoices must never reach the fund as the same one
  const invoicesByReference = new Map<string, Set<string>>();
  lines.forEach(line => {
    const invoice = text(line.invoiceNumber);
    if (!invoice) return;
    const reference = claimInvoiceReference(invoice);
    invoicesByReference.set(reference, (invoicesByReference.get(reference) ?? new Set<string>()).add(invoice));
  });
  invoicesByReference.forEach((invoices, reference) => {
    if (invoices.size > 1) error(`Invoices ${[...invoices].join(' and ')} would both reach the fund as invoice ${reference}; send them in separate batches.`);
  });

  findDuplicates(
    lines.map(line =>
      [text(line.invoiceNumber), text(line.tariffCode), text(line.toothNumbers), text(line.serviceDate), String(line.amount)].join('|')
    )
  ).forEach(signature => {
    const [invoice, code] = signature.split('|');
    warn(`Invoice ${invoice} has code ${code} more than once with the same tooth, date and amount; check it is not billed twice.`);
  });

  if (!context.fundRule.configured && !isReversalTransactionType(context.transactionType)) {
    warn(`No claim deadline is configured for this fund; ${describeDeadline(context.fundRule)} is assumed, and late lines are flagged, not blocked.`);
  } else if (!context.fundRule.confirmed && !isReversalTransactionType(context.transactionType)) {
    warn(`${context.fundRule.label}'s claim deadline (${describeDeadline(context.fundRule)}) is not confirmed with the fund yet: late lines are flagged, not blocked.`);
  }

  const totalCents = sumCents(
    lines.map(line => (typeof line.amount === 'number' && Number.isFinite(line.amount) ? toCents(line.amount) : 0))
  );
  if (typeof context.storedTotal === 'number' && Number.isFinite(context.storedTotal) && toCents(context.storedTotal) !== totalCents) {
    warn(`The batch total on record (${formatNad(context.storedTotal)}) differs from the sum of its lines (${formatNad(totalCents / 100)}); the file uses the lines.`);
  }

  const lineErrors = results.reduce((count, result) => count + result.errors.length, 0);
  const lineWarnings = results.reduce((count, result) => count + result.warnings.length, 0);
  const errorCount = lineErrors + batchIssues.filter(issue => issue.severity === 'error').length;
  const warningCount = lineWarnings + batchIssues.filter(issue => issue.severity === 'warning').length;

  return {
    lines: results,
    batchIssues,
    errorCount,
    warningCount,
    validLineCount: results.filter(result => result.errors.length === 0).length,
    totalCents,
    canSubmit: errorCount === 0 && lines.length > 0
  };
}
