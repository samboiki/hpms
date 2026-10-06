import { describe, it, expect } from 'vitest';
import {
  matchesRule,
  resolveListMembers,
  toPatientFacts,
  validateRule,
  type ListMemberRow,
  type PatientFacts,
  type SmartRule
} from '../listRules';

const TODAY = '2026-10-07'; // a Wednesday

const facts = (overrides: Partial<PatientFacts> = {}): PatientFacts => ({
  patientId: 'p1',
  firstName: 'Maria',
  lastName: 'Shikongo',
  dateOfBirth: '1986-03-15',
  cellNumber: '081 123 4567',
  smsOptOut: false,
  lastCompletedVisitOn: '2026-09-01',
  lastCompletedByType: { consultation: '2026-09-01' },
  completedVisitsLastYear: 1,
  nextBookingOn: null,
  nextBookingTime: null,
  lastNoShowOn: null,
  balanceDue: 0,
  oldestUnpaidOn: null,
  ...overrides
});

const recall: SmartRule = { type: 'recall_due', months: 6, visitTypes: [] };

describe('birthday lists', () => {
  const today: SmartRule = { type: 'birthday', window: 'today' };

  it('puts a 29 February patient on "Birthdays today" on 28 February 2027 and not on 1 March', () => {
    const leapling = facts({ dateOfBirth: '2000-02-29' });
    expect(matchesRule(today, leapling, '2027-02-28')).toBe(true);
    expect(matchesRule(today, leapling, '2027-03-01')).toBe(false);
  });

  it('includes Sunday\'s birthday in "this week" on Wednesday, but not next Monday\'s', () => {
    const week: SmartRule = { type: 'birthday', window: 'this_week' };
    expect(matchesRule(week, facts({ dateOfBirth: '1990-10-11' }), TODAY)).toBe(true);
    expect(matchesRule(week, facts({ dateOfBirth: '1990-10-12' }), TODAY)).toBe(false);
  });

  it('includes earlier and later birthdays of the month in "this month"', () => {
    const month: SmartRule = { type: 'birthday', window: 'this_month' };
    expect(matchesRule(month, facts({ dateOfBirth: '1990-10-01' }), TODAY)).toBe(true);
    expect(matchesRule(month, facts({ dateOfBirth: '1990-10-31' }), TODAY)).toBe(true);
    expect(matchesRule(month, facts({ dateOfBirth: '1990-11-01' }), TODAY)).toBe(false);
  });

  it('leaves out patients without a date of birth instead of guessing', () => {
    expect(matchesRule(today, facts({ dateOfBirth: null }), TODAY)).toBe(false);
  });
});

describe('recall due', () => {
  it('recalls a patient whose last completed visit is 6 months ago and who has nothing booked', () => {
    expect(matchesRule(recall, facts({ lastCompletedVisitOn: '2026-04-07' }), TODAY)).toBe(true);
    expect(matchesRule(recall, facts({ lastCompletedVisitOn: '2026-04-08' }), TODAY)).toBe(false);
  });

  it('still recalls a patient who booked a check-up and did not come: only completed visits count', () => {
    const missedCheckUp = facts({ lastCompletedVisitOn: '2026-01-10', lastNoShowOn: '2026-09-20' });
    expect(matchesRule(recall, missedCheckUp, TODAY)).toBe(true);
  });

  it('does not recall a patient who already has an appointment booked', () => {
    expect(matchesRule(recall, facts({ lastCompletedVisitOn: '2026-01-10', nextBookingOn: '2026-10-20' }), TODAY)).toBe(false);
  });

  it('does not count an emergency visit as the check-up when the recall is for consultations', () => {
    const rule: SmartRule = { type: 'recall_due', months: 6, visitTypes: ['consultation'] };
    const onlyEmergencyLately = facts({
      lastCompletedVisitOn: '2026-09-30',
      lastCompletedByType: { consultation: '2026-01-05', emergency: '2026-09-30' }
    });
    expect(matchesRule(rule, onlyEmergencyLately, TODAY)).toBe(true);
  });

  it('never recalls someone the practice has not seen yet', () => {
    expect(matchesRule(recall, facts({ lastCompletedVisitOn: null, lastCompletedByType: {} }), TODAY)).toBe(false);
  });
});

