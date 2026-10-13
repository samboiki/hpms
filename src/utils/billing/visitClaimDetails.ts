/**
 * A visit's claim details (parity F19): who referred the patient, whether the service was given in hospital, the
 * admission and discharge dates and where the service was given. Pure; the database checks the same rules when they
 * are saved (save_visit_claim_details in proposals/2026-10-12-referrals-and-authorisations.sql) and carries them to
 * every claim line of the visit's invoice:
 * - the referring practitioner, their council number and the referral number to claim fields 25, 43 and 44
 *   (referralClaimFields, referrals.ts); a line with its own referral uses that one instead;
 * - "in hospital" to field 30 as "H";
 * - the place of service to field 42: a two-digit PHISC code. The specification's list (37 codes) comes in eight
 *   groups (PLACE_OF_SERVICE_GROUPS); a code outside them is refused, as the fund would refuse the line.
 * The claim layout has no field for the admission and discharge dates: they stay on the visit (statements, letters,
 * the practice's own records) and are checked against each other.
 * Explicit .ts imports: the claim modules use these rules too.
 */
import { formatServiceDate, isValidDateKey } from './dates.ts';
import { parsePracticeNumber } from './practitionerBilling.ts';
import { hasReferralDetails, parseCouncilNumber, parseReferralNumber, type ReferralDetails } from './referrals.ts';

/** The PHISC place-of-service groups (claim field 42), from the specification's code list */
export const PLACE_OF_SERVICE_GROUPS: readonly { from: number; to: number; label: string }[] = [
  { from: 10, to: 14, label: "Practitioner's rooms or a clinic" },
  { from: 20, to: 24, label: "The patient's home" },
  { from: 30, to: 32, label: 'An independent laboratory or radiology practice' },
  { from: 40, to: 46, label: 'Hospital, admitted (also hospice, ambulance, psychiatric or rehabilitation care)' },
  { from: 50, to: 52, label: 'Long-term or nursing care' },
  { from: 60, to: 66, label: 'Hospital out-patients (also birthing, dialysis or chemotherapy)' },
  { from: 70, to: 72, label: 'An emergency room' },
  { from: 80, to: 83, label: 'A day clinic or surgical centre' }
];

/** The group a place-of-service code belongs to, in words; null for a code outside the list */
export function placeOfServiceLabel(code: string | null | undefined): string | null {
  const text = (code ?? '').trim();
  if (!/^\d{2}$/.test(text)) return null;
  const value = Number(text);
  return PLACE_OF_SERVICE_GROUPS.find(group => value >= group.from && value <= group.to)?.label ?? null;
}

/** A place-of-service code as typed: two digits from the list; empty is none */
export function parsePlaceOfService(input: string | null | undefined): { ok: true; value: string | null } | { ok: false; message: string } {
  const text = (input ?? '').replace(/\s+/g, '');
  if (!text) return { ok: true, value: null };
  return placeOfServiceLabel(text)
    ? { ok: true, value: text }
    : { ok: false, message: 'A place of service is a two-digit code from the fund list: 10-14, 20-24, 30-32, 40-46, 50-52, 60-66, 70-72 or 80-83.' };
}

/** A visit's claim details as stored (visit_claim_details) */
export interface VisitClaimDetails extends ReferralDetails {
  /** The register entry the referral details were filled from; null when they were typed */
  referralId: string | null;
  inHospital: boolean;
  /** yyyy-MM-dd */
  admissionDate: string | null;
  dischargeDate: string | null;
  /** Two-digit PHISC code (claim field 42) */
  placeOfService: string | null;
}

export const EMPTY_CLAIM_DETAILS: VisitClaimDetails = {
  referralId: null,
  referringName: null,
  referringPracticeNumber: null,
  referringHpcna: null,
  referralNumber: null,
  inHospital: false,
  admissionDate: null,
  dischargeDate: null,
  placeOfService: null
};

/** What staff type on the visit */
export interface VisitClaimDetailsDraft {
  referralId: string | null;
  referringName: string;
  referringPracticeNumber: string;
  referringHpcna: string;
  referralNumber: string;
  inHospital: boolean;
  admissionDate: string;
  dischargeDate: string;
  placeOfService: string;
}

export type ClaimDetailsField = Exclude<keyof VisitClaimDetailsDraft, 'referralId' | 'inHospital'>;

export const draftOfClaimDetails = (details: VisitClaimDetails | null): VisitClaimDetailsDraft => ({
  referralId: details?.referralId ?? null,
  referringName: details?.referringName ?? '',
  referringPracticeNumber: details?.referringPracticeNumber ?? '',
  referringHpcna: details?.referringHpcna ?? '',
  referralNumber: details?.referralNumber ?? '',
  inHospital: details?.inHospital ?? false,
  admissionDate: details?.admissionDate ?? '',
  dischargeDate: details?.dischargeDate ?? '',
  placeOfService: details?.placeOfService ?? ''
});

