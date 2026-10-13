import { describe, it, expect } from 'vitest';
import {
  RECALL_INTERVALS,
  headlineRecall,
  recallInputProblem,
  recalledNotSeen,
  sortRecallsForFile,
  tidyRecallReason,
  toPatientRecall,
  type PatientRecall
} from '../recalls';

const TODAY = '2026-10-12';

const recall = (overrides: Partial<PatientRecall> = {}): PatientRecall => ({
  id: 'r1',
  patientId: 'p1',
  dueOn: '2026-10-01',
  reason: '6-monthly check-up',
  visitId: null,
  createdAt: null,
  status: 'open',
  matchedVisitId: null,
  matchedOn: null,
  ...overrides
});

describe('what staff type', () => {
  it('accepts a date from today and a short reason, so a recall can be set at the end of the visit', () => {
    expect(recallInputProblem({ dueOn: TODAY, reason: 'Review blood pressure' }, TODAY)).toBeNull();
  });

  it('refuses a date that has passed, because the database refuses it too and the patient could never be recalled for it', () => {
    expect(recallInputProblem({ dueOn: '2026-10-11', reason: 'Check-up' }, TODAY)).toMatch(/passed/);
  });

  it('refuses a date more than five years ahead (a typing slip such as 2062)', () => {
    expect(recallInputProblem({ dueOn: '2031-10-13', reason: 'Check-up' }, TODAY)).toMatch(/five years/);
    expect(recallInputProblem({ dueOn: '2031-10-12', reason: 'Check-up' }, TODAY)).toBeNull();
  });

  it('asks what the recall is for: a date without a reason does not tell reception what to book', () => {
    expect(recallInputProblem({ dueOn: TODAY, reason: '  x ' }, TODAY)).toMatch(/what the recall is for/);
    expect(recallInputProblem({ dueOn: TODAY, reason: 'a'.repeat(121) }, TODAY)).toMatch(/120/);
  });

  it('tidies spaces the way the database stores the reason', () => {
    expect(tidyRecallReason('  Review   blood pressure ')).toBe('Review blood pressure');
  });

  it('offers quick dates from today, 6 months on the same day of the month', () => {
    const sixMonths = RECALL_INTERVALS.find((interval) => interval.id === '6m');
    expect(sixMonths?.dateFrom(TODAY)).toBe('2027-04-12');
    expect(RECALL_INTERVALS.find((interval) => interval.id === '2w')?.dateFrom(TODAY)).toBe('2026-10-26');
  });
});

describe('reading recalls from the database', () => {
  it('keeps the status the database worked out, so the screen never decides "done" on its own', () => {
    const row = { id: 'r1', patient_id: 'p1', due_on: '2027-04-12', reason: ' Check-up ', status: 'booked', matched_visit_id: 'v9', matched_on: '2027-04-10' };
    expect(toPatientRecall(row)).toMatchObject({ status: 'booked', reason: 'Check-up', matchedVisitId: 'v9', matchedOn: '2027-04-10' });
  });

  it('skips a row without a date or patient instead of showing a blank recall', () => {
    expect(toPatientRecall({ id: 'r1', patient_id: 'p1', due_on: null, reason: 'x', status: 'open' })).toBeNull();
    expect(toPatientRecall({ id: 'r1', patient_id: null, due_on: '2027-01-01', reason: 'x', status: 'open' })).toBeNull();
  });
});

describe('the recall on the patient file', () => {
  it('shows the earliest recall still to do', () => {
    const recalls = [recall({ id: 'a', dueOn: '2027-04-12' }), recall({ id: 'b', dueOn: '2026-11-01' }), recall({ id: 'c', status: 'seen', dueOn: '2026-01-01' })];
    expect(headlineRecall(recalls)?.id).toBe('b');
    expect(sortRecallsForFile(recalls).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('shows a booked recall when nothing else is to do, so reception sees it is taken care of', () => {
    expect(headlineRecall([recall({ id: 'a', status: 'booked' }), recall({ id: 'b', status: 'removed' })])?.id).toBe('a');
    expect(headlineRecall([recall({ status: 'seen' })])).toBeNull();
  });
});

// Business rule (parity O5): Eminance's "No shows" report lists patients who were recalled and did not come, so the
// practice can try again; a patient who booked (or came) is not on it
describe('recalled but not seen', () => {
  const range = { from: '2026-09-01', to: '2026-10-31' };

  it('lists recalls of the period whose date has passed without a booking that completes them', () => {
    const recalls = [
      recall({ id: 'late', dueOn: '2026-09-05' }),
      recall({ id: 'earlier', dueOn: '2026-09-02' }),
      recall({ id: 'booked', dueOn: '2026-09-10', status: 'booked' }),
      recall({ id: 'seen', dueOn: '2026-09-10', status: 'seen' }),
      recall({ id: 'removed', dueOn: '2026-09-10', status: 'removed' })
    ];
    expect(recalledNotSeen(recalls, range, TODAY).map((item) => item.id)).toEqual(['earlier', 'late']);
  });

  it('leaves out recalls not yet due (today or later): they were not missed', () => {
    expect(recalledNotSeen([recall({ dueOn: TODAY }), recall({ id: 'r2', dueOn: '2026-10-20' })], range, TODAY)).toEqual([]);
  });

  it('leaves out recalls outside the period chosen', () => {
    expect(recalledNotSeen([recall({ dueOn: '2026-08-31' })], range, TODAY)).toEqual([]);
  });
});
