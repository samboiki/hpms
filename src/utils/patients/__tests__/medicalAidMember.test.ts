import { describe, expect, it } from 'vitest';
import { splitMemberName } from '../../billing/claimLine';
import { fundRulesFromRows, setFundRulesInForce } from '../../billing/fundRules';
import {
  claimMemberPreview,
  composeMainMemberName,
  dependantCodeProblem,
  initialsOf,
  isMainMemberRelationship,
  membershipNumberHint,
  normalizeDependantCode,
  normalizeInitials,
  planMainMemberSwap,
  relationshipOption,
  splitMainMemberName,
  type FamilyMemberRecord
} from '../medicalAidMember';

describe('membershipNumberHint', () => {
  it('warns when an NMC number is not 9 digits, the length on every claim NMC accepted', () => {
    expect(membershipNumberHint({ reference: 'NMC1' }, '12345678')).toBe(
      'NMC membership numbers have 9 digits; this one has 8. Check it against the card.'
    );
    expect(membershipNumberHint({ reference: 'NMC1' }, '123 456 789')).toBeNull();
  });

  it('knows NHP and NAMMED use 11 digits, also when only the fund name is on file', () => {
    expect(membershipNumberHint({ name: 'Namibia Health Plan' }, '1234567890')).toMatch(/NHP membership numbers have 11 digits/);
    expect(membershipNumberHint({ shortName: 'NAMMED' }, '12345678901')).toBeNull();
  });

  it('warns about letters in a number the fund writes in digits', () => {
    expect(membershipNumberHint({ reference: 'NHPM' }, 'NHP1234567')).toMatch(/digits only/);
  });

  it('says nothing for funds whose number length is not known yet (never a false alarm)', () => {
    expect(membershipNumberHint({ reference: 'MAG1', name: 'PSEMAS' }, '12')).toBeNull();
    expect(membershipNumberHint({ name: 'Some new fund' }, '12')).toBeNull();
    expect(membershipNumberHint({ reference: 'NMC1' }, '')).toBeNull();
  });

  // Reception sees what OneHealth support set on Administration > Medical aid funds, at registration as at claiming
  it("uses the fund master's lengths and hint once support sets them", () => {
    setFundRulesInForce(fundRulesFromRows([{
      medical_aid_reference: 'PROS', claim_deadline_days: 120, claim_deadline_months: null, deadline_confirmed: false, claims_portal_url: null,
      membership_digits: [6], membership_hint: 'Six digits, printed above the member name.', dependant_code_required: true, payment_terms_days: 30
    }]));
    try {
      expect(membershipNumberHint({ name: 'Prosperity Health' }, '12345')).toBe(
        'Prosperity Health membership numbers have 6 digits; this one has 5. Six digits, printed above the member name.'
      );
      expect(membershipNumberHint({ reference: 'PROS' }, '123456')).toBeNull();
    } finally {
      setFundRulesInForce(null);
    }
  });
});

describe('dependant code', () => {
  it('writes a single digit as two, because the claim needs "01 NDAPEWA" and a fund check looks for two digits', () => {
    expect(normalizeDependantCode('1')).toBe('01');
    expect(normalizeDependantCode(' 02 ')).toBe('02');
    expect(normalizeDependantCode('')).toBe('');
  });

  it('refuses what the database would refuse, before anything is saved', () => {
    expect(dependantCodeProblem('A1')).toMatch(/only the digits/);
    expect(dependantCodeProblem('1234')).toMatch(/at most 3 digits/);
    expect(dependantCodeProblem('03')).toBeNull();
    expect(dependantCodeProblem('')).toBeNull();
  });
});

