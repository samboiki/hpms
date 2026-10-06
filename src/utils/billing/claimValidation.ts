/**
 * Claim line and batch validation, run before a claim file is generated or submitted.
 *
 * Every rule below is a reason a fund rejects or short-pays a claim: missing membership or
 * member details, wrong practice or practitioner number, a tariff code that is not a NAMAF
 * code, no ICD-10 code, a service date past the fund's deadline, or amounts that do not add up.
 * Errors block submission; warnings are shown but do not block.
 */
import { checkClaimDeadline, describeDeadline, type DeadlineCheck, type FundRule } from './fundRules.ts';
import { isValidDateKey, daysBetweenKeys } from './dates.ts';
import { formatNad, hasAtMostDecimals, sumCents, toCents } from './money.ts';
import { MAX_QUANTITY, isValidFdiTooth, parseToothList, verifyLineAmounts } from './pricing.ts';
import { validateIcd10Selection } from './icd10.ts';
import { normalizeGender, normalizeRegistrationNumber, type ClaimLine } from './claimLine.ts';

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
const PRACTICE_NUMBER_PATTERN = /^\d{7,15}$/;
const HPCNA_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 /-]{2,19}$/;
const TARIFF_CODE_PATTERN = /^\d{4}$/;
const MAX_AGE_YEARS = 130;

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

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

  const initials = text(line.memberInitials).replace(/[\s.]/g, '');
  if (!initials) error('memberInitials', 'Main member initials are missing.');
  else if (!INITIALS_PATTERN.test(initials)) error('memberInitials', 'Main member initials may only contain letters (at most 10).');

  if (!text(line.patientName)) error('patientName', 'Patient name is missing.');

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

  const idNumber = text(line.patientIdNumber);
  if (!idNumber) error('patientIdNumber', 'Patient ID number is missing.');
  else if (!ID_NUMBER_PATTERN.test(idNumber)) {
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
  else if (context.practiceNumber && practiceNumber !== text(context.practiceNumber)) {
    error('practiceNumber', `Practice number ${practiceNumber} differs from this practice's number ${text(context.practiceNumber)}.`);
  }

  const hpcna = text(line.treatingDoctorHpcnaNumber);
  if (!hpcna) error('treatingDoctorHpcnaNumber', 'Treating doctor HPCNA registration number is missing.');
  else if (!HPCNA_PATTERN.test(hpcna)) error('treatingDoctorHpcnaNumber', `HPCNA number "${hpcna}" is not in a valid format.`);
  else if (line.doctorHpcnaNumber && normalizeRegistrationNumber(line.doctorHpcnaNumber) !== normalizeRegistrationNumber(hpcna)) {
    warn('treatingDoctorHpcnaNumber', `HPCNA number ${hpcna} differs from the treating doctor's registered number ${text(line.doctorHpcnaNumber)}.`);
  }

  // What was done
  const tariffCode = text(line.tariffCode);
  if (!tariffCode) error('tariffCode', 'Tariff code is missing.');
  else if (!TARIFF_CODE_PATTERN.test(tariffCode)) error('tariffCode', `Tariff code "${tariffCode}" is not a 4-digit NAMAF code.`);

  if (!text(line.description)) warn('description', 'Service description is empty.');
  if (!text(line.invoiceNumber)) error('invoiceNumber', 'Invoice number is missing.');
  if (!text(line.fundReference)) error('fundReference', 'Medical aid fund reference is missing.');
  if (!Number.isInteger(line.transactionNumber) || line.transactionNumber < 1) {
    error('transactionNumber', 'Line number in the batch is missing.');
  }
  if (line.systemTransactionNumber === null || line.systemTransactionNumber === undefined) {
    warn('systemTransactionNumber', 'No system transaction number: the fund cannot match its response to this line.');
  }

  // When
  const deadline = checkClaimDeadline(line.serviceDate, context.today, context.fundRule);
  if (deadline.status === 'invalid') error('serviceDate', 'Service date is missing or not a valid date.');
  else if (deadline.status === 'future') error('serviceDate', 'Service date is in the future.');
  else if (deadline.status === 'expired') {
    error('serviceDate', `The claim deadline passed on ${deadline.lastDay} (${context.fundRule.label}: ${describeDeadline(context.fundRule)} from the service date).`);
  } else if (deadline.status === 'expiring') {
    warn('serviceDate', `Submit by ${deadline.lastDay}: ${deadline.daysLeft} day(s) left before the fund deadline.`);
  }

  // How much
  const quantity = line.quantity;
  const quantityOk =
    typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0 && quantity <= MAX_QUANTITY && hasAtMostDecimals(quantity, 2);
  if (!quantityOk) error('quantity', `Number of services must be more than 0 and at most ${MAX_QUANTITY}.`);

  if (typeof line.amount !== 'number' || !Number.isFinite(line.amount) || toCents(line.amount) <= 0) {
    error('amount', 'The line amount must be more than N$ 0.00.');
  } else if (quantityOk && typeof line.unitPrice === 'number') {
    const check = verifyLineAmounts(line.unitPrice, quantity, line.amount);
    if (!check.ok) error('amount', `The line amount is wrong: ${check.message}.`);
  }

  // Diagnosis
  const icd = validateIcd10Selection({ primary: line.icd10Primary, secondary: line.icd10Secondary });
  icd.errors.forEach(message => error('icd10', message));
  icd.warnings.forEach(message => warn('icd10', message));
  if (text(line.icd10Primary) && !line.icd10Confirmed) {
    error('icd10', 'Confirm the ICD-10 code suggested from the visit notes.');
  }

  // Teeth (dental)
  const teeth = parseToothList(text(line.toothNumbers));
  if (line.requiresTooth && teeth.length === 0) error('toothNumbers', `Code ${tariffCode || '?'} needs a tooth number.`);
  teeth.filter(tooth => !isValidFdiTooth(tooth)).forEach(tooth => error('toothNumbers', `"${tooth}" is not a valid tooth number.`));
  if (teeth.length > 1) warn('toothNumbers', 'More than one tooth on one line; funds usually expect one tooth per line.');

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
  const results = lines.map(line => validateClaimLine(line, context));
  const batchIssues: ClaimIssue[] = [];
  const error = (message: string) => batchIssues.push({ field: 'batch', severity: 'error', message });
  const warn = (message: string) => batchIssues.push({ field: 'batch', severity: 'warning', message });

  if (lines.length === 0) error('The batch has no claim lines.');

  const funds = [...new Set(lines.map(line => text(line.fundReference)).filter(Boolean))];
  if (funds.length > 1) error(`A batch must be for one fund, but it has lines for ${funds.join(', ')}.`);

  const practices = [...new Set(lines.map(line => text(line.practiceNumber)).filter(Boolean))];
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

  findDuplicates(
    lines.map(line =>
      [text(line.invoiceNumber), text(line.tariffCode), text(line.toothNumbers), text(line.serviceDate), String(line.amount)].join('|')
    )
  ).forEach(signature => {
    const [invoice, code] = signature.split('|');
    warn(`Invoice ${invoice} has code ${code} more than once with the same tooth, date and amount; check it is not billed twice.`);
  });

  if (!context.fundRule.configured) {
    warn(`No claim deadline is configured for this fund; ${describeDeadline(context.fundRule)} is assumed.`);
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
