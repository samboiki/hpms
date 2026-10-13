import { describe, expect, it } from 'vitest';
import type { PatientRecall } from '../../patientLists/recalls';
import { missedAppointmentReason, movedRecalls, noShowRecalls, reportRecallsMessage } from '../reportRecalls';

const TODAY = '2026-10-13';
const recall = (id: string, patientId: string, dueOn: string, reason: string, status: PatientRecall['status'] = 'open'): PatientRecall => ({
  id,
  patientId,
  dueOn,
  reason,
  visitId: null,
  createdAt: null,
  status,
  matchedVisitId: null,
  matchedOn: null
});

// A patient moved to a recall list was only a list entry: never due on the "Recall due" list, never closed by booking
describe('no-shows moved to a recall list', () => {
  it('get a recall for today that names their latest missed day, so staff call them now', () => {
    expect(noShowRecalls([{ patientId: 'p1', dates: ['2026-10-02', '2026-10-07'] }], [], TODAY)).toEqual([
      { patientId: 'p1', dueOn: TODAY, reason: 'Missed appointment on 7 Oct 2026', recallId: null }
    ]);
  });

  it('do not get the same recall twice when staff move them again on another day', () => {
    const held = [recall('r1', 'p1', '2026-10-08', missedAppointmentReason('2026-10-07'))];
    expect(noShowRecalls([{ patientId: 'p1', dates: ['2026-10-07'] }], held, TODAY)).toEqual([]);
    // Booked already: the recall is done once they come, so no new one either
    const booked = [recall('r1', 'p1', '2026-10-08', 'missed appointment on 7 oct 2026', 'booked')];
    expect(noShowRecalls([{ patientId: 'p1', dates: ['2026-10-07'] }], booked, TODAY)).toEqual([]);
  });

  it('get a new recall after a later miss, even when an older one was seen or removed', () => {
    const old = [recall('r1', 'p1', '2026-09-01', missedAppointmentReason('2026-08-31'), 'seen')];
    expect(noShowRecalls([{ patientId: 'p1', dates: ['2026-10-07'] }], old, TODAY)).toHaveLength(1);
  });
});

describe('recalled but not seen, moved to a recall list', () => {
  it('moves each passed recall to today with its own reason (due now, done once they book)', () => {
    const notSeen = [recall('r1', 'p1', '2026-10-01', '6-monthly check-up'), recall('r2', 'p2', '2026-10-20', 'Annual check-up')];
    expect(movedRecalls(notSeen, TODAY)).toEqual([{ patientId: 'p1', dueOn: TODAY, reason: '6-monthly check-up', recallId: 'r1' }]);
  });

  it('leaves recalls already booked, seen or removed alone', () => {
    const done = (['booked', 'seen', 'removed'] as const).map((status, index) => recall(`r${index}`, 'p1', '2026-10-01', 'Check-up', status));
    expect(movedRecalls(done, TODAY)).toEqual([]);
  });
});

describe('what staff read afterwards', () => {
  it('says how many recalls were set and when they close', () => {
    expect(reportRecallsMessage('no_shows', { set: 3, refused: 0, firstRefusal: null })).toEqual({
      text: '3 recalls set for today: each closes when the patient books.',
      tone: 'success'
    });
    expect(reportRecallsMessage('not_seen', { set: 1, refused: 0, firstRefusal: null }).text).toBe('1 recall moves to today: each closes when the patient books.');
  });

  it("names a refusal in the database's own words, so staff know which rule stopped it", () => {
    expect(reportRecallsMessage('no_shows', { set: 2, refused: 1, firstRefusal: 'This patient already has 10 recalls to come: remove one first.' })).toEqual({
      text: '2 recalls set for today; 1 could not be set: This patient already has 10 recalls to come: remove one first.',
      tone: 'error'
    });
  });

  it('says so when everyone already had the recall', () => {
    expect(reportRecallsMessage('no_shows', { set: 0, refused: 0, firstRefusal: null }).text).toBe('Everyone listed already has this recall to do.');
  });
});