describe('main member name', () => {
  it('saves "Surname, J N", which the claim builder reads as surname and initials every time', () => {
    const stored = composeMainMemberName({ surname: 'Nghipondoka Kambonde', initials: 'm.m.' });
    expect(stored).toBe('Nghipondoka Kambonde, M M');
    // Written without a comma this double surname would be split wrongly
    expect(splitMemberName(stored)).toEqual({ surname: 'NGHIPONDOKA KAMBONDE', initials: 'MM' });
  });

  it('shows reception the member name exactly as the fund will see it', () => {
    expect(claimMemberPreview({ surname: 'van der Merwe', initials: 'P' })).toBe('VAN DER MERWE P');
    expect(claimMemberPreview({ surname: '', initials: 'P' })).toBeNull();
  });

  it('reads an older full name back into surname and initials, so editing does not start empty', () => {
    expect(splitMainMemberName('Johannes Ndapewa Shilongo', 'Shilongo')).toEqual({ surname: 'Shilongo', initials: 'JN' });
    expect(splitMainMemberName('Shilongo, J N')).toEqual({ surname: 'Shilongo', initials: 'JN' });
    expect(splitMainMemberName(null)).toEqual({ surname: '', initials: '' });
  });

  it('tidies initials typed with dots and spaces', () => {
    expect(normalizeInitials(' j. n. ')).toBe('JN');
    expect(initialsOf('Johannes  Ndapewa-Maria')).toBe('JNM');
  });
});

describe('relationshipOption', () => {
  it('shows relationships older screens saved ("Main Member", "Child", "Sibling") as the form options, instead of "not recorded"', () => {
    expect(relationshipOption('Main Member')).toBe('self');
    expect(relationshipOption('Child')).toBe('child');
    expect(relationshipOption('Partner')).toBe('spouse');
    expect(relationshipOption('Sibling')).toBe('other');
    expect(relationshipOption('')).toBe('');
  });
});

describe('isMainMemberRelationship', () => {
  it('treats every spelling the forms have saved for the main member alike', () => {
    expect(isMainMemberRelationship('self')).toBe(true);
    expect(isMainMemberRelationship('Main Member')).toBe(true);
    expect(isMainMemberRelationship('Spouse')).toBe(false);
    expect(isMainMemberRelationship('')).toBe(false);
  });
});

describe('planMainMemberSwap', () => {
  // An invented family on one membership
  const family: FamilyMemberRecord[] = [
    { medicalAidId: 'ma-1', patientId: 'p-father', firstName: 'Johannes', lastName: 'Shilongo', idNumber: '70010100111', relationship: 'self' },
    { medicalAidId: 'ma-2', patientId: 'p-mother', firstName: 'Ndapewa Maria', lastName: 'Shilongo', idNumber: '72020200222', relationship: 'spouse' },
    { medicalAidId: 'ma-3', patientId: 'p-child', firstName: 'Tangeni', lastName: 'Shilongo', idNumber: null, relationship: 'Child' }
  ];

  it('makes the spouse the main member and rewrites the main member name and ID on every family record', () => {
    const plan = planMainMemberSwap(family, 'p-mother', 'spouse');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.newMainMemberName).toBe('Shilongo, N M');
    expect(plan.updates).toEqual([
      { medicalAidId: 'ma-1', changes: { main_member_name: 'Shilongo, N M', main_member_id_number: '72020200222' } },
      { medicalAidId: 'ma-2', changes: { main_member_name: 'Shilongo, N M', main_member_id_number: '72020200222' } },
      { medicalAidId: 'ma-3', changes: { main_member_name: 'Shilongo, N M', main_member_id_number: '72020200222' } },
      { medicalAidId: 'ma-1', changes: { relationship_to_main: 'spouse' } },
      { medicalAidId: 'ma-2', changes: { relationship_to_main: 'self' } }
    ]);
  });

  it('can finish a swap that stopped half-way: the new main member is promoted last', () => {
    // Interrupted after the old main member stepped down: nobody is "self" yet
    const interrupted = family.map(member => (member.patientId === 'p-father' ? { ...member, relationship: 'spouse' } : member));
    const plan = planMainMemberSwap(interrupted, 'p-mother', 'spouse');
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.updates[plan.updates.length - 1]).toEqual({ medicalAidId: 'ma-2', changes: { relationship_to_main: 'self' } });
  });

  it('refuses to swap to someone who is already the main member or not on the membership', () => {
    expect(planMainMemberSwap(family, 'p-father', 'spouse')).toEqual({ ok: false, error: 'This person is already the main member.' });
    expect(planMainMemberSwap(family, 'p-stranger', 'spouse')).toMatchObject({ ok: false });
  });

  it('needs to know what the old main member becomes, so nobody is left as a second main member', () => {
    expect(planMainMemberSwap(family, 'p-mother', '')).toMatchObject({ ok: false, error: 'Choose what the current main member becomes.' });
  });
});
