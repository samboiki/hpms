/**
 * Identity numbers typed at registration.
 *
 * A Namibian ID number is the 11-digit unique identification number (UIN) issued from age 16 under
 * the Identification Act 21 of 1996. It starts with the holder's date of birth as YYMMDD. Nothing
 * public documents the other five digits: there is no published sex digit and no check digit (unlike
 * South Africa's 13-digit number), so only the date of birth is read from it and the sex is always
 * chosen by reception. Passport and foreign ID numbers are accepted as typed, without checks.
 */
import { isValidDateKey } from '../billing/dates';

export type IdNumberKind = 'empty' | 'namibian' | 'other';

export interface IdNumberCheck {
  kind: IdNumberKind;
  /** The number as it is saved: spaces, dashes and slashes removed, letters in capitals */
  normalized: string;
  /** yyyy-MM-dd read from a Namibian ID number, or null */
  dateOfBirth: string | null;
  /** A warning under the field (never blocks saving), or null when there is nothing to say */
  warning: string | null;
}

export const NAMIBIAN_ID_LENGTH = 11;

/** "8901 0112 345" or "89010-112345" -> "89010112345"; "a1234567" -> "A1234567". */
export function normalizeIdNumber(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/[\s\-/.]/g, '').toUpperCase();
}

/**
 * The date of birth in a Namibian ID number. YY is read as 20YY when that date is not after `today`
 * (yyyy-MM-dd), else as 19YY: someone born in 2026 cannot hold a number that says 2027.
 */
export function birthDateFromNamibianId(digits: string, today: string): string | null {
  if (!/^\d{11}$/.test(digits)) return null;
  const yy = digits.slice(0, 2);
  const mmdd = `${digits.slice(2, 4)}-${digits.slice(4, 6)}`;
  const thisCentury = `20${yy}-${mmdd}`;
  if (isValidDateKey(thisCentury) && thisCentury <= today) return thisCentury;
  const lastCentury = `19${yy}-${mmdd}`;
  return isValidDateKey(lastCentury) ? lastCentury : null;
}

/** What the registration form says about the ID number while it is typed. */
export function checkIdNumber(raw: string | null | undefined, today: string): IdNumberCheck {
  const normalized = normalizeIdNumber(raw);
  if (!normalized) return { kind: 'empty', normalized, dateOfBirth: null, warning: null };
  if (!/^\d+$/.test(normalized)) {
    // Letters: a passport or foreign document number
    return { kind: 'other', normalized, dateOfBirth: null, warning: null };
  }
  if (normalized.length !== NAMIBIAN_ID_LENGTH) {
    return {
      kind: 'other',
      normalized,
      dateOfBirth: null,
      warning: `A Namibian ID number has ${NAMIBIAN_ID_LENGTH} digits; this one has ${normalized.length}. Check it, unless it is a passport or foreign ID number.`
    };
  }
  const dateOfBirth = birthDateFromNamibianId(normalized, today);
  if (!dateOfBirth) {
    return {
      kind: 'namibian',
      normalized,
      dateOfBirth: null,
      warning: `A Namibian ID number starts with the date of birth (YYMMDD), but ${normalized.slice(0, 6)} is not a date. Check the number.`
    };
  }
  return { kind: 'namibian', normalized, dateOfBirth, warning: null };
}

/**
 * The date of birth to fill in from a Namibian ID number, or null to leave the field as it is. A date reception chose
 * themselves (anything but blank or the date last filled in from an ID number) is never replaced.
 */
export function birthDateToFill(fromId: string | null, current: string | null | undefined, lastFilledFromId: string | null): string | null {
  if (!fromId || fromId === current) return null;
  return current && current !== lastFilledFromId ? null : fromId;
}

/**
 * A warning when the date of birth entered differs from the one in a Namibian ID number. Both may be
 * right (a corrected birth date), so it only asks reception to check.
 */
export function birthDateMismatch(check: IdNumberCheck, dateOfBirth: string | null | undefined): string | null {
  if (!check.dateOfBirth || !dateOfBirth || !isValidDateKey(dateOfBirth)) return null;
  return check.dateOfBirth === dateOfBirth
    ? null
    : 'The date of birth does not match the ID number. Check both against the ID document.';
}