/** A draft with the referral's details (picking a referral from the register fills the claim fields) */
export const draftWithReferral = (draft: VisitClaimDetailsDraft, referralId: string, details: ReferralDetails): VisitClaimDetailsDraft => ({
  ...draft,
  referralId,
  referringName: details.referringName ?? '',
  referringPracticeNumber: details.referringPracticeNumber ?? '',
  referringHpcna: details.referringHpcna ?? '',
  referralNumber: details.referralNumber ?? ''
});

/** A draft without any referral */
export const draftWithoutReferral = (draft: VisitClaimDetailsDraft): VisitClaimDetailsDraft => ({
  ...draft,
  referralId: null,
  referringName: '',
  referringPracticeNumber: '',
  referringHpcna: '',
  referralNumber: ''
});

/**
 * Checks a visit's claim details as typed. Hospital dates belong to a hospital stay: they are kept only when "in
 * hospital" is chosen, the discharge cannot come before the admission, and a service dated outside the stay is
 * questioned (a warning: the practitioner may see the patient before admission).
 */
export function validateClaimDetailsDraft(
  draft: VisitClaimDetailsDraft,
  visitDate: string | null
): { ok: true; value: VisitClaimDetails; warnings: string[] } | { ok: false; errors: Partial<Record<ClaimDetailsField, string>> } {
  const errors: Partial<Record<ClaimDetailsField, string>> = {};
  const name = draft.referringName.replace(/\s+/g, ' ').trim();
  if (name.length > 100) errors.referringName = 'Keep the name to 100 characters.';
  const practiceNumber = parsePracticeNumber(draft.referringPracticeNumber);
  if (!practiceNumber.ok) errors.referringPracticeNumber = practiceNumber.message;
  const council = parseCouncilNumber(draft.referringHpcna);
  if (!council.ok) errors.referringHpcna = council.message;
  const number = parseReferralNumber(draft.referralNumber);
  if (!number.ok) errors.referralNumber = number.message;
  const place = parsePlaceOfService(draft.placeOfService);
  if (!place.ok) errors.placeOfService = place.message;

  const admission = draft.inHospital ? draft.admissionDate.trim() : '';
  const discharge = draft.inHospital ? draft.dischargeDate.trim() : '';
  if (admission && !isValidDateKey(admission)) errors.admissionDate = 'Choose a valid admission date.';
  if (discharge && !isValidDateKey(discharge)) errors.dischargeDate = 'Choose a valid discharge date.';
  else if (discharge && !admission) errors.dischargeDate = 'Choose the admission date first.';
  else if (discharge && isValidDateKey(admission) && discharge < admission) errors.dischargeDate = 'The discharge cannot be before the admission.';

  if (Object.keys(errors).length > 0 || !practiceNumber.ok || !council.ok || !number.ok || !place.ok) return { ok: false, errors };

  const value: VisitClaimDetails = {
    referralId: draft.referralId,
    referringName: name || null,
    referringPracticeNumber: practiceNumber.value,
    referringHpcna: council.value,
    referralNumber: number.value,
    inHospital: draft.inHospital,
    admissionDate: admission || null,
    dischargeDate: discharge || null,
    placeOfService: place.value
  };
  const warnings: string[] = [];
  if (visitDate && value.admissionDate && visitDate < value.admissionDate) {
    warnings.push(`The visit (${formatServiceDate(visitDate)}) is before the admission on ${formatServiceDate(value.admissionDate)}.`);
  }
  if (visitDate && value.dischargeDate && visitDate > value.dischargeDate) {
    warnings.push(`The visit (${formatServiceDate(visitDate)}) is after the discharge on ${formatServiceDate(value.dischargeDate)}.`);
  }
  if (hasReferralDetails(value) && !value.referringName && !value.referringPracticeNumber) {
    warnings.push("The fund needs the referring practitioner's name or practice number.");
  }
  return { ok: true, value, warnings };
}

/** True when the details say nothing (the visit then has no row) */
export const isEmptyClaimDetails = (details: VisitClaimDetails | null | undefined): boolean =>
  !details || (!hasReferralDetails(details) && !details.inHospital && !details.placeOfService);

/** The details in one line, for the closed card: "Referred by Dr A Shikongo · in hospital 3 Oct to 5 Oct 2026 · place 41" */
export function describeClaimDetails(details: VisitClaimDetails | null | undefined): string {
  if (isEmptyClaimDetails(details) || !details) return '';
  const referrer = details.referringName || details.referringPracticeNumber;
  const stay = details.inHospital
    ? details.admissionDate
      ? `in hospital from ${formatServiceDate(details.admissionDate)}${details.dischargeDate ? ` to ${formatServiceDate(details.dischargeDate)}` : ''}`
      : 'in hospital'
    : null;
  return [
    referrer ? `Referred by ${referrer}${details.referralNumber ? ` (referral ${details.referralNumber})` : ''}` : null,
    stay,
    details.placeOfService ? `place of service ${details.placeOfService}` : null
  ].filter(Boolean).join(' · ');
}

/** What the claim lines carry for these details: field 30 and field 42 (the referral fields: referralClaimFields) */
export function claimDetailFields(details: VisitClaimDetails | null | undefined): { hospitalIndicator: string; placeOfService: string } {
  return { hospitalIndicator: details?.inHospital ? 'H' : '', placeOfService: details?.placeOfService ?? '' };
}
