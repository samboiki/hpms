import { describe, it, expect } from 'vitest';
import { addDaysToKey } from '../../billing/dates';
import {
  CONTACT_LENS_OVERDUE_DAYS,
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

// Business rule (parity O3): when the practitioner sets a recall date ("review blood pressure in 2 weeks", "check-up in
// 12 months"), that date decides when reception calls, not the list's general months rule
describe('recall due with the patient\'s own recall date', () => {
  it('recalls the patient on their recall date even when the months rule would wait (a 2-week review)', () => {
    const seenLastWeek = facts({ lastCompletedVisitOn: '2026-09-30', recallOn: TODAY, recallReason: 'Review blood pressure' });
    expect(matchesRule(recall, seenLastWeek, TODAY)).toBe(true);
  });

  it('keeps an overdue recall on the list until the patient books', () => {
    expect(matchesRule(recall, facts({ lastCompletedVisitOn: '2026-01-10', recallOn: '2026-09-01' }), TODAY)).toBe(true);
  });

  it('does not call a patient before their own recall date, even when the months rule says they are due', () => {
    const recalledForNextYear = facts({ lastCompletedVisitOn: '2026-01-10', recallOn: addDaysToKey(TODAY, 1) });
    expect(matchesRule(recall, recalledForNextYear, TODAY)).toBe(false);
  });

  it('does not call a patient who already booked', () => {
    expect(matchesRule(recall, facts({ recallOn: '2026-09-01', nextBookingOn: '2026-10-20' }), TODAY)).toBe(false);
  });

  it('recalls a new patient whose recall was set by hand, though the practice has no completed visit yet', () => {
    expect(matchesRule(recall, facts({ lastCompletedVisitOn: null, lastCompletedByType: {}, recallOn: TODAY }), TODAY)).toBe(true);
  });

  it('leaves "recall by treatment" alone: a recall for something else does not move a treatment recall', () => {
    const rule: SmartRule = { type: 'recall_by_code', months: 6, codes: ['8159'] };
    const cleaningDue = facts({ lastBilledByCode: { '8159': '2026-03-02' }, recallOn: '2027-01-15' });
    expect(matchesRule(rule, cleaningDue, TODAY)).toBe(true);
  });
});

// Business rule: a recall should follow the treatment the patient had (scale and polish every 6 months),
// as the practice's previous software did, not just "any visit": a patient seen last month for a
// toothache is still due for the cleaning they had 7 months ago.
describe('recall by treatment', () => {
  const scaling: SmartRule = { type: 'recall_by_code', months: 6, codes: ['8159'] };

  it('recalls a patient whose last 8159 was 6 months ago, even after a later visit for something else', () => {
    const patient = facts({ lastCompletedVisitOn: '2026-09-20', lastBilledByCode: { '8159': '2026-04-07', '8101': '2026-09-20' } });
    expect(matchesRule(scaling, patient, TODAY)).toBe(true);
  });

  it('waits until 6 months have passed, and leaves out patients who never had the treatment', () => {
    expect(matchesRule(scaling, facts({ lastBilledByCode: { '8159': '2026-04-08' } }), TODAY)).toBe(false);
    expect(matchesRule(scaling, facts({ lastBilledByCode: { '8101': '2025-01-01' } }), TODAY)).toBe(false);
    expect(matchesRule(scaling, facts(), TODAY)).toBe(false);
  });

  it('does not recall a patient who already has an appointment booked', () => {
    expect(matchesRule(scaling, facts({ lastBilledByCode: { '8159': '2025-12-01' }, nextBookingOn: '2026-10-20' }), TODAY)).toBe(false);
  });

  it('uses the most recent of several codes', () => {
    const rule: SmartRule = { type: 'recall_by_code', months: 6, codes: ['8159', '8155'] };
    expect(matchesRule(rule, facts({ lastBilledByCode: { '8159': '2025-12-01', '8155': '2026-08-01' } }), TODAY)).toBe(false);
  });

  it('reads the dates the database returns and accepts only 4-digit codes', () => {
    const row = { patient_id: 'p1', first_name: 'A', last_name: 'B', date_of_birth: null, cell_number: null, sms_opt_out: null, last_completed_visit_on: null,
      last_completed_by_type: null, last_billed_by_code: { ' 8159 ': '2026-04-07', bad: 12 }, completed_visits_12m: 0, next_booking_on: null,
      next_booking_time: null, last_no_show_on: null, balance_due: 0, oldest_unpaid_on: null };
    expect(toPatientFacts(row).lastBilledByCode).toEqual({ '8159': '2026-04-07' });
    expect(validateRule({ type: 'recall_by_code', months: 6, codes: ['8159', ' 8159', '8161'] })).toEqual({ ok: true, rule: { type: 'recall_by_code', months: 6, codes: ['8159', '8161'] } });
    expect(validateRule({ type: 'recall_by_code', months: 6, codes: [] }).ok).toBe(false);
    expect(validateRule({ type: 'recall_by_code', months: 6, codes: ['815'] }).ok).toBe(false);
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

  it('reads the patient\'s recall date and reason, and none before the recalls proposal is applied', () => {
    const base = {
      patient_id: 'p9', first_name: 'A', last_name: 'B', date_of_birth: null, cell_number: null, sms_opt_out: false,
      last_completed_visit_on: null, last_completed_by_type: null, completed_visits_12m: 0, next_booking_on: null,
      next_booking_time: null, last_no_show_on: null, balance_due: 0, oldest_unpaid_on: null
    };
    expect(toPatientFacts({ ...base, recall_on: '2027-04-12', recall_reason: ' 6-monthly check-up ' })).toMatchObject({
      recallOn: '2027-04-12',
      recallReason: '6-monthly check-up'
    });
    expect(toPatientFacts(base)).toMatchObject({ recallOn: null, recallReason: null });
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

// A dispensing practice reminds patients before their chronic medicine runs out (proposals/2026-10-07-dispensing-and-stock.sql
// gives the due day: the last dispensing of a script with repeats left plus its days of medicine)
describe('repeat medicine due', () => {
  const rule: SmartRule = { type: 'repeat_medicine_due', withinDays: 7 };

  it('lists repeats due in the next 7 days and overdue ones, not later ones, so the reminder comes before the medicine runs out', () => {
    expect(matchesRule(rule, facts({ nextRepeatDueOn: '2026-10-14' }), TODAY)).toBe(true);
    expect(matchesRule(rule, facts({ nextRepeatDueOn: '2026-10-15' }), TODAY)).toBe(false);
    expect(matchesRule(rule, facts({ nextRepeatDueOn: '2026-09-30' }), TODAY)).toBe(true);
    expect(matchesRule(rule, facts({ nextRepeatDueOn: null }), TODAY)).toBe(false);
    expect(matchesRule(rule, facts(), TODAY)).toBe(false); // a database without the dispensing update: nobody
  });

  it('leaves out a patient booked in by the due day (the repeat is given then), but not one booked weeks later', () => {
    expect(matchesRule(rule, facts({ nextRepeatDueOn: '2026-10-12', nextBookingOn: '2026-10-10' }), TODAY)).toBe(false);
    expect(matchesRule(rule, facts({ nextRepeatDueOn: '2026-10-12', nextBookingOn: '2026-12-01' }), TODAY)).toBe(true);
    expect(matchesRule(rule, facts({ nextRepeatDueOn: '2026-10-01', nextBookingOn: TODAY }), TODAY)).toBe(false);
  });

  it('accepts 0 to 60 days, and reads the due day the database returns', () => {
    expect(validateRule({ type: 'repeat_medicine_due', withinDays: 0 })).toEqual({ ok: true, rule: { type: 'repeat_medicine_due', withinDays: 0 } });
    expect(validateRule({ type: 'repeat_medicine_due', withinDays: 61 }).ok).toBe(false);
    expect(validateRule({ type: 'repeat_medicine_due', withinDays: '7' }).ok).toBe(false);
    const row = { patient_id: 'p1', first_name: 'A', last_name: 'B', date_of_birth: null, cell_number: null, sms_opt_out: null, last_completed_visit_on: null,
      last_completed_by_type: null, completed_visits_12m: 0, next_booking_on: null, next_booking_time: null, last_no_show_on: null, balance_due: 0,
      oldest_unpaid_on: null };
    expect(toPatientFacts({ ...row, next_repeat_due_on: '2026-10-12' }).nextRepeatDueOn).toBe('2026-10-12');
    expect(toPatientFacts(row).nextRepeatDueOn).toBeNull();
  });
});

// An optometry practice reminds contact-lens wearers before their supply runs out (proposals/2026-10-08-optometry.sql
// gives the day: the latest run-out day of the supplies the patient collected)
describe('contact lenses running out', () => {
  const rule: SmartRule = { type: 'contact_lenses_running_out', withinDays: 14 };

  it('lists supplies running out in the next 14 days and those that ran out lately, so the patient can order in time', () => {
    expect(matchesRule(rule, facts({ contactLensesRunOutOn: '2026-10-21' }), TODAY)).toBe(true);
    expect(matchesRule(rule, facts({ contactLensesRunOutOn: '2026-10-22' }), TODAY)).toBe(false);
    expect(matchesRule(rule, facts({ contactLensesRunOutOn: '2026-09-30' }), TODAY)).toBe(true);
    expect(matchesRule(rule, facts(), TODAY)).toBe(false); // a database without the optometry update: nobody
  });

  it('stops after three months out: the patient most likely buys elsewhere now (the lapsed list is for them)', () => {
    expect(matchesRule(rule, facts({ contactLensesRunOutOn: addDaysToKey(TODAY, -CONTACT_LENS_OVERDUE_DAYS) }), TODAY)).toBe(true);
    expect(matchesRule(rule, facts({ contactLensesRunOutOn: addDaysToKey(TODAY, -CONTACT_LENS_OVERDUE_DAYS - 1) }), TODAY)).toBe(false);
  });

  it('leaves out a patient booked in by the day the lenses run out, but not one booked weeks later', () => {
    expect(matchesRule(rule, facts({ contactLensesRunOutOn: '2026-10-15', nextBookingOn: '2026-10-12' }), TODAY)).toBe(false);
    expect(matchesRule(rule, facts({ contactLensesRunOutOn: '2026-10-15', nextBookingOn: '2026-12-01' }), TODAY)).toBe(true);
  });

  it('accepts 0 to 60 days, and reads the run-out day the database returns', () => {
    expect(validateRule({ type: 'contact_lenses_running_out', withinDays: 0 })).toEqual({ ok: true, rule: { type: 'contact_lenses_running_out', withinDays: 0 } });
    expect(validateRule({ type: 'contact_lenses_running_out', withinDays: 61 }).ok).toBe(false);
    const row = { patient_id: 'p1', first_name: 'A', last_name: 'B', date_of_birth: null, cell_number: null, sms_opt_out: null, last_completed_visit_on: null,
      last_completed_by_type: null, completed_visits_12m: 0, next_booking_on: null, next_booking_time: null, last_no_show_on: null, balance_due: 0,
      oldest_unpaid_on: null };
    expect(toPatientFacts({ ...row, contact_lenses_run_out_on: '2026-10-20' }).contactLensesRunOutOn).toBe('2026-10-20');
    expect(toPatientFacts(row).contactLensesRunOutOn).toBeNull();
  });
});
