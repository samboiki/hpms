import { describe, expect, it } from 'vitest';
import {
  DEFAULT_OTP_LIMITS,
  decideOtpSend,
  hookPhoneToE164,
  isOtpCode,
  latestVisitDates,
  maskPhone,
  otpCapRefusal,
  otpLimitsFromEnv,
  otpSmsText,
  recordToCharge,
  type OtpPatientRecord,
  type OtpSendCounts,
} from '../../../supabase/functions/_shared/authOtpPolicy.ts';
import {
  AUTH_OTP_MESSAGE_TYPE,
  isEssentialSmsType,
  maySendToOptedOutPatient,
  smsContentForLog,
} from '../../../supabase/functions/_shared/smsMessagePolicy.ts';

const NONE: OtpSendCounts = { numberLastHour: 0, numberLastDay: 0, sentAllNumbersLastHour: 0 };

const record = (overrides: Partial<OtpPatientRecord> = {}): OtpPatientRecord => ({
  patientId: 'pat-1',
  practiceId: 'practice-1',
  cellNumber: '081 123 4567',
  createdAt: '2025-01-01T00:00:00Z',
  lastVisitDate: null,
  ...overrides,
});

describe('who gets a sign-in code by SMS', () => {
  it('reads the number as Supabase Auth sends it (digits without "+")', () => {
    expect(hookPhoneToE164('264811234567')).toBe('+264811234567');
    expect(hookPhoneToE164('+264811234567')).toBe('+264811234567');
    expect(hookPhoneToE164('')).toBeNull();
    expect(hookPhoneToE164('not a number')).toBeNull();
  });

  it('a number on a patient file gets a code, charged to that practice', () => {
    expect(decideOtpSend({ rawPhone: '264811234567', records: [record()], counts: NONE })).toEqual({
      action: 'send',
      phoneE164: '+264811234567',
      practiceId: 'practice-1',
      patientId: 'pat-1',
    });
  });

  it('a number on no patient file gets no SMS, and the same answer as if one was sent', () => {
    // Otherwise the sign-in screen would tell anyone which numbers belong to patients
    const decision = decideOtpSend({ rawPhone: '264851112222', records: [], counts: NONE });
    expect(decision).toEqual({ action: 'skip', outcome: 'no_patient', phoneE164: '+264851112222' });
  });

  it('only an exact match counts: the database search also finds longer numbers', () => {
    const longer = record({ cellNumber: '+264 81 123 45678' });
    expect(decideOtpSend({ rawPhone: '264811234567', records: [longer], counts: NONE }).action).toBe('skip');
  });

  it('a record without a practice cannot be charged, so no SMS is sent', () => {
    expect(decideOtpSend({ rawPhone: '264811234567', records: [record({ practiceId: null })], counts: NONE }).action).toBe('skip');
  });

  it('caps count every request, patient or not, so reaching one reveals nothing', () => {
    const atHourlyCap = { ...NONE, numberLastHour: DEFAULT_OTP_LIMITS.perNumberPerHour };
    const patient = decideOtpSend({ rawPhone: '264811234567', records: [record()], counts: atHourlyCap });
    const stranger = decideOtpSend({ rawPhone: '264811234567', records: [], counts: atHourlyCap });
    expect(patient).toEqual(stranger);
    expect(patient).toMatchObject({ action: 'refuse', httpStatus: 429 });

    const atDailyCap = { ...NONE, numberLastDay: DEFAULT_OTP_LIMITS.perNumberPerDay };
    expect(decideOtpSend({ rawPhone: '264811234567', records: [record()], counts: atDailyCap }).action).toBe('refuse');
  });

  it('a platform-wide hourly cap bounds what an attack on many patient numbers can cost', () => {
    const busy = { ...NONE, sentAllNumbersLastHour: DEFAULT_OTP_LIMITS.sentPerHourAllNumbers };
    expect(otpCapRefusal('+264811234567', busy)?.message).toMatch(/paused/);
    expect(otpCapRefusal('+264811234567', NONE)).toBeNull();
  });

  it('caps can be tuned per environment, ignoring nonsense values', () => {
    const env: Record<string, string> = { OTP_LIMIT_PER_NUMBER_HOUR: '3', OTP_LIMIT_PER_NUMBER_DAY: 'lots', OTP_LIMIT_PER_HOUR: '-5' };
    expect(otpLimitsFromEnv((name) => env[name])).toEqual({
      perNumberPerHour: 3,
      perNumberPerDay: DEFAULT_OTP_LIMITS.perNumberPerDay,
      sentPerHourAllNumbers: DEFAULT_OTP_LIMITS.sentPerHourAllNumbers,
    });
  });
});