describe('lapsed patients', () => {
  const lapsed: SmartRule = { type: 'lapsed', months: 12 };

  it('counts a patient as lapsed from 12 months after the last completed visit', () => {
    expect(matchesRule(lapsed, facts({ lastCompletedVisitOn: '2025-10-07' }), TODAY)).toBe(true);
    expect(matchesRule(lapsed, facts({ lastCompletedVisitOn: '2025-11-07' }), TODAY)).toBe(false);
  });

  it('does not send "we miss you" to someone who has already booked their return', () => {
    expect(matchesRule(lapsed, facts({ lastCompletedVisitOn: '2024-01-01', nextBookingOn: TODAY }), TODAY)).toBe(false);
  });
});

describe('outstanding balance', () => {
  const owing: SmartRule = { type: 'outstanding_balance', minDays: 30, minAmount: 100 };

  it('lists a patient who has owed N$ 450 for 45 days', () => {
    expect(matchesRule(owing, facts({ balanceDue: 450, oldestUnpaidOn: '2026-08-23' }), TODAY)).toBe(true);
  });

  it('gives a new invoice time to be paid before reminding', () => {
    expect(matchesRule(owing, facts({ balanceDue: 450, oldestUnpaidOn: '2026-09-20' }), TODAY)).toBe(false);
  });

  it('does not chase amounts below the practice\'s minimum', () => {
    expect(matchesRule(owing, facts({ balanceDue: 99.99, oldestUnpaidOn: '2026-01-01' }), TODAY)).toBe(false);
  });

  it('never lists a patient who owes nothing, even with a N$ 0 minimum', () => {
    const anyAmount: SmartRule = { type: 'outstanding_balance', minDays: 0, minAmount: 0 };
    expect(matchesRule(anyAmount, facts({ balanceDue: 0, oldestUnpaidOn: null }), TODAY)).toBe(false);
  });
});

describe('missed appointment follow-up', () => {
  const missed: SmartRule = { type: 'missed_appointment', withinDays: 14 };

  it('follows up a no-show from last week who has not been back or rebooked', () => {
    expect(matchesRule(missed, facts({ lastNoShowOn: '2026-10-01', lastCompletedVisitOn: '2026-06-01' }), TODAY)).toBe(true);
  });

  it('drops the patient once they came in later, even the same day', () => {
    expect(matchesRule(missed, facts({ lastNoShowOn: '2026-10-01', lastCompletedVisitOn: '2026-10-01' }), TODAY)).toBe(false);
  });

  it('drops the patient once they rebooked', () => {
    expect(matchesRule(missed, facts({ lastNoShowOn: '2026-10-01', nextBookingOn: '2026-10-09' }), TODAY)).toBe(false);
  });

  it('lets old no-shows go after the follow-up window', () => {
    expect(matchesRule(missed, facts({ lastNoShowOn: '2026-09-22', lastCompletedVisitOn: null }), TODAY)).toBe(false);
  });
});

describe('regular follow-up', () => {
  const regular: SmartRule = { type: 'regular_follow_up', everyDays: 30, minVisitsInYear: 3 };

  it('reminds a regular patient (3+ visits a year) whose last visit is 30+ days ago', () => {
    expect(matchesRule(regular, facts({ completedVisitsLastYear: 4, lastCompletedVisitOn: '2026-09-01' }), TODAY)).toBe(true);
  });

  it('leaves out occasional patients, who are not on a regular follow-up', () => {
    expect(matchesRule(regular, facts({ completedVisitsLastYear: 1, lastCompletedVisitOn: '2026-08-01' }), TODAY)).toBe(false);
  });

  it('waits until the follow-up is due', () => {
    expect(matchesRule(regular, facts({ completedVisitsLastYear: 6, lastCompletedVisitOn: '2026-09-20' }), TODAY)).toBe(false);
  });
});

describe('validateRule', () => {
  it('accepts a stored rule and normalises visit types, so "Consultation" matches the database value', () => {
    expect(validateRule({ type: 'recall_due', months: 6, visitTypes: [' Consultation ', 'consultation'] })).toEqual({
      ok: true,
      rule: { type: 'recall_due', months: 6, visitTypes: ['consultation'] }
    });
  });

  it('rejects rules that would match the wrong people instead of guessing', () => {
    expect(validateRule({ type: 'recall_due', months: 0 }).ok).toBe(false);
    expect(validateRule({ type: 'lapsed', months: '12' }).ok).toBe(false);
    expect(validateRule({ type: 'birthday', window: 'next_year' }).ok).toBe(false);
    expect(validateRule({ type: 'outstanding_balance', minDays: 30, minAmount: -5 }).ok).toBe(false);
    expect(validateRule({ type: 'something_else' }).ok).toBe(false);
    expect(validateRule(null).ok).toBe(false);
  });

  it('accepts a minimum amount in cents such as N$ 450.10', () => {
    expect(validateRule({ type: 'outstanding_balance', minDays: 30, minAmount: 450.1 }).ok).toBe(true);
  });
});

