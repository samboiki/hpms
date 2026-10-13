/**
 * Incoming referrals (parity C10, F19): the register of referral letters a patient brings from another practitioner,
 * and how a referral reaches a claim. Pure (no database), so the rules are tested directly; the database checks the
 * same rules again when a referral is saved (save_patient_referral in
 * proposals/2026-10-12-referrals-and-authorisations.sql).
 *
 * - A referral names the referring practitioner (required) and may give their practice number (7 to 15 digits, the
 *   claim checks' rule: parsePracticeNumber), their HPCNA council number, the referral number the fund knows it by,
 *   the date of the letter, the last day it is valid and why the patient was referred.
 * - On a claim (claim layout 1.1): field 25 holds the referring practitioner's practice number, or their name when the
 *   number is not known; field 43 their council number; field 44 the referral number; 15 characters each
 *   (CLAIM_FIELD_MAX). sync_invoice_to_batch fills the claim line the same way (referralClaimFields).
 *   Why the number first: the Medical Aid Funds Regulations, 1997, regulation 6(1)(i), require the account to show
 *   "the name and the practice number of the referring medical practitioner or dentist" (checked 13 Oct 2026,
 *   https://www.lac.org.na/laws/annoREG/Medical%20Aid%20Funds%20Act%2023%20of%201995-Regulations%201997-012.docx); the
 *   15-character field takes one, and the number identifies the practitioner. The printed invoice does not show the
 *   referring practitioner yet (an open item in the wave-11 claims-standards note).
 * - A referral counts from its date until its last day; without a last day it stays valid until it is removed.
 * Explicit .ts imports: the claim modules use these rules too.
 */
import { CLAIM_FIELD_MAX, normalizeRegistrationNumber } from './claimLine.ts';
import { formatServiceDate, isValidDateKey } from './dates.ts';
import { parsePracticeNumber } from './practitionerBilling.ts';

export const MAX_REFERRING_NAME_LENGTH = 100;
export const MAX_REFERRAL_REASON_LENGTH = 500;
/** Claim field 44 holds 15 characters: the referral number is kept to that */
export const MAX_REFERRAL_NUMBER_LENGTH = CLAIM_FIELD_MAX.trackingNumber;
/** Claim field 43 holds 15 characters */
export const MAX_COUNCIL_NUMBER_LENGTH = CLAIM_FIELD_MAX.referringCouncilNumber;

/** Who referred the patient, as a claim carries it */
export interface ReferralDetails {
  referringName: string | null;
  referringPracticeNumber: string | null;
  referringHpcna: string | null;
  referralNumber: string | null;
}

/** A referral in the patient's register */
export interface PatientReferral extends ReferralDetails {
  id: string;
  patientId: string;
  referringName: string;
  /** yyyy-MM-dd: the date of the letter */
  referralDate: string;
  /** yyyy-MM-dd: the last day it is valid; null: no end date */
  validUntil: string | null;
  reason: string | null;
  /** The letter in the private records bucket (recordFiles.ts), when one was added */
  letterPath: string | null;
  letterName: string | null;
  removedAt: string | null;
  createdAt: string | null;
}

/** What staff type for a referral */
export interface ReferralDraft {
  referringName: string;
  referringPracticeNumber: string;
  referringHpcna: string;
  referralNumber: string;
  referralDate: string;
  validUntil: string;
  reason: string;
}

export type ReferralField = keyof ReferralDraft;

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

export const emptyReferralDraft = (today: string): ReferralDraft => ({
  referringName: '',
  referringPracticeNumber: '',
  referringHpcna: '',
  referralNumber: '',
  referralDate: today,
  validUntil: '',
  reason: ''
});

/** A referral as the form shows it, to change it */
export const draftOfReferral = (referral: PatientReferral): ReferralDraft => ({
  referringName: referral.referringName,
  referringPracticeNumber: referral.referringPracticeNumber ?? '',
  referringHpcna: referral.referringHpcna ?? '',
  referralNumber: referral.referralNumber ?? '',
  referralDate: referral.referralDate,
  validUntil: referral.validUntil ?? '',
  reason: referral.reason ?? ''
});

