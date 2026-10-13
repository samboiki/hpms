/**
 * Medical aid membership details as reception captures them, shaped the way claims need them.
 *
 *   Dependant code   the two digits printed next to each person on the card (00 or 01 is usually the
 *                    main member). A claim names a dependant as "<code> <first name>" (field 11); without
 *                    the code the fund may not find the patient (proposals/2026-10-07-dependant-code.sql).
 *   Main member      a spouse or child is claimed under the main member's surname and initials (fields
 *                    9 and 10). They are stored in medical_aid_details.main_member_name as
 *                    "Surname, J N", the one form the claim builder (splitMemberName) always reads right.
 *   Membership no.   each fund's numbers have a known length (the fund's rule, utils/billing/fundRules.ts,
 *                    learned from accepted claims). A wrong length is only a warning: reception checks it
 *                    against the card, with the fund's own hint when OneHealth support wrote one.
 *   Main member swap when the main member changes (death, divorce, a spouse taking over the membership),
 *                    every family record gets the new main member's name and ID, the new main member
 *                    becomes "self" and the old one takes the relationship reception chooses.
 */
import { isDependantRelationship, splitMemberName } from '../billing/claimLine';
import { getFundRule } from '../billing/fundRules';
import { identifyFund } from '../remittance/funds';

/** The relationship saved for the main member (the registration and edit forms use the same value) */
export const MAIN_MEMBER_RELATIONSHIP = 'self';

/** Relationships a former main member can take after a swap, with their labels */
export const FORMER_MAIN_MEMBER_RELATIONSHIPS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'other', label: 'Other dependant' }
];

/** True for "self", "Main Member", "principal"...: the person who holds the membership. */
export function isMainMemberRelationship(relationship: string | null | undefined): boolean {
  return (relationship ?? '').trim() !== '' && !isDependantRelationship(relationship);
}

export type RelationshipOption = '' | 'self' | 'spouse' | 'child' | 'parent' | 'other';

/**
 * The form option for a saved relationship. Older screens saved "Main Member", "Spouse", "Sibling"...;
 * without this a saved "Child" showed as not recorded in the edit form. '' = not recorded.
 */
export function relationshipOption(relationship: string | null | undefined): RelationshipOption {
  const value = (relationship ?? '').trim().toLowerCase();
  if (!value) return '';
  if (isMainMemberRelationship(value)) return 'self';
  if (value === 'spouse' || value === 'partner' || value === 'wife' || value === 'husband') return 'spouse';
  if (value === 'child' || value === 'son' || value === 'daughter') return 'child';
  if (value === 'parent') return 'parent';
  return 'other';
}

// ---------------------------------------------------------------------------------------------
// Membership number
// ---------------------------------------------------------------------------------------------

export interface FundHints {
  /** medical_aid_providers.medical_aid_reference, e.g. 'NMC1' */
  reference?: string | null;
  shortName?: string | null;
  name?: string | null;
}

/**
 * "NMC membership numbers have 9 digits; this one has 8. Check it against the card." (or the fund's own hint
 * instead of the last sentence), or null when the number looks right, is empty, or the fund's length is not known.
 */
export function membershipNumberHint(fund: FundHints, membershipNumber: string | null | undefined): string | null {
  const typed = (membershipNumber ?? '').replace(/[\s-]/g, '');
  if (!typed) return null;
  const identity = identifyFund(fund.reference, fund.shortName, fund.name);
  const rule = getFundRule(identity?.code ?? fund.reference, fund.name);
  const lengths = rule.membershipDigits;
  if (lengths.length === 0) return null;
  const digits = typed.replace(/\D/g, '');
  if (digits.length === typed.length && lengths.includes(digits.length)) return null;
  const expected = lengths.join(' or ');
  const label = rule.label.replace(/\s*\(.*\)$/, '').trim();
  const shortLabel = /\(([^)]+)\)/.exec(rule.label)?.[1] ?? label;
  const check = rule.membershipHint ?? 'Check it against the card.';
  if (digits.length !== typed.length) {
    return `${shortLabel} membership numbers are ${expected} digits only. ${check}`;
  }
  return `${shortLabel} membership numbers have ${expected} digits; this one has ${digits.length}. ${check}`;
}

// ---------------------------------------------------------------------------------------------
// Dependant code
// ---------------------------------------------------------------------------------------------

/** The database accepts 1 to 3 digits (CHECK in proposals/2026-10-07-dependant-code.sql). */
export const DEPENDANT_CODE_PATTERN = /^[0-9]{1,3}$/;

/**
 * The code as saved: digits only, a single digit written as two ("1" -> "01") because the card and the
 * claim show two ("01 NDAPEWA"). Empty when nothing was typed.
 */
export function normalizeDependantCode(raw: string | null | undefined): string {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits.length === 1 ? `0${digits}` : digits;
}

