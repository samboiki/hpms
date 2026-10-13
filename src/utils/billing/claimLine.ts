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
  /** The line's code is one the practice charges by time (its code rules): the fund needs the minutes it took. */
  chargedByTime?: boolean;
  /**
   * How long it took, in whole minutes, from the line's note (serviceTime.ts), on a line charged by time: claim field 18
   * carries them instead of the quantity (claim specification). null or absent: field 18 is the quantity.
   */
  timeMinutes?: number | null;
  /** Line total in N$. */
  amount: number;
  /** Unit price when known, used to check amount = unit x quantity. */
  unitPrice?: number | null;
  /** The practice number the line bills under (field 29): the practice's, or a partner's own (practitionerBilling.ts). */
  practiceNumber: string;
  treatingDoctorHpcnaNumber: string;
  /** The HPCNA number on the treating doctor's staff record, when known. */
  doctorHpcnaNumber?: string | null;
  /** The treating practitioner's name, when their staff record is known (claim review, messages). */
  treatingPractitionerName?: string | null;
  /** The treating practitioner's own practice number, when they bill under it (practitioner_billing). */
  practitionerPracticeNumber?: string | null;
  icd10Primary: string;
  icd10Secondary: string[];
  /** False while the codes are only a suggestion (e.g. read from the visit notes). */
  icd10Confirmed: boolean;
  toothNumbers: string;
  requiresTooth?: boolean | null;
  /** Surfaces of the line's one tooth ("MO") and the quadrant (1-4), as the invoice line recorded them (dental). */
  toothSurfaces?: string | null;
  toothQuadrant?: number | null;
  authorisationNumber?: string | null;
  resubmissionFlag?: string | null;
  /** The patient's relationship to the main member on the medical aid record ('self', 'spouse', 'child'). */
  relationshipToMainMember?: string | null;
  /** Where the member surname and initials came from: the main member's name on the medical aid record, or the batch line. */
  memberNameSource?: 'main-member' | 'batch';
  /** Set when the patient's file is marked "Do not claim" (account_flags): the practice decided not to claim for them. */
  doNotClaim?: DoNotClaimFlag | null;
  extra?: ClaimLineExtra;
  /** A dental 8099 line: the lab's invoice lines, written straight after it as type L records (src/utils/dental/labSlips.ts) */
  labDetails?: readonly ClaimLabDetail[];
  /** A dental 8099 line: the lab's invoice (slip) number, field 24 of its L records */
  labSlipNumber?: string | null;
}

/** One line of a dental lab's invoice under an 8099 line: the lab's item code when it gave one, what it is, N$. */
export interface ClaimLabDetail {
  code: string | null;
  description: string;
  amount: number;
}

/** A "Do not claim" flag in force on a patient's file: when it was set and the reason given. */
export interface DoNotClaimFlag {
  since: string;
  reason: string;
}

/**
 * Patients brought over without an ID number get a placeholder ("NOID-" and 12 characters; proposals/
 * 2026-10-07-eminance-import.sql) because patients.id_number must be filled in and unique. A fund must never
 * receive it: the claim sends no ID number instead, which the claim check reports as missing.
 */
/**
 * The practitioner a claim line is claimed under: the invoice line's own, else the invoice's treating practitioner. The
 * database builds every claim line by the same rule (claim_invoice_into_batch) and corrects a sent line from the same
 * practitioner (claim_line_correct); the claim file (buildClaimLines) and "Correct and send again" use this one, and
 * claims/__tests__/claimPractitioner.test.ts fails if the database's rule and this one ever disagree.
 */
export const claimedPractitionerOf = (linePractitionerId: string | null | undefined, invoicePractitionerId: string | null | undefined): string | null =>
  linePractitionerId || invoicePractitionerId || null;

export const PLACEHOLDER_ID_PREFIX = 'NOID-';

/** The ID number a claim may carry: the number as recorded, or '' for an import placeholder. */
export function claimIdNumber(value: string | null | undefined): string {
  const text = (value ?? '').trim();
  return text.toUpperCase().startsWith(PLACEHOLDER_ID_PREFIX) ? '' : text;
}

/**
 * Medicines on a claim (QEDI claim specification, page 7): field 5 (type of service) is M for an acute medicine, R for a
 * repeat script and D for a chronic medicine, field 13 holds "GMED" instead of a tariff code, and field 26 the NAPPI
 * code. Materials keep a tariff code (usually 0201) with their NAPPI code and type T.
 */
export const MEDICINE_SERVICE_TYPES: readonly string[] = ['M', 'R', 'D'];
export const MEDICINE_TARIFF_CODE = 'GMED';

/** True for a medicine line (type of service M, R or D). */
export function isMedicineLine(line: Pick<ClaimLine, 'extra'>): boolean {
  return MEDICINE_SERVICE_TYPES.includes((line.extra?.typeOfService ?? '').trim().toUpperCase());
}

/** True when the medical aid record says the patient is not the main member (spouse, child, other dependant). */
export function isDependantRelationship(relationship: string | null | undefined): boolean {
  const value = (relationship ?? '').trim().toLowerCase();
  return value !== '' && value !== 'self' && value !== 'principal' && value !== 'member' && !value.includes('main');
}

export interface MemberName {
  surname: string;
  initials: string;
}