/** An HPCNA council number as typed ("mp 12345" is MP12345); empty is none */
export function parseCouncilNumber(input: string | null | undefined): Parsed<string | null> {
  const value = normalizeRegistrationNumber(input);
  if (!value) return { ok: true, value: null };
  return /^[A-Z0-9]{2,15}$/.test(value) && value.length <= MAX_COUNCIL_NUMBER_LENGTH
    ? { ok: true, value }
    : { ok: false, message: `An HPCNA number has letters and digits only, at most ${MAX_COUNCIL_NUMBER_LENGTH} (for example MP12345).` };
}

/** A referral number as the fund knows it: 1 to 15 letters, digits, "/", "." or "-"; empty is none */
export function parseReferralNumber(input: string | null | undefined): Parsed<string | null> {
  const value = (input ?? '').trim();
  if (!value) return { ok: true, value: null };
  return new RegExp(`^[A-Za-z0-9/.-]{1,${MAX_REFERRAL_NUMBER_LENGTH}}$`).test(value)
    ? { ok: true, value }
    : { ok: false, message: `A referral number has at most ${MAX_REFERRAL_NUMBER_LENGTH} letters or digits (no spaces or commas).` };
}

/** The referring practitioner's name: needed, at most 100 characters, spaces tidied */
export function parseReferringName(input: string | null | undefined): Parsed<string> {
  const value = (input ?? '').replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, message: 'Say who referred the patient.' };
  if (value.length > MAX_REFERRING_NAME_LENGTH) return { ok: false, message: `Keep the name to ${MAX_REFERRING_NAME_LENGTH} characters.` };
  return { ok: true, value };
}

export interface ReferralValues {
  referringName: string;
  referringPracticeNumber: string | null;
  referringHpcna: string | null;
  referralNumber: string | null;
  referralDate: string;
  validUntil: string | null;
  reason: string | null;
}

/**
 * Checks a referral as typed. The letter's date is needed and cannot be in the future (a referral the patient brings
 * was written already); the last day cannot be before the letter's date.
 */
export function validateReferralDraft(
  draft: ReferralDraft,
  today: string
): { ok: true; value: ReferralValues } | { ok: false; errors: Partial<Record<ReferralField, string>> } {
  const errors: Partial<Record<ReferralField, string>> = {};
  const name = parseReferringName(draft.referringName);
  if (!name.ok) errors.referringName = name.message;
  const practiceNumber = parsePracticeNumber(draft.referringPracticeNumber);
  if (!practiceNumber.ok) errors.referringPracticeNumber = practiceNumber.message;
  const council = parseCouncilNumber(draft.referringHpcna);
  if (!council.ok) errors.referringHpcna = council.message;
  const number = parseReferralNumber(draft.referralNumber);
  if (!number.ok) errors.referralNumber = number.message;

  const date = draft.referralDate.trim();
  if (!isValidDateKey(date)) errors.referralDate = 'Choose the date of the referral letter.';
  else if (date > today) errors.referralDate = 'The referral letter cannot be dated in the future.';
  const until = draft.validUntil.trim();
  if (until && !isValidDateKey(until)) errors.validUntil = 'Choose a valid date, or leave it empty for no end date.';
  else if (until && isValidDateKey(date) && until < date) errors.validUntil = 'The last day cannot be before the date of the letter.';

  const reason = draft.reason.trim();
  if (reason.length > MAX_REFERRAL_REASON_LENGTH) errors.reason = `Keep the reason to ${MAX_REFERRAL_REASON_LENGTH} characters.`;

  if (Object.keys(errors).length > 0 || !name.ok || !practiceNumber.ok || !council.ok || !number.ok) return { ok: false, errors };
  return {
    ok: true,
    value: {
      referringName: name.value,
      referringPracticeNumber: practiceNumber.value,
      referringHpcna: council.value,
      referralNumber: number.value,
      referralDate: date,
      validUntil: until || null,
      reason: reason || null
    }
  };
}

export type ReferralState = 'valid' | 'not_yet' | 'expired' | 'removed';

