import { describe, expect, it } from 'vitest';
import {
  bucketTitle,
  daysOf,
  followUpsDue,
  periodRange,
  practitionerLabel,
  summariseVisits,
  topDiagnoses,
  visitOutcome,
  visitTypeName,
  type AnalyticsVisitRow,
  type DiagnosisLineRow,
  type FollowUpVisitRow,
  type VisitFigures
} from '../encounterAnalytics';

// Invented rows only: no real patients, practitioners or visits
const TODAY = '2026-10-12';
const LAST_30_DAYS = periodRange('30d', TODAY);
const STAFF = [
  { id: 'pr-a', full_name: 'Practitioner A' },
  { id: 'pr-b', full_name: 'Practitioner B' }
];

const visit = (id: string, overrides: Partial<AnalyticsVisitRow> = {}): AnalyticsVisitRow => ({
  id,
  patient_id: `patient-${id}`,
  doctor_id: 'pr-a',
  scheduled_date: '2026-10-05',
  visit_date: '2026-10-05',
  status: 'completed',
  is_cancelled: false,
  is_checked_in: true,
  is_ready: false,
  visit_type: 'consultation',
  ...overrides
});

const count = (ids: string[]) => ids.length;
const sum = (groups: Array<{ ids: string[] }>) => groups.reduce((total, group) => total + group.ids.length, 0);

describe('the period', () => {
  it('"Last 30 days" is today and the 29 days before, so its figures match the diary for the same days', () => {
    expect(LAST_30_DAYS).toEqual({ from: '2026-09-13', to: TODAY });
    expect(daysOf(LAST_30_DAYS)).toHaveLength(30);
    expect(periodRange('7d', TODAY)).toEqual({ from: '2026-10-06', to: TODAY });
  });

  it('months count back by the calendar, clamping at a short month, so "Last 3 months" never skips or repeats a day', () => {
    expect(periodRange('3m', TODAY)).toEqual({ from: '2026-07-13', to: TODAY });
    expect(periodRange('6m', TODAY)).toEqual({ from: '2026-04-13', to: TODAY });
    // 31 December less three months is 30 September (there is no 31st): the period starts the day after
    expect(periodRange('3m', '2026-12-31')).toEqual({ from: '2026-10-01', to: '2026-12-31' });
  });
});

describe('visits by status', () => {
  const rows = [
    visit('seen'),
    visit('in-room', { status: 'in-progress' }),
    visit('waiting', { status: 'scheduled', is_checked_in: true }),
    visit('no-show', { status: 'no-show', is_checked_in: false }),
    visit('cancelled-flag', { status: 'scheduled', is_cancelled: true, is_checked_in: false }),
    visit('cancelled', { status: 'cancelled', is_checked_in: false }),
    visit('forgotten', { status: 'scheduled', is_checked_in: false, scheduled_date: '2026-10-09', visit_date: '2026-10-09' }),
    visit('later-today', { status: 'scheduled', is_checked_in: false, scheduled_date: TODAY, visit_date: TODAY })
  ];

  it('uses the diary report\'s words, so a practice reads the same "seen" and "no-show" on both screens', () => {
    const outcomes = rows.map((row) => visitOutcome(row, TODAY));
    expect(outcomes).toEqual(['seen', 'seen', 'seen', 'no_show', 'cancelled', 'cancelled', 'not_marked', 'still_to_come']);
  });

  it('every visit lands in exactly one status, so the statuses add up to the Visits figure', () => {
    const figures = summariseVisits(rows, LAST_30_DAYS, TODAY, STAFF);
    expect(count(figures.ids)).toBe(8);
    expect(Object.values(figures.outcomes).reduce((total, ids) => total + ids.length, 0)).toBe(8);
    expect(figures.outcomes.no_show).toEqual(['no-show']);
    // A past booking nobody marked is worth a look: it is not hidden among the bookings still to come
    expect(figures.outcomes.not_marked).toEqual(['forgotten']);
    expect(figures.outcomes.still_to_come).toEqual(['later-today']);
  });
});

describe('which visits a period holds', () => {
  it('a visit belongs to its booked day, else (a walk-in) the day it was seen, as in the diary', () => {
    const rows = [
      visit('booked', { scheduled_date: '2026-10-01', visit_date: '2026-10-02' }),
      visit('walk-in', { scheduled_date: null, visit_date: '2026-10-03' })
    ];
    const figures = summariseVisits(rows, LAST_30_DAYS, TODAY, STAFF);
    const dayOf = (id: string) => figures.buckets.find((bucket) => bucket.ids.includes(id))?.from;
    expect(dayOf('booked')).toBe('2026-10-01');
    expect(dayOf('walk-in')).toBe('2026-10-03');
  });

  it('a visit outside the period is not counted, even if it was read', () => {
    const rows = [visit('inside'), visit('before', { scheduled_date: '2026-09-12', visit_date: '2026-09-12' })];
    expect(summariseVisits(rows, LAST_30_DAYS, TODAY, STAFF).ids).toEqual(['inside']);
  });
});

