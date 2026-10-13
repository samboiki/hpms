/**
 * "How did you hear about us?" in Reports > Demographics (owner's decision, 13 Oct 2026; parity R26): new patients per
 * month by what they answered, so the practice sees which marketing brings patients in. Skipped answers are counted
 * as Not answered (never dropped, so each month still adds up to its new patients), and what the patient said is kept
 * apart from what the file shows (a referral letter), as the two can disagree. Invented names only.
 */
import { describe, expect, it } from 'vitest';
import {
  HEARD_KEYS,
  countBy,
  heardMonthTable,
  heardPerMonth,
  patientFacts,
  patientListTable,
  type PatientRecord
} from '../patientDemographics';

const record = (overrides: Partial<PatientRecord> = {}): PatientRecord => ({
  id: 'p1', firstName: 'Pat', lastName: 'Testing', homeLanguage: 'English', homeAddress: null, postalAddress: null,
  town: null, createdAt: '2026-09-10T08:00:00+02:00', legacyAccountNumber: null, ...overrides
});

const facts = patientFacts([
  record({ id: 'a', referralSource: 'friend_family' }),
  record({ id: 'b', referralSource: 'friend_family', createdAt: '2026-10-02T08:00:00+02:00' }),
  record({ id: 'c', referralSource: 'other', referralSourceOther: 'Church notice board', createdAt: '2026-10-05T08:00:00+02:00' }),
  record({ id: 'd', createdAt: '2026-10-06T08:00:00+02:00' }),
  record({ id: 'e', referralSource: 'social_media', createdAt: '2026-08-20T08:00:00+02:00' })
], { referred: new Set(['b']), bookedOnline: new Set() });

const range = { startKey: '2026-09-01', endKey: '2026-10-31' };

describe('new patients per month by how they heard about us', () => {
  it('counts each month by answer, with skipped answers as Not answered so the month adds up', () => {
    const months = heardPerMonth(facts, range);
    expect(months.map(month => month.monthKey)).toEqual(['2026-09', '2026-10']);
    expect(months[0]).toMatchObject({ count: 1, byHeard: expect.objectContaining({ friend_family: 1, not_answered: 0 }) });
    expect(months[1]).toMatchObject({ count: 3, byHeard: expect.objectContaining({ friend_family: 1, other: 1, not_answered: 1 }) });
    for (const month of months) {
      expect(HEARD_KEYS.reduce((sum, key) => sum + month.byHeard[key], 0)).toBe(month.count);
    }
  });

  it('leaves out files opened outside the period (August is not in September to October)', () => {
    const total = heardPerMonth(facts, range).reduce((sum, month) => sum + month.count, 0);
    expect(total).toBe(4);
  });

  it('shows one column per answer and a total row that matches the new patients', () => {
    const table = heardMonthTable(heardPerMonth(facts, range), 'Files opened in the period', []).table;
    expect(table.columns.map(column => column.header)).toEqual([
      'Month', 'New patients', 'Referral by a doctor', 'Friend or family', 'Medical aid', 'Google or the internet',
      'Social media', 'Walk-in or signage', 'Radio or newspaper', 'Other', 'Not answered'
    ]);
    expect(table.totals.slice(0, 2)).toEqual(['Total', 4]);
  });

  it('keeps what the patient said apart from what the file shows: a referral letter does not change the answer', () => {
    const b = facts.find(fact => fact.id === 'b');
    expect(b?.source).toBe('referred');
    expect(b?.heard).toBe('friend_family');
  });

  it("lists the answer in words, with Other's own words, on the patient list for marketing follow-up", () => {
    const list = patientListTable(facts.filter(fact => fact.id === 'c' || fact.id === 'd'), { title: 'New patients', basis: '', notes: [] });
    const heardColumn = list.table.columns.findIndex(column => column.header === 'Heard about us through');
    expect(list.table.rows.map(row => row[heardColumn])).toEqual(['Other: Church notice board', 'Not answered']);
  });

  it('puts Not answered last when grouping by answer', () => {
    const groups = countBy(facts, 'heard');
    expect(groups[groups.length - 1].key).toBe('not_answered');
    expect(groups[0]).toEqual({ key: 'friend_family', count: 2 });
  });
});