/** Where a referral stands on a day: removed, not yet written, past its last day, or valid */
export function referralState(referral: Pick<PatientReferral, 'referralDate' | 'validUntil' | 'removedAt'>, onDate: string): ReferralState {
  if (referral.removedAt) return 'removed';
  if (onDate < referral.referralDate) return 'not_yet';
  if (referral.validUntil && onDate > referral.validUntil) return 'expired';
  return 'valid';
}

/** How long a referral is valid, in words: "Valid until 7 Nov 2026", "Expired on 3 Oct 2026", "No end date" */
export function describeReferralValidity(referral: Pick<PatientReferral, 'referralDate' | 'validUntil' | 'removedAt'>, today: string): string {
  switch (referralState(referral, today)) {
    case 'removed':
      return 'Removed';
    case 'expired':
      return `Expired on ${formatServiceDate(referral.validUntil)}`;
    case 'not_yet':
      return `Dated ${formatServiceDate(referral.referralDate)}`;
    default:
      return referral.validUntil ? `Valid until ${formatServiceDate(referral.validUntil)}` : 'No end date';
  }
}

/** The referring practitioner in one line: "Dr A Shikongo · practice 0123456 · HPCNA MP12345" */
export function describeReferrer(details: Partial<ReferralDetails>): string {
  return [
    details.referringName?.trim() || null,
    details.referringPracticeNumber ? `practice ${details.referringPracticeNumber}` : null,
    details.referringHpcna ? `HPCNA ${details.referringHpcna}` : null
  ].filter(Boolean).join(' · ');
}

/** What a claim carries for a referral: fields 25 (practice number, else name), 43 (council number) and 44 (referral number) */
export interface ReferralClaimFields {
  referringDoctor: string;
  referringCouncilNumber: string;
  referralNumber: string;
}

const claimText = (value: string | null | undefined, max: number): string =>
  (value ?? '').replace(/[\s,"]+/g, ' ').trim().toUpperCase().slice(0, max).trim();

/**
 * A referral as the claim line carries it. The fund matches the referring practitioner by practice number, so field 25
 * holds the number when it is known and the name only otherwise (in capitals, 15 characters).
 */
export function referralClaimFields(details: Partial<ReferralDetails> | null | undefined): ReferralClaimFields {
  const practiceNumber = (details?.referringPracticeNumber ?? '').replace(/\s+/g, '');
  return {
    referringDoctor: claimText(practiceNumber || details?.referringName, CLAIM_FIELD_MAX.referringDoctor),
    referringCouncilNumber: claimText(details?.referringHpcna, CLAIM_FIELD_MAX.referringCouncilNumber).replace(/ /g, ''),
    referralNumber: claimText(details?.referralNumber, CLAIM_FIELD_MAX.trackingNumber).replace(/ /g, '')
  };
}

/** True when a claim would carry any referral detail */
export const hasReferralDetails = (details: Partial<ReferralDetails> | null | undefined): boolean =>
  Boolean(details?.referringName?.trim() || details?.referringPracticeNumber?.trim() || details?.referringHpcna?.trim() || details?.referralNumber?.trim());

/** The referral's details to fill a visit's or a line's claim fields with */
export const referralDetailsOf = (referral: PatientReferral): ReferralDetails => ({
  referringName: referral.referringName,
  referringPracticeNumber: referral.referringPracticeNumber,
  referringHpcna: referral.referringHpcna,
  referralNumber: referral.referralNumber
});

/**
 * The referrals to pick from for a visit or a line on `onDate`: removed ones left out, those valid on the day first,
 * newest letter first; referrals that expired or were written later follow, flagged so the picker can say so.
 */
export function referralsToPick(referrals: readonly PatientReferral[], onDate: string): Array<{ referral: PatientReferral; state: ReferralState }> {
  return referrals
    .filter(referral => !referral.removedAt)
    .map(referral => ({ referral, state: referralState(referral, onDate) }))
    .sort((a, b) => Number(a.state !== 'valid') - Number(b.state !== 'valid') || b.referral.referralDate.localeCompare(a.referral.referralDate));
}