describe('which practice pays for the code', () => {
  it('the practice that saw the patient most recently pays', () => {
    const records = [
      record({ patientId: 'old', practiceId: 'A', lastVisitDate: '2025-02-01' }),
      record({ patientId: 'recent', practiceId: 'B', lastVisitDate: '2026-09-30' }),
    ];
    expect(recordToCharge(records)?.practiceId).toBe('B');
  });

  it('without visits, the newest file decides', () => {
    const records = [
      record({ patientId: 'older', practiceId: 'A', createdAt: '2024-01-01T00:00:00Z' }),
      record({ patientId: 'newer', practiceId: 'B', createdAt: '2026-01-01T00:00:00Z' }),
    ];
    expect(recordToCharge(records)?.practiceId).toBe('B');
  });

  it('a booking for next month is not a visit: only days up to today count', () => {
    const latest = latestVisitDates(
      [
        { patient_id: 'p', visit_date: '2026-09-01' },
        { patient_id: 'p', visit_date: '2026-11-15' },
        { patient_id: 'p', visit_date: null },
      ],
      '2026-10-07'
    );
    expect(latest.get('p')).toBe('2026-09-01');
  });
});

describe('the sign-in SMS', () => {
  it('fits one SMS, in plain characters, and warns never to share the code', () => {
    const text = otpSmsText('482913', { expiryMinutes: 5, webOtpDomain: 'https://app.onehealthsystems.com/' });
    expect(text.length).toBeLessThanOrEqual(160);
    expect(/^[\x20-\x7E\n]*$/.test(text)).toBe(true); // GSM-7 safe: one segment, not 70-character Unicode ones
    expect(text).toContain('482913');
    expect(text).toMatch(/Never share/);
    // Android Chrome offers the code on the sign-in page when the last line names the site
    expect(text.split('\n').pop()).toBe('@app.onehealthsystems.com #482913');
    expect(otpSmsText('482913')).not.toContain('@');
  });

  it('accepts only digit codes from Supabase Auth', () => {
    expect(isOtpCode('123456')).toBe(true);
    expect(isOtpCode('12a456')).toBe(false);
    expect(isOtpCode(undefined)).toBe(false);
  });

  it('staff never see the code: the SMS log keeps the text with the code hidden', () => {
    // Anyone holding the code could sign in to that patient's app
    const text = otpSmsText('482913', { webOtpDomain: 'app.onehealthsystems.com' });
    const logged = smsContentForLog(AUTH_OTP_MESSAGE_TYPE, text);
    expect(logged).not.toContain('482913');
    expect(logged).toContain('******');
    // Other messages are stored as sent
    expect(smsContentForLog('appointment_reminder', 'Your visit on 12 Oct at 0930')).toBe('Your visit on 12 Oct at 0930');
  });

  it('a patient who replied STOP to marketing still gets the code they asked for', () => {
    expect(isEssentialSmsType(AUTH_OTP_MESSAGE_TYPE)).toBe(true);
    expect(maySendToOptedOutPatient(AUTH_OTP_MESSAGE_TYPE)).toBe(true);
  });

  it('function logs show only the ends of the number', () => {
    expect(maskPhone('+264811234567')).toBe('+264*****4567');
    expect(maskPhone(null)).toBe('');
  });
});