describe('toPatientFacts', () => {
  it('reads numbers sent as text and keeps an unknown opt-out as "not opted out"', () => {
    const parsed = toPatientFacts({
      patient_id: 'p9',
      first_name: ' Ndapewa ',
      last_name: 'Nangolo',
      date_of_birth: '1979-06-30',
      cell_number: ' ',
      sms_opt_out: null,
      last_completed_visit_on: '2026-02-01',
      last_completed_by_type: { Consultation: '2026-02-01' },
      completed_visits_12m: '3',
      next_booking_on: null,
      next_booking_time: '09:30:00',
      last_no_show_on: null,
      balance_due: '450.10',
      oldest_unpaid_on: '2026-08-01'
    });
    expect(parsed).toMatchObject({
      firstName: 'Ndapewa',
      cellNumber: null,
      smsOptOut: false,
      completedVisitsLastYear: 3,
      nextBookingTime: '09:30',
      balanceDue: 450.1,
      lastCompletedByType: { consultation: '2026-02-01' }
    });
  });
});

describe('resolveListMembers', () => {
  const row = (overrides: Partial<ListMemberRow>): ListMemberRow => ({
    list_id: 'L1',
    patient_id: 'p1',
    source: 'rule',
    excluded: false,
    added_at: null,
    last_sent_at: null,
    last_sent_period: null,
    ...overrides
  });
  const everyone = [
    facts({ patientId: 'p1', lastName: 'Shikongo', lastCompletedVisitOn: '2025-01-01' }),
    facts({ patientId: 'p2', lastName: 'Amutenya', lastCompletedVisitOn: '2025-02-01' }),
    facts({ patientId: 'p3', lastName: 'Kandjii', lastCompletedVisitOn: '2026-09-30' })
  ];

  it('keeps an excluded patient off a smart list even though the rule still matches them', () => {
    const resolved = resolveListMembers({
      kind: 'smart',
      rule: recall,
      facts: everyone,
      rows: [row({ patient_id: 'p1', excluded: true })],
      listId: 'L1',
      todayKey: TODAY
    });
    expect(resolved.members.map((member) => member.patientId)).toEqual(['p2']);
    expect(resolved.excluded.map((member) => member.patientId)).toEqual(['p1']);
  });

  it('adds a patient staff put on a smart list by hand, alongside the automatic members', () => {
    const resolved = resolveListMembers({
      kind: 'smart',
      rule: recall,
      facts: everyone,
      rows: [row({ patient_id: 'p3', source: 'manual' })],
      listId: 'L1',
      todayKey: TODAY
    });
    expect(resolved.members.map((member) => [member.patientId, member.automatic, member.manual])).toEqual([
      ['p2', true, false],
      ['p3', false, true],
      ['p1', true, false]
    ]);
  });

  it('shows only hand-picked patients on a manual list, ignoring rows of other lists', () => {
    const resolved = resolveListMembers({
      kind: 'manual',
      rule: null,
      facts: everyone,
      rows: [row({ patient_id: 'p2', source: 'manual' }), row({ list_id: 'L2', patient_id: 'p1', source: 'manual' })],
      listId: 'L1',
      todayKey: TODAY
    });
    expect(resolved.members.map((member) => member.patientId)).toEqual(['p2']);
  });

  it('keeps the send history of a member, which the once-per-period check needs', () => {
    const resolved = resolveListMembers({
      kind: 'smart',
      rule: recall,
      facts: everyone,
      rows: [row({ patient_id: 'p2', last_sent_period: '2026-10', last_sent_at: '2026-10-01T07:00:00Z' })],
      listId: 'L1',
      todayKey: TODAY
    });
    expect(resolved.members.find((member) => member.patientId === 'p2')?.lastSentPeriod).toBe('2026-10');
  });

  it('leaves out patients the facts no longer contain (for example removed from the practice)', () => {
    const resolved = resolveListMembers({
      kind: 'manual',
      rule: null,
      facts: everyone,
      rows: [row({ patient_id: 'gone', source: 'manual' })],
      listId: 'L1',
      todayKey: TODAY
    });
    expect(resolved.members).toEqual([]);
  });
});
