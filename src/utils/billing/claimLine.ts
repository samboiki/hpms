/**
 * One medical aid claim line (one service on one invoice), as validated and written to the
 * claim data file. Built from batch_details plus the patient, visit and doctor records.
 */

/** Fields that are passed through to the claim file as stored (usually empty). */
export interface ClaimLineExtra {
  typeOfService?: string | null;
  discountAmount?: number | null;
  serviceFee?: string | number | null;
  modifier1?: string | null;
  modifier2?: string | null;
  modifier3?: string | null;
  modifier4?: string | null;
  referringDoctor?: string | null;
  nappiCode?: string | null;
  referredToPracticeNumber?: string | null;
  hospitalIndicator?: string | null;
  diagnosticCodeType?: string | null;
  dosageDescription?: string | null;
  tariffCodeType?: string | null;
  cptCdtCode?: string | null;
  freeText?: string | null;
  placeOfService?: string | null;
  referringDoctor2?: string | null;
  trackingNumber?: string | null;
  readingAdditions?: string | null;
  lensPrescription?: string | null;
  densityOfTint?: string | null;
  serviceTime?: string | null;
  employerName?: string | null;
  employeeNumber?: string | null;
  dateOfInjury?: string | null;
  iodReferenceNumber?: string | null;
}

export interface ClaimLine {
  /** Unique key, normally batch_details.id. */
  key: string;
  /** Line number within the batch (batch_details.transaction_number_in_batch). */
  transactionNumber: number;
  /** System-wide line number the fund quotes back in its response. */
  systemTransactionNumber: number | null;
  invoiceId: string | null;
  invoiceNumber: string;
  visitId: string | null;
  fundReference: string;
  membershipNumber: string;
  memberSurname: string;
  memberInitials: string;
  patientName: string;
  patientDateOfBirth: string | null;
  patientIdNumber: string;
  /** patients.system_patient_reference_number (written as 7 digits). */
  patientReference: string;
  gender: string;
  tariffCode: string;
  description: string;
  serviceDate: string | null;
  quantity: number;
  /** Line total in N$. */
  amount: number;
  /** Unit price when known, used to check amount = unit x quantity. */
  unitPrice?: number | null;
  practiceNumber: string;
  treatingDoctorHpcnaNumber: string;
  /** The HPCNA number on the treating doctor's staff record, when known. */
  doctorHpcnaNumber?: string | null;
  icd10Primary: string;
  icd10Secondary: string[];
  /** False while the codes are only a suggestion (e.g. read from the visit notes). */
  icd10Confirmed: boolean;
  toothNumbers: string;
  requiresTooth?: boolean | null;
  authorisationNumber?: string | null;
  resubmissionFlag?: string | null;
  extra?: ClaimLineExtra;
}

/** 'male' / 'M' -> 'M', 'female' / 'F' -> 'F', anything else -> ''. */
export function normalizeGender(value: string | null | undefined): 'M' | 'F' | '' {
  const text = (value ?? '').trim().toUpperCase();
  if (text === 'M' || text === 'MALE' || text === 'MAN') return 'M';
  if (text === 'F' || text === 'FEMALE' || text === 'WOMAN') return 'F';
  return '';
}

/** "Elisabeth Martha" -> "EM". */
export function initialsFromNames(names: string | null | undefined): string {
  return (names ?? '')
    .split(/[\s-]+/)
    .map(part => part.replace(/[^\p{L}]/gu, ''))
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}

/** Pads a numeric patient reference to 7 digits ("123" -> "0000123"); other values unchanged. */
export function padPatientReference(value: string | number | null | undefined): string {
  const text = String(value ?? '').trim();
  return /^\d{1,7}$/.test(text) ? text.padStart(7, '0') : text;
}

/** Normalises an HPCNA number for comparison ("mp 1234" -> "MP1234"). */
export function normalizeRegistrationNumber(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, '').toUpperCase();
}
