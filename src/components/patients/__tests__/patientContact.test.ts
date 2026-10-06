import { describe, it, expect } from 'vitest';
import {
  normalizePhoneNumber,
  toTelHref,
  formatPhoneForDisplay,
  smsUnavailableReason,
  emailUnavailableReason
} from '../patientContact';

// Staff tap "Call" and "Send link by SMS" on the patient file. A number that is normalised
// wrongly rings a stranger or texts someone else's video-consult link, so anything that is not
// clearly dialable must come back as null (the buttons are then disabled with a reason).
describe('normalizePhoneNumber', () => {
  it('turns the usual Namibian local formats into the same +264 number', () => {
    const expected = '+264811234567';
    expect(normalizePhoneNumber('0811234567')).toBe(expected);
    expect(normalizePhoneNumber('081 123 4567')).toBe(expected);
    expect(normalizePhoneNumber('081-123-4567')).toBe(expected);
    expect(normalizePhoneNumber('(081) 123 4567')).toBe(expected);
    expect(normalizePhoneNumber('811234567')).toBe(expected);
  });

  it('keeps numbers already in international form', () => {
    expect(normalizePhoneNumber('+264811234567')).toBe('+264811234567');
    expect(normalizePhoneNumber('+264 81 123 4567')).toBe('+264811234567');
    expect(normalizePhoneNumber('264811234567')).toBe('+264811234567');
    expect(normalizePhoneNumber('00264811234567')).toBe('+264811234567');
  });

  it('drops the trunk 0 written after the country code, which would not connect', () => {
    expect(normalizePhoneNumber('+264 (0)81 123 4567')).toBe('+264811234567');
    expect(normalizePhoneNumber('+2640811234567')).toBe('+264811234567');
  });

  it('accepts Namibian landlines (8-digit national numbers)', () => {
    expect(normalizePhoneNumber('061 123 456')).toBe('+26461123456');
  });

  it('keeps foreign numbers that carry their own country code', () => {
    expect(normalizePhoneNumber('+27 82 123 4567')).toBe('+27821234567');
  });

  it('uses only the first number when a field holds several', () => {
    expect(normalizePhoneNumber('0811234567 / 0857654321')).toBe('+264811234567');
    expect(normalizePhoneNumber('0811234567, 0857654321')).toBe('+264811234567');
    expect(normalizePhoneNumber('0811234567 or 0857654321')).toBe('+264811234567');
  });

  it('ignores a trailing extension', () => {
    expect(normalizePhoneNumber('061 123 456 ext 12')).toBe('+26461123456');
  });

  it('rejects values that cannot be dialled safely', () => {
    expect(normalizePhoneNumber(undefined)).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber('   ')).toBeNull();
    expect(normalizePhoneNumber('N/A')).toBeNull();
    expect(normalizePhoneNumber('none')).toBeNull();
    expect(normalizePhoneNumber('123')).toBeNull();
    // Ambiguous: 10 digits without a trunk 0 or a country code
    expect(normalizePhoneNumber('8112345678')).toBeNull();
    // +264 with a national number that is too short or too long for Namibia
    expect(normalizePhoneNumber('+2648112345')).toBeNull();
    expect(normalizePhoneNumber('+2648112345678')).toBeNull();
    // Longer than E.164 allows
    expect(normalizePhoneNumber('+1234567890123456')).toBeNull();
  });
});

describe('toTelHref', () => {
  it('builds a tel: link with the international number', () => {
    expect(toTelHref('081 123 4567')).toBe('tel:+264811234567');
  });

  it('returns null when there is no dialable number, so Call can be disabled', () => {
    expect(toTelHref(undefined)).toBeNull();
    expect(toTelHref('unknown')).toBeNull();
  });
});

describe('formatPhoneForDisplay', () => {
  it('groups Namibian numbers the way staff read them', () => {
    expect(formatPhoneForDisplay('+264811234567')).toBe('+264 81 123 4567');
    expect(formatPhoneForDisplay('+26461123456')).toBe('+264 61 123 456');
  });

  it('leaves other numbers unchanged', () => {
    expect(formatPhoneForDisplay('+27821234567')).toBe('+27821234567');
  });
});

// The patient header disables Message and Email and shows these reasons, instead of opening a
// compose window that can only fail (or text a wrong number) when the contact detail is unusable.
describe('smsUnavailableReason', () => {
  it('tells staff to add a cell number when there is none, so Message is not a dead end', () => {
    expect(smsUnavailableReason(undefined)).toBe('No cell number on file. Add one with Edit to send messages.');
    expect(smsUnavailableReason(null)).toBe('No cell number on file. Add one with Edit to send messages.');
    expect(smsUnavailableReason('   ')).toBe('No cell number on file. Add one with Edit to send messages.');
  });

  it('blocks numbers that cannot be dialled, so an SMS never goes to a wrong number', () => {
    expect(smsUnavailableReason('N/A')).toBe(
      'The cell number on file (N/A) is not a valid phone number. Correct it with Edit to send messages.'
    );
    expect(smsUnavailableReason('8112345678')).not.toBeNull();
  });

  it('allows any number the Call button can dial', () => {
    expect(smsUnavailableReason('081 123 4567')).toBeNull();
    expect(smsUnavailableReason('+27 82 123 4567')).toBeNull();
  });
});

describe('emailUnavailableReason', () => {
  it('tells staff to add an email address when there is none', () => {
    expect(emailUnavailableReason(undefined)).toBe('No email address on file. Add one with Edit to send emails.');
    expect(emailUnavailableReason('')).toBe('No email address on file. Add one with Edit to send emails.');
  });

  it('blocks addresses that cannot receive mail, such as placeholders and typos', () => {
    expect(emailUnavailableReason('N/A')).toBe(
      'The email address on file (N/A) is not valid. Correct it with Edit to send emails.'
    );
    expect(emailUnavailableReason('jane.gmail.com')).not.toBeNull();
    expect(emailUnavailableReason('jane@gmail')).not.toBeNull();
  });

  it('allows ordinary addresses, ignoring stray spaces around them', () => {
    expect(emailUnavailableReason('jane.doe@example.com')).toBeNull();
    expect(emailUnavailableReason(' jane@clinic.com.na ')).toBeNull();
  });
});