describe('visits per day or week', () => {
  it('draws every day of the period, quiet days as zero, and each bar holds that day\'s visits', () => {
    const rows = [visit('a', { scheduled_date: '2026-10-05' }), visit('b', { scheduled_date: '2026-10-05' }), visit('c', { scheduled_date: TODAY })];
    const figures = summariseVisits(rows, LAST_30_DAYS, TODAY, STAFF);
    expect(figures.unit).toBe('day');
    expect(figures.buckets).toHaveLength(30);
    expect(figures.buckets[0]).toEqual({ from: '2026-09-13', to: '2026-09-13', ids: [] });
    expect(figures.buckets.find((bucket) => bucket.from === '2026-10-05')?.ids).toEqual(['a', 'b']);
    // The bars add up to the Visits figure
    expect(sum(figures.buckets)).toBe(3);
  });

  it('a long period gets a bar per week, Monday to Sunday, cut at the period\'s first day so no week counts days outside it', () => {
    const range = periodRange('3m', TODAY); // 13 Jul (a Monday) to 12 Oct (a Monday)
    const rows = [visit('first', { scheduled_date: '2026-07-13' }), visit('sunday', { scheduled_date: '2026-07-19' }), visit('last', { scheduled_date: TODAY })];
    const figures = summariseVisits(rows, range, TODAY, STAFF);
    expect(figures.unit).toBe('week');
    expect(figures.buckets[0]).toEqual({ from: '2026-07-13', to: '2026-07-19', ids: ['first', 'sunday'] });
    expect(figures.buckets[figures.buckets.length - 1]).toEqual({ from: TODAY, to: TODAY, ids: ['last'] });
    expect(sum(figures.buckets)).toBe(3);

    const midweek = summariseVisits([], periodRange('6m', '2026-10-15'), '2026-10-15', STAFF);
    // 16 April 2026 is a Thursday: the first bar starts there, not on the Monday before
    expect(midweek.buckets[0]).toMatchObject({ from: '2026-04-16', to: '2026-04-19' });
  });

  it('names a bar in full for screen readers and the encounters list', () => {
    expect(bucketTitle({ from: '2026-10-06', to: '2026-10-06' }, 'day')).toBe('Tue 6 Oct 2026');
    expect(bucketTitle({ from: '2026-10-05', to: '2026-10-11' }, 'week')).toBe('5-11 Oct 2026');
  });
});

describe('visits by practitioner and by visit type', () => {
  const rows = [
    visit('1', { doctor_id: 'pr-b' }),
    visit('2', { doctor_id: 'pr-b', visit_type: 'procedure' }),
    visit('3', { doctor_id: 'pr-a', visit_type: 'follow-up' }),
    visit('4', { doctor_id: null }),
    visit('5', { doctor_id: 'pr-gone' })
  ];

  it('names each practitioner from the practice\'s staff list, busiest first, and adds up to the Visits figure', () => {
    const { byPractitioner } = summariseVisits(rows, LAST_30_DAYS, TODAY, STAFF);
    expect(byPractitioner.map((group) => [group.label, group.ids.length])).toEqual([
      ['Practitioner B', 2],
      ['Former practitioner', 1],
      ['No practitioner chosen', 1],
      ['Practitioner A', 1]
    ]);
    expect(sum(byPractitioner)).toBe(5);
  });

  it('never invents a name: without the staff list a practitioner is shown as not loaded', () => {
    expect(practitionerLabel('pr-a', null)).toBe('Practitioner (name not loaded)');
    expect(practitionerLabel(null, null)).toBe('No practitioner chosen');
  });

  it('uses the diary\'s names for visit types and adds up to the Visits figure', () => {
    const { byVisitType } = summariseVisits(rows, LAST_30_DAYS, TODAY, STAFF);
    expect(byVisitType.map((group) => [group.label, group.ids.length])).toEqual([
      ['Consultation', 3],
      ['Follow-up', 1],
      ['Procedure', 1]
    ]);
    expect(visitTypeName(null)).toBe('Type not recorded');
  });
});

describe('top diagnoses', () => {
  const line = (visitId: string, primary: string | null, secondary: string[] = [], paymentStatus: string | null = 'pending'): DiagnosisLineRow => ({
    icd10_primary: primary,
    icd10_secondary: secondary,
    invoice: { visit_id: visitId, payment_status: paymentStatus }
  });

  it('counts visits, not invoice lines: five lines under one code on one visit are one visit with that diagnosis', () => {
    const lines = [...Array.from({ length: 5 }, () => line('v1', 'J06.9')), line('v2', 'J06.9')];
    expect(topDiagnoses(lines)).toEqual([{ code: 'J06.9', visitIds: ['v1', 'v2'] }]);
  });

  it('counts the other codes on a line too, and leaves out cancelled invoices, which billed nothing', () => {
    const lines = [line('v1', 'J06.9', ['I10']), line('v2', 'I10'), line('v3', 'E11.9', [], 'cancelled')];
    expect(topDiagnoses(lines)).toEqual([
      { code: 'I10', visitIds: ['v1', 'v2'] },
      { code: 'J06.9', visitIds: ['v1'] }
    ]);
  });

  it('lists the most common first and keeps to the top ones', () => {
    const lines = [line('v1', 'B02.9'), line('v2', 'A09'), line('v3', 'A09'), line('v4', 'C50.9')];
    expect(topDiagnoses(lines, 2).map((row) => row.code)).toEqual(['A09', 'B02.9']);
  });
});

