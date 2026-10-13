import { describe, expect, it } from 'vitest';
import {
  activeLinkedPatientIds,
  ageOn,
  birthDateFromNamibianId,
  countsAsFailure,
  decideLink,
  LINK_LIMITS,
  linkLock,
  normalizeIdNumber,
  type LinkCandidate,
} from '../../../supabase/functions/_shared/patientPortalLink.ts';

// 7 Oct 2026, 10:00 in Windhoek (UTC+2)
const NOW = new Date('2026-10-07T08:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const wife: LinkCandidate = { patientId: 'wife', practiceId: 'p1', dateOfBirth: '1985-03-02', idNumber: null };
const husband: LinkCandidate = { patientId: 'husband', practiceId: 'p1', dateOfBirth: '1982-07-15', idNumber: '' };

const link = (candidates: LinkCandidate[], request: { relationship?: string; dateOfBirth: string; idNumber?: string | null }, extra: {
  linkedPatientIds?: string[];
  failureTimes?: string[];
} = {}) =>
  decideLink({
    candidates,
    request: { relationship: request.relationship ?? 'self', dateOfBirth: request.dateOfBirth, idNumber: request.idNumber },
    linkedPatientIds: extra.linkedPatientIds ?? [],
    failureTimes: extra.failureTimes ?? [],
    now: NOW,
  });

describe('linking a login to patient records: whose records may this phone see', () => {
  it('a spouse sharing the phone cannot see the other\'s records without their date of birth', () => {
    // The SMS code only proves the person holds the phone; both spouses' files list this number
    const wifeLinks = link([wife, husband], { dateOfBirth: '1985-03-02' });
    expect(wifeLinks).toMatchObject({ outcome: 'linked', patientIds: ['wife'] });

    const guess = link([wife, husband], { dateOfBirth: '1985-03-03' });
    expect(guess.outcome).toBe('mismatch');
    expect(countsAsFailure(guess)).toBe(true);
  });

  it('when the practice captured an ID number, a date of birth alone is not enough', () => {
    // Family members know each other's birthdays; the ID number is the stronger check
    const withId: LinkCandidate = { patientId: 'anna', practiceId: 'p1', dateOfBirth: '1985-03-02', idNumber: '85030200123' };
    const birthdayOnly = link([withId], { dateOfBirth: '1985-03-02' });
    expect(birthdayOnly.outcome).toBe('id_number_required');
    // It tells the person a birthday matched, so it counts as a wrong try (no endless birthday guessing)
    expect(countsAsFailure(birthdayOnly)).toBe(true);

    expect(link([withId], { dateOfBirth: '1985-03-02', idNumber: '85030200124' }).outcome).toBe('mismatch');
    expect(link([withId], { dateOfBirth: '1985-03-02', idNumber: '8503 0200 123' })).toMatchObject({
      outcome: 'linked',
      patientIds: ['anna'],
      verifiedBy: { anna: 'id_number' },
    });
  });

  it('a correct ID number links even when the birth date on file has a typo', () => {
    const typo: LinkCandidate = { patientId: 'anna', practiceId: 'p1', dateOfBirth: '1985-02-03', idNumber: '85030200123' };
    expect(link([typo], { dateOfBirth: '1985-03-02', idNumber: '85030200123' }).outcome).toBe('linked');
  });

  it('placeholder ID numbers ("N/A", "000000") are not a check: the date of birth is used instead', () => {
    expect(normalizeIdNumber('N/A')).toBeNull();
    expect(normalizeIdNumber('000000')).toBeNull();
    expect(normalizeIdNumber('Unknown')).toBeNull();
    const placeholder: LinkCandidate = { patientId: 'p', practiceId: 'p1', dateOfBirth: '1990-01-01', idNumber: '0000000' };
    expect(link([placeholder], { dateOfBirth: '1990-01-01' })).toMatchObject({ outcome: 'linked', verifiedBy: { p: 'date_of_birth' } });
  });

  it('a parent links a child under 18 with the child\'s details', () => {
    const child: LinkCandidate = { patientId: 'kid', practiceId: 'p1', dateOfBirth: '2015-06-01', idNumber: null };
    expect(link([wife, child], { relationship: 'child', dateOfBirth: '2015-06-01' })).toMatchObject({
      outcome: 'linked',
      relationship: 'child',
      patientIds: ['kid'],
    });
  });

  it('an adult is never added as someone\'s child: each adult adds themselves', () => {
    const adultSon: LinkCandidate = { patientId: 'son', practiceId: 'p1', dateOfBirth: '2000-01-01', idNumber: null };
    expect(link([adultSon], { relationship: 'child', dateOfBirth: '2000-01-01' }).outcome).toBe('child_is_adult');
    expect(link([adultSon], { relationship: 'self', dateOfBirth: '2000-01-01' }).outcome).toBe('linked');
  });

  it('a child stops being a child on the 18th birthday', () => {
    const turns18Today: LinkCandidate = { patientId: 'a', practiceId: 'p1', dateOfBirth: '2008-10-07', idNumber: null };
    const turns18Tomorrow: LinkCandidate = { patientId: 'b', practiceId: 'p1', dateOfBirth: '2008-10-08', idNumber: null };
    expect(link([turns18Today], { relationship: 'child', dateOfBirth: '2008-10-07' }).outcome).toBe('child_is_adult');
    expect(link([turns18Tomorrow], { relationship: 'child', dateOfBirth: '2008-10-08' }).outcome).toBe('linked');
    expect(ageOn('2008-10-08', '2026-10-07')).toBe(17);
  });

  it('twins on a parent\'s phone are both added with their shared birthday', () => {
    const twinA: LinkCandidate = { patientId: 'twinA', practiceId: 'p1', dateOfBirth: '2019-04-04', idNumber: null };
    const twinB: LinkCandidate = { patientId: 'twinB', practiceId: 'p1', dateOfBirth: '2019-04-04', idNumber: null };
    expect(link([twinA, twinB], { relationship: 'child', dateOfBirth: '2019-04-04' })).toMatchObject({
      outcome: 'linked',
      patientIds: ['twinA', 'twinB'],
    });
  });

  it('the same person registered at two practices gets both files with one check', () => {
    const atSecondPractice: LinkCandidate = { ...wife, patientId: 'wife-p2', practiceId: 'p2' };
    expect(link([wife, atSecondPractice], { dateOfBirth: '1985-03-02' })).toMatchObject({ patientIds: ['wife', 'wife-p2'] });
  });

  it('a number on no patient file gets the "ask reception to add your number" answer', () => {
    expect(link([], { dateOfBirth: '1985-03-02' }).outcome).toBe('no_records');
  });

  it('records already linked are not linked twice, and confirming them again is not a wrong try', () => {
    const again = link([wife], { dateOfBirth: '1985-03-02' }, { linkedPatientIds: ['wife'] });
    expect(again.outcome).toBe('already_linked');
    expect(countsAsFailure(again)).toBe(false);
  });

  it('an impossible or future date of birth is refused before any record is compared, and not counted', () => {
    const impossible = link([wife], { dateOfBirth: '1985-02-30' });
    expect(impossible.outcome).toBe('invalid');
    expect(countsAsFailure(impossible)).toBe(false);
    expect(link([wife], { dateOfBirth: '2026-10-08' }).outcome).toBe('invalid');
    expect(link([wife], { relationship: 'spouse', dateOfBirth: '1985-03-02' }).outcome).toBe('invalid');
    expect(link([wife], { dateOfBirth: '1985-03-02', idNumber: '12' }).outcome).toBe('invalid');
  });
});

describe('lock after wrong details: the phone holder cannot keep guessing birthdays', () => {
  it(`${LINK_LIMITS.shortWindowMaxFailures} wrong tries in a day lock linking until the oldest of them is a day old`, () => {
    const failures = [hoursAgo(1), hoursAgo(2), hoursAgo(3), hoursAgo(4), hoursAgo(5)];
    const decision = link([wife], { dateOfBirth: '1985-03-02' }, { failureTimes: failures });
    // Locked even with the right details: otherwise the lock would not stop guessing
    expect(decision).toEqual({ outcome: 'locked', until: new Date(Date.parse(hoursAgo(5)) + 24 * 3_600_000).toISOString(), askReception: false });
  });

  it('tries older than a day no longer count towards the daily lock', () => {
    const failures = [hoursAgo(25), hoursAgo(26), hoursAgo(27), hoursAgo(28), hoursAgo(29)];
    expect(linkLock(failures, NOW)).toBeNull();
    expect(link([wife], { dateOfBirth: '1985-03-02' }, { failureTimes: failures }).outcome).toBe('linked');
  });

  it(`${LINK_LIMITS.longWindowMaxFailures} wrong tries in a month send the person to reception`, () => {
    // Two a day for five days: never five in one day, but ten in the month
    const failures = [1, 2, 25, 26, 49, 50, 73, 74, 97, 98].map(hoursAgo);
    expect(linkLock(failures, NOW)).toMatchObject({ askReception: true });
  });

  it('the screen can warn how many tries are left today', () => {
    const decision = link([wife], { dateOfBirth: '1990-01-01' }, { failureTimes: [hoursAgo(1), hoursAgo(2), hoursAgo(3)] });
    expect(decision).toEqual({ outcome: 'mismatch', attemptsLeft: 1 });
  });
});

describe('ID numbers and links', () => {
  it('reads the birth date from a Namibian ID number (YYMMDD...) in the right century', () => {
    expect(birthDateFromNamibianId('85030200123', '2026-10-07')).toBe('1985-03-02');
    expect(birthDateFromNamibianId('15060100123', '2026-10-07')).toBe('2015-06-01');
    expect(birthDateFromNamibianId('85130200123', '2026-10-07')).toBeNull();
    expect(birthDateFromNamibianId('P1234567', '2026-10-07')).toBeNull();
  });

  it('a link stops working when it was revoked or the login now has another number', () => {
    const links = [
      { patient_id: 'kept', phone_e164: '+264811234567', revoked_at: null },
      { patient_id: 'revoked', phone_e164: '+264811234567', revoked_at: '2026-10-01T00:00:00Z' },
      { patient_id: 'old-number', phone_e164: '+264851111111', revoked_at: null },
    ];
    expect(activeLinkedPatientIds(links, '+264811234567')).toEqual(['kept']);
    expect(activeLinkedPatientIds(links, null)).toEqual([]);
  });
});