const NAME_TITLES = new Set(['MR', 'MRS', 'MS', 'MISS', 'DR', 'PROF', 'REV', 'MNR', 'MEV', 'MEJ']);
const SURNAME_PARTICLES = new Set(['VAN', 'VON', 'DER', 'DEN', 'DE', 'DU', 'LE', 'LA', 'TER', 'TEN', 'DA', 'DOS', 'DAS']);

/**
 * Splits the main member's name as typed at reception into surname and initials (fields 9 and 10):
 * "Johannes Ndapewa Shilongo" -> SHILONGO / JN, "SHILONGO, Johannes" -> SHILONGO / J, "SHILONGO J N" -> SHILONGO / JN,
 * "Mr Pieter van der Merwe" -> VAN DER MERWE / P. When a word of the name equals `likelySurname` (a child usually
 * shares the main member's surname), that word is the surname. Null when there is no name.
 */
export function splitMemberName(name: string | null | undefined, likelySurname?: string | null): MemberName | null {
  const cleaned = (name ?? '').replace(/[^\p{L}\s,'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  const words = (part: string) => part.split(' ').filter(word => word && !NAME_TITLES.has(word.toUpperCase()));
  const initialsOf = (parts: string[]) => parts.map(part => part.charAt(0)).join('').toUpperCase();

  if (cleaned.includes(',')) {
    const [surnamePart, firstPart = ''] = cleaned.split(',');
    const surname = words(surnamePart).join(' ');
    return surname ? { surname: surname.toUpperCase(), initials: initialsOf(words(firstPart)) } : null;
  }

  const parts = words(cleaned);
  if (parts.length === 0) return null;
  const known = (likelySurname ?? '').trim().toUpperCase();
  let end = known ? parts.findIndex(part => part.toUpperCase() === known) : -1; // last word of the surname
  if (end < 0) {
    // "SHILONGO J N": the surname followed by initials only
    if (parts.length > 1 && parts.slice(1).every(part => part.length === 1)) {
      return { surname: parts[0].toUpperCase(), initials: parts.slice(1).join('').toUpperCase() };
    }
    end = parts.length - 1;
  }
  let start = end;
  while (start > 0 && SURNAME_PARTICLES.has(parts[start - 1].toUpperCase())) start -= 1;
  return {
    surname: parts.slice(start, end + 1).join(' ').toUpperCase(),
    initials: initialsOf([...parts.slice(0, start), ...parts.slice(end + 1)])
  };
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

/** Longest values the claim layout takes (Methealth/QEDI specification; checked against the practice's accepted files). */
export const CLAIM_FIELD_MAX = {
  memberSurname: 20,
  memberInitials: 4,
  patientName: 20,
  invoiceReference: 8,
  teeth: 8,
  diagnosisCodes: 5,
  diagnosisField: 64,
  readingAdditions: 12,
  lensPrescription: 34,
  densityOfTint: 6,
  /** Field 25: the referring practitioner's practice number, else their name (src/utils/billing/referrals.ts) */
  referringDoctor: 15,
  /** Field 30: "H" when the service was given in hospital */
  hospitalIndicator: 1,
  /** Field 42: the PHISC place-of-service code (src/utils/billing/visitClaimDetails.ts) */
  placeOfService: 2,
  /** Field 43: the referring practitioner's council (HPCNA) number */
  referringCouncilNumber: 15,
  /** Field 44: the referral (tracking) number */
  trackingNumber: 15
} as const;

/**
 * Claim fields 45-47 (optometry) in the specification's own format (Layout 1.1, sections 33-35), written without
 * spaces: reading additions per eye "R3.00L3.75"; the lens prescription per eye with its signs, sphere, cylinder and
 * axis "R+00.00-00.00X000L+00.00-00.00X000", or the word PLANO; the density of tint per eye "R35L35". The optometry
 * module writes these (src/utils/optometry/claimFields.ts and the database's optometry_claim_fields()).
 */
export const OPTOMETRY_CLAIM_PATTERNS = {
  readingAdditions: /^(?=.)(R\d{1,2}\.\d{2})?(L\d{1,2}\.\d{2})?$/,
  lensPrescription: /^(PLANO|(?=.)(R[+-]\d{2}\.\d{2}[+-]\d{2}\.\d{2}X\d{3})?(L[+-]\d{2}\.\d{2}[+-]\d{2}\.\d{2}X\d{3})?)$/,
  densityOfTint: /^(?=.)(R\d{1,2})?(L\d{1,2})?$/
} as const;

export type OptometryClaimField = keyof typeof OPTOMETRY_CLAIM_PATTERNS;

/**
 * The invoice number as the fund receives it in field 24, which holds at most 8 characters and is quoted
 * back on the fund's reports: up to 8 digits are sent as they are, longer numbers keep their last 8 digits
 * ("INV-2026-000123" -> "26000123"). Remittance matching must use this same function.
 */
export function claimInvoiceReference(invoiceNumber: string | null | undefined): string {
  const text = String(invoiceNumber ?? '').trim();
  const digits = text.replace(/\D/g, '');
  if (!digits) return text.slice(0, CLAIM_FIELD_MAX.invoiceReference);
  return digits.slice(-CLAIM_FIELD_MAX.invoiceReference);
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