describe('follow-ups due', () => {
  const followUp = (id: string, overrides: Partial<FollowUpVisitRow> = {}): FollowUpVisitRow => ({
    ...visit(id, { scheduled_date: '2026-09-20', visit_date: '2026-09-20' }),
    follow_up_date: '2026-10-01',
    patient: { first_name: 'Example', last_name: `Patient ${id}`, visits: [] },
    ...overrides
  });
  const laterVisit = (id: string, date: string, overrides: Partial<AnalyticsVisitRow> = {}) => ({
    id,
    scheduled_date: date,
    visit_date: date,
    status: 'scheduled',
    is_cancelled: false,
    is_checked_in: false,
    is_ready: false,
    ...overrides
  });

  it('lists a patient whose follow-up date has come and who has not been back, with how late it is', () => {
    const [due] = followUpsDue([followUp('a')], LAST_30_DAYS, TODAY);
    expect(due).toMatchObject({ visitId: 'a', patientId: 'patient-a', patientName: 'Example Patient a', dueOn: '2026-10-01', seenOn: '2026-09-20', daysOverdue: 11 });
  });

  it('leaves out a patient who is already booked again: calling them would waste the receptionist\'s time', () => {
    const booked = followUp('a', { patient: { first_name: 'Example', last_name: 'Patient', visits: [laterVisit('next', '2026-10-20')] } });
    expect(followUpsDue([booked], LAST_30_DAYS, TODAY)).toEqual([]);
  });

  it('still lists a patient whose later booking was cancelled or missed: they have not come back', () => {
    const missed = followUp('a', {
      patient: {
        first_name: 'Example',
        last_name: 'Patient',
        visits: [laterVisit('cancelled', '2026-10-02', { is_cancelled: true }), laterVisit('missed', '2026-10-03', { status: 'no-show' })]
      }
    });
    expect(followUpsDue([missed], LAST_30_DAYS, TODAY)).toHaveLength(1);
  });

  it('leaves out follow-ups not due yet, and visits that never took place', () => {
    const notYet = followUp('a', { follow_up_date: '2026-10-13' });
    const neverSeen = followUp('b', { status: 'cancelled', is_cancelled: true, is_checked_in: false });
    expect(followUpsDue([notYet, neverSeen], LAST_30_DAYS, TODAY)).toEqual([]);
  });

  it('shows one line per patient, the most overdue first', () => {
    const rows = [
      followUp('late', { follow_up_date: '2026-09-25' }),
      followUp('today', { follow_up_date: TODAY }),
      followUp('same-patient', { patient_id: 'patient-late', follow_up_date: '2026-09-30' })
    ];
    expect(followUpsDue(rows, LAST_30_DAYS, TODAY).map((item) => [item.visitId, item.daysOverdue])).toEqual([
      ['late', 17],
      ['today', 0]
    ]);
  });
});

describe('figures come from the rows', () => {
  // The owner's first rule: no fake numbers. A typed-in figure would not follow the rows; a random one would change
  // between two reads of the same rows.
  const rows = [
    visit('1'),
    visit('2', { status: 'no-show', is_checked_in: false, doctor_id: 'pr-b', visit_type: 'procedure' }),
    visit('3', { status: 'cancelled', is_checked_in: false, scheduled_date: '2026-10-07' }),
    visit('4', { status: 'scheduled', is_checked_in: false, scheduled_date: '2026-10-08' })
  ];
  const doubled = [...rows, ...rows.map((row) => ({ ...row, id: `${row.id}-again` }))];
  const numbers = (figures: VisitFigures) => [
    figures.ids.length,
    ...Object.values(figures.outcomes).map((ids) => ids.length),
    ...figures.buckets.map((bucket) => bucket.ids.length),
    ...figures.byPractitioner.map((group) => group.ids.length),
    ...figures.byVisitType.map((group) => group.ids.length)
  ];

  it('the same rows give the same figures, and twice the rows give twice every figure', () => {
    const once = numbers(summariseVisits(rows, LAST_30_DAYS, TODAY, STAFF));
    expect(numbers(summariseVisits(rows, LAST_30_DAYS, TODAY, STAFF))).toEqual(once);
    expect(numbers(summariseVisits(doubled, LAST_30_DAYS, TODAY, STAFF))).toEqual(once.map((value) => value * 2));
    expect(numbers(summariseVisits([], LAST_30_DAYS, TODAY, STAFF)).every((value) => value === 0)).toBe(true);
  });
});
