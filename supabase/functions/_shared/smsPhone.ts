/**
 * Phone number rules for the SMS edge functions (reply webhook, gateway opt-out check).
 *
 * normalizePhoneNumber is a copy of src/components/patients/patientContact.ts, the rules the
 * patient screens use to dial and text. Edge functions are bundled from supabase/functions only, so
 * they cannot import from src/. The parity test in
 * src/components/communications/__tests__/smsSharedParity.test.ts fails if the copies disagree,
 * so a reply is matched to the same patient file the app would have texted.
 *
 * Pure TypeScript (no Deno APIs): unit tested with Vitest.
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

/**
 * LIKE pattern that finds this number among stored numbers in any format ("081 123 4567",
 * "+264 81 123 4567", "0811234567"): the national digits in order with anything in between.
 * The pattern also matches longer numbers, so every candidate must be confirmed with
 * normalizePhoneNumber. Null when the number is too short to search for safely.
 */
export function storedPhoneSearchPattern(e164: string | null | undefined): string | null {
  const digits = (e164 ?? '').replace(/\D/g, '');
  if (digits.length < MIN_INTERNATIONAL_DIGITS) return null;
  const national = digits.startsWith(DEFAULT_COUNTRY_CODE)
    ? digits.slice(DEFAULT_COUNTRY_CODE.length)
    : digits.slice(-9);
  return `%${national.split('').join('%')}%`;
}
