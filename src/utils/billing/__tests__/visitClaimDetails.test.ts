import { describe, it, expect } from 'vitest';
import {
  EMPTY_CLAIM_DETAILS,
  claimDetailFields,
  describeClaimDetails,
  draftOfClaimDetails,
  draftWithReferral,
  draftWithoutReferral,
  isEmptyClaimDetails,
  parsePlaceOfService,
  placeOfServiceLabel,
  validateClaimDetailsDraft
} from '../visitClaimDetails';

// Invented people and numbers only
const draft = draftOfClaimDetails(null);

// Business rule: the place of service is a two-digit code from the fund list (claim field 42); a code outside the list
// is refused at the desk, because the fund refuses the claim line with it.
describe('the place of service', () => {
  it('accepts codes of the eight groups and names their group', () => {
    expect(parsePlaceOfService(' 41 ')).toEqual({ ok: true, value: '41' });
    expect(placeOfServiceLabel('41')).toMatch(/^Hospital, admitted/);
    expect(placeOfServiceLabel('11')).toBe("Practitioner's rooms or a clinic");
    expect(placeOfServiceLabel('83')).toBe('A day clinic or surgical centre');
  });

  it('refuses codes outside the list', () => {
    ['15', '47', '84', '9', 'AB'].forEach(code => expect(parsePlaceOfService(code).ok).toBe(false));
    expect(parsePlaceOfService('')).toEqual({ ok: true, value: null });
  });
});

// Business rule: a specialist's claim for a hospital case says "H" (field 30); the admission and discharge belong to
// that stay, so they are kept only for a hospital case and cannot be back to front.
describe('a hospital stay', () => {
  it('keeps the dates of a hospital case and sends H', () => {
    const result = validateClaimDetailsDraft({ ...draft, inHospital: true, admissionDate: '2026-10-03', dischargeDate: '2026-10-05', placeOfService: '41' }, '2026-10-04');
    expect(result.ok && result.value).toMatchObject({ inHospital: true, admissionDate: '2026-10-03', dischargeDate: '2026-10-05', placeOfService: '41' });
    expect(result.ok && claimDetailFields(result.value)).toEqual({ hospitalIndicator: 'H', placeOfService: '41' });
  });

  it('drops hospital dates when the case is not in hospital', () => {
    const result = validateClaimDetailsDraft({ ...draft, inHospital: false, admissionDate: '2026-10-03' }, '2026-10-04');
    expect(result.ok && result.value.admissionDate).toBeNull();
    expect(result.ok && claimDetailFields(result.value).hospitalIndicator).toBe('');
  });

  it('refuses a discharge before the admission or without one', () => {
    const backwards = validateClaimDetailsDraft({ ...draft, inHospital: true, admissionDate: '2026-10-05', dischargeDate: '2026-10-03' }, null);
    expect(backwards.ok ? null : backwards.errors.dischargeDate).toMatch(/before the admission/);
    const noAdmission = validateClaimDetailsDraft({ ...draft, inHospital: true, dischargeDate: '2026-10-03' }, null);
    expect(noAdmission.ok ? null : noAdmission.errors.dischargeDate).toMatch(/admission date first/);
  });

  it('questions a visit outside the stay without stopping it', () => {
    const result = validateClaimDetailsDraft({ ...draft, inHospital: true, admissionDate: '2026-10-05' }, '2026-10-04');
    expect(result.ok && result.warnings[0]).toMatch(/before the admission on 5 Oct 2026/);
  });
});

// Business rule: picking a referral from the register fills the visit's claim fields (fields 25, 43, 44), which staff
// may still correct for this visit; taking it off clears them.
describe("a visit's referral", () => {
  const details = { referringName: 'Dr Test', referringPracticeNumber: '0123456', referringHpcna: 'MP12345', referralNumber: 'R-9' };

  it('is filled from the register and cleared again', () => {
    const filled = draftWithReferral(draft, 'ref-1', details);
    expect(filled).toMatchObject({ referralId: 'ref-1', referringName: 'Dr Test', referringPracticeNumber: '0123456', referringHpcna: 'MP12345', referralNumber: 'R-9' });
    expect(draftWithoutReferral(filled)).toEqual(draft);
  });

  it('asks for the name or practice number when only a number was typed', () => {
    const result = validateClaimDetailsDraft({ ...draft, referralNumber: 'R-9' }, null);
    expect(result.ok && result.warnings).toEqual(["The fund needs the referring practitioner's name or practice number."]);
  });

  it('is summed up in one line for the closed card', () => {
    const result = validateClaimDetailsDraft({ ...draftWithReferral(draft, 'ref-1', details), inHospital: true, admissionDate: '2026-10-03' }, null);
    expect(result.ok && describeClaimDetails(result.value)).toBe('Referred by Dr Test (referral R-9) · in hospital from 3 Oct 2026');
    expect(isEmptyClaimDetails(EMPTY_CLAIM_DETAILS)).toBe(true);
    expect(describeClaimDetails(EMPTY_CLAIM_DETAILS)).toBe('');
  });
});
