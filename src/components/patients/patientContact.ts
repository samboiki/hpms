/**
 * Phone and email helpers for calling, messaging and emailing patients.
 *
 * Numbers are captured in many shapes ("081 123 4567", "+264 (0)81 123 4567", "264811234567",
 * "00264...", "0811234567 / 0851234567"). Calling or texting needs one canonical international
 * form (E.164, e.g. +264811234567). Local numbers default to Namibia (+264). When a value cannot be
 * a dialable number we return null, so callers disable Call/SMS instead of dialling a wrong number.
 */

export const DEFAULT_COUNTRY_CODE = '264';

// E.164 allows at most 15 digits; anything under 8 cannot be a complete international number.
const MIN_INTERNATIONAL_DIGITS = 8;
const MAX_INTERNATIONAL_DIGITS = 15;
// Namibian national significant numbers are 8 (some landlines) or 9 digits (mobile, e.g. 81 123 4567).
const NAMIBIA_NSN_LENGTHS = [8, 9];

/** Normalise a stored phone number to E.164 ("+264811234567"), or null when it is not dialable. */
export function normalizePhoneNumber(
  raw: string | null | undefined,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE
): string | null {
  if (!raw) return null;

  // Several numbers in one field ("081 123 4567 / 085 765 4321"): use the first one
  const firstNumber = raw.split(/[,;/|]|\bor\b/i)[0] ?? '';
  // Drop a trailing extension ("ext 12", "x12")
  const candidate = firstNumber.replace(/\s*(?:ext\.?|x)\s*\d+\s*$/i, '').trim();
  if (!candidate) return null;

  const digits = candidate.replace(/\D/g, '');
  if (!digits) return null;

  let international: string;
  if (candidate.startsWith('+')) {
    international = digits;
  } else if (digits.startsWith('00')) {
    international = digits.slice(2);
  } else if (digits.startsWith(defaultCountryCode) && digits.length > defaultCountryCode.length + 7) {
    // Country code typed without "+" (e.g. 264811234567)
    international = digits;
  } else if (digits.startsWith('0')) {
    // National format with trunk prefix (e.g. 0811234567)
    international = defaultCountryCode + digits.slice(1);
  } else if (digits.length === 8 || digits.length === 9) {
    // National number without the trunk 0 (e.g. 811234567)
    international = defaultCountryCode + digits;
  } else {
    return null;
  }

  // "+264 (0)81 ..." keeps the trunk 0 after the country code; it must not be dialled
  if (international.startsWith(`${defaultCountryCode}0`)) {
    international = defaultCountryCode + international.slice(defaultCountryCode.length + 1);
  }

  if (international.length < MIN_INTERNATIONAL_DIGITS || international.length > MAX_INTERNATIONAL_DIGITS) {
    return null;
  }
  if (international.startsWith('0')) return null; // a country code never starts with 0
  if (
    international.startsWith(DEFAULT_COUNTRY_CODE) &&
    !NAMIBIA_NSN_LENGTHS.includes(international.length - DEFAULT_COUNTRY_CODE.length)
  ) {
    return null;
  }

  return `+${international}`;
}

/** tel: link for a stored phone number, or null when it cannot be dialled. */
export function toTelHref(raw: string | null | undefined): string | null {
  const normalized = normalizePhoneNumber(raw);
  return normalized ? `tel:${normalized}` : null;
}

/** Readable form of a normalised number: "+264 81 123 4567" for Namibia, unchanged otherwise. */
export function formatPhoneForDisplay(e164: string): string {
  const prefix = `+${DEFAULT_COUNTRY_CODE}`;
  if (!e164.startsWith(prefix)) return e164;
  const nsn = e164.slice(prefix.length);
  if (!NAMIBIA_NSN_LENGTHS.includes(nsn.length)) return e164;
  // Area/network code, then the subscriber number in two groups: 81 123 4567, 61 123 456
  return `${prefix} ${nsn.slice(0, 2)} ${nsn.slice(2, 5)} ${nsn.slice(5)}`;
}

/**
 * Why an SMS cannot be sent to this cell number, or null when it can. The patient header shows it
 * on the disabled Message button (same wording as the disabled Call button).
 */
export function smsUnavailableReason(cellNumber: string | null | undefined): string | null {
  const stored = cellNumber?.trim();
  if (!stored) return 'No cell number on file. Add one with Edit to send messages.';
  if (!normalizePhoneNumber(stored)) {
    return `The cell number on file (${stored}) is not a valid phone number. Correct it with Edit to send messages.`;
  }
  return null;
}

// Something@something.something: enough to catch blanks, typos like "jane.gmail.com" and "N/A"
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Why an email cannot be sent to this address, or null when it can (for the disabled Email button). */
export function emailUnavailableReason(email: string | null | undefined): string | null {
  const stored = email?.trim();
  if (!stored) return 'No email address on file. Add one with Edit to send emails.';
  if (!EMAIL_PATTERN.test(stored)) {
    return `The email address on file (${stored}) is not valid. Correct it with Edit to send emails.`;
  }
  return null;
}
