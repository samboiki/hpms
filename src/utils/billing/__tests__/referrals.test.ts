import { describe, it, expect } from 'vitest';
import {
  describeReferralValidity,
  emptyReferralDraft,
  parseCouncilNumber,
  parseReferralNumber,
  referralClaimFields,
  referralState,
  referralsToPick,
  validateReferralDraft,
  type PatientReferral
} from '../referrals';

// Invented people and numbers only
const TODAY = '2026-10-12';
const referral = (over: Partial<PatientReferral> = {}): PatientReferral => ({
  id: 'r1',
  patientId: 'p1',
  referringName: 'Dr Test Referrer',
  referringPracticeNumber: '0123456',
  referringHpcna: 'MP12345',
  referralNumber: 'REF-1',
  referralDate: '2026-09-01',
  validUntil: '2026-11-30',
  reason: null,
  letterPath: null,
  letterName: null,
  removedAt: null,
  createdAt: '2026-09-01T08:00:00Z',
  ...over
});

// Business rule: the fund matches the referring practitioner by practice number (claim field 25), so the number goes
// on the claim when it is known and the name only when it is not; each referral field holds 15 characters.
describe('a referral on a claim line', () => {
  it('carries the practice number, the council number and the referral number', () => {
    expect(referralClaimFields(referral())).toEqual({ referringDoctor: '0123456', referringCouncilNumber: 'MP12345', referralNumber: 'REF-1' });
  });

  it('carries the name in capitals when the practice number is not known, cut to 15 characters', () => {
    expect(referralClaimFields(referral({ referringPracticeNumber: null, referringName: 'Dr Testname, Longsurname' })).referringDoctor).toBe('DR TESTNAME LON');
  });

  it('carries nothing without a referral', () => {
    expect(referralClaimFields(null)).toEqual({ referringDoctor: '', referringCouncilNumber: '', referralNumber: '' });
  });
});

// Business rule: a referral has a validity; a specialist claiming on an expired referral is refused, so the register
// says plainly which referrals are still valid on the day of the visit and offers those first.
describe('how long a referral is valid', () => {
  it('is valid from its date to its last day, and expired after it', () => {
    expect(referralState(referral(), '2026-10-12')).toBe('valid');
    expect(referralState(referral(), '2026-11-30')).toBe('valid');
    expect(referralState(referral(), '2026-12-01')).toBe('expired');
    expect(referralState(referral(), '2026-08-31')).toBe('not_yet');
    expect(referralState(referral({ validUntil: null }), '2030-01-01')).toBe('valid');
    expect(referralState(referral({ removedAt: '2026-10-01T00:00:00Z' }), TODAY)).toBe('removed');
  });

  it('says so in words, dates day first', () => {
    expect(describeReferralValidity(referral(), TODAY)).toBe('Valid until 30 Nov 2026');
    expect(describeReferralValidity(referral({ validUntil: '2026-10-01' }), TODAY)).toBe('Expired on 1 Oct 2026');
    expect(describeReferralValidity(referral({ validUntil: null }), TODAY)).toBe('No end date');
  });

  it('offers the valid referrals first, newest letter first, and never a removed one', () => {
    const list = [
      referral({ id: 'old', referralDate: '2026-01-05', validUntil: '2026-03-01' }),
      referral({ id: 'valid-older', referralDate: '2026-08-01' }),
      referral({ id: 'valid-newer', referralDate: '2026-09-20' }),
      referral({ id: 'gone', removedAt: '2026-09-21T00:00:00Z' })
    ];
    expect(referralsToPick(list, TODAY).map(item => `${item.referral.id}:${item.state}`)).toEqual(['valid-newer:valid', 'valid-older:valid', 'old:expired']);
  });
});

// Business rule: what reception types must fit the claim layout, or the batch with the line in it cannot be sent.
describe('what reception may type for a referral', () => {
  it('needs the referring practitioner and the date of the letter, and accepts the rest as typed', () => {
    const result = validateReferralDraft({ ...emptyReferralDraft(TODAY), referringName: '  Dr  Test  ', referringPracticeNumber: '012 3456', referringHpcna: 'mp 12345', referralNumber: ' A/12.3 ' }, TODAY);
    expect(result).toEqual({
      ok: true,
      value: {
        referringName: 'Dr Test',
        referringPracticeNumber: '0123456',
        referringHpcna: 'MP12345',
        referralNumber: 'A/12.3',
        referralDate: TODAY,
        validUntil: null,
        reason: null
      }
    });
  });

  it('refuses a missing name, a letter dated in the future and a last day before the letter', () => {
    const result = validateReferralDraft({ ...emptyReferralDraft('2026-10-13'), validUntil: '2026-10-01' }, TODAY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.referringName).toMatch(/who referred/);
    expect(result.errors.referralDate).toMatch(/future/);
    expect(result.errors.validUntil).toMatch(/before the date of the letter/);
  });

  it('refuses numbers the claim cannot carry', () => {
    expect(parseReferralNumber('REF 1').ok).toBe(false);
    expect(parseReferralNumber('1234567890123456').ok).toBe(false);
    expect(parseCouncilNumber('MP-12345').ok).toBe(false);
    expect(parseCouncilNumber('')).toEqual({ ok: true, value: null });
    const letters = validateReferralDraft({ ...emptyReferralDraft(TODAY), referringName: 'Dr Test', referringPracticeNumber: 'ABC' }, TODAY);
    expect(letters.ok ? null : letters.errors.referringPracticeNumber).toMatch(/7 to 15 digits/);
  });
});