/** A message when the code cannot be saved, else null. */
export function dependantCodeProblem(raw: string | null | undefined): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if (/[^0-9\s]/.test(text)) return 'Use only the digits printed on the card, for example 01.';
  return DEPENDANT_CODE_PATTERN.test(normalizeDependantCode(text)) ? null : 'A dependant code has at most 3 digits.';
}

// ---------------------------------------------------------------------------------------------
// Main member name
// ---------------------------------------------------------------------------------------------

export interface MainMemberName {
  surname: string;
  /** Capital letters without spaces, e.g. "JN" */
  initials: string;
}

/** "j.n.", "J N" or "jn" -> "JN" */
export function normalizeInitials(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/[^\p{L}]/gu, '').toUpperCase().slice(0, 6);
}

/** Initials of first names: "Johannes Ndapewa" -> "JN". */
export function initialsOf(firstNames: string | null | undefined): string {
  return String(firstNames ?? '')
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase();
}

/** What is saved in main_member_name: "Shilongo, J N" (empty when there is no surname). */
export function composeMainMemberName(name: MainMemberName): string {
  const surname = name.surname.replace(/\s+/g, ' ').replace(/,/g, '').trim();
  if (!surname) return '';
  const initials = normalizeInitials(name.initials).split('').join(' ');
  return initials ? `${surname}, ${initials}` : surname;
}

/**
 * The surname and initials in a saved main_member_name, read the same way the claim builder reads them.
 * The surname is shown as typed when it can be found in the text ("Shilongo", not "SHILONGO").
 */
export function splitMainMemberName(stored: string | null | undefined, likelySurname?: string | null): MainMemberName {
  const parsed = splitMemberName(stored, likelySurname);
  if (!parsed) return { surname: '', initials: '' };
  const asTyped = (stored ?? '').match(new RegExp(parsed.surname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))?.[0];
  return { surname: asTyped ?? parsed.surname, initials: parsed.initials };
}

/** "SHILONGO JN": the member surname and initials as the fund will see them on a claim. */
export function claimMemberPreview(name: MainMemberName): string | null {
  const parsed = splitMemberName(composeMainMemberName(name));
  return parsed ? `${parsed.surname} ${parsed.initials}`.trim() : null;
}

// ---------------------------------------------------------------------------------------------
// Swapping the main member of a family
// ---------------------------------------------------------------------------------------------

export interface FamilyMemberRecord {
  /** medical_aid_details.id */
  medicalAidId: string;
  patientId: string;
  firstName: string | null;
  lastName: string | null;
  idNumber: string | null;
  relationship: string | null;
}

export interface MedicalAidRowUpdate {
  medicalAidId: string;
  changes: {
    relationship_to_main?: string;
    main_member_name?: string;
    main_member_id_number?: string;
  };
}

export type SwapPlan = { ok: true; updates: MedicalAidRowUpdate[]; newMainMemberName: string } | { ok: false; error: string };

/**
 * The updates that make `newMainPatientId` the main member of this family (all the records that share
 * one membership number), in an order where a swap that stopped half-way (a lost connection) is
 * finished by running it again: the new main member stays a dependant until the very last update.
 * The names come first, then the old main member steps down, then the new one becomes "self", so the
 * family never shows two main members.
 */
export function planMainMemberSwap(
  family: readonly FamilyMemberRecord[],
  newMainPatientId: string,
  formerMainRelationship: string
): SwapPlan {
  const newMain = family.find(member => member.patientId === newMainPatientId);
  if (!newMain) return { ok: false, error: 'This person is not on the membership.' };
  if (isMainMemberRelationship(newMain.relationship)) return { ok: false, error: 'This person is already the main member.' };
  if (!FORMER_MAIN_MEMBER_RELATIONSHIPS.some(option => option.value === formerMainRelationship)) {
    return { ok: false, error: 'Choose what the current main member becomes.' };
  }
  const surname = (newMain.lastName ?? '').trim();
  if (!surname) return { ok: false, error: 'The new main member has no surname on file. Add it first.' };
  const newMainMemberName = composeMainMemberName({ surname, initials: initialsOf(newMain.firstName) });
  const newMainIdNumber = (newMain.idNumber ?? '').trim();

  const updates: MedicalAidRowUpdate[] = family.map(member => ({
    medicalAidId: member.medicalAidId,
    changes: { main_member_name: newMainMemberName, main_member_id_number: newMainIdNumber }
  }));
  for (const member of family) {
    if (member.patientId !== newMainPatientId && isMainMemberRelationship(member.relationship)) {
      updates.push({ medicalAidId: member.medicalAidId, changes: { relationship_to_main: formerMainRelationship } });
    }
  }
  updates.push({ medicalAidId: newMain.medicalAidId, changes: { relationship_to_main: MAIN_MEMBER_RELATIONSHIP } });
  return { ok: true, updates, newMainMemberName };
}
