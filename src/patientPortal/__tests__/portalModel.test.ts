import { describe, expect, it } from 'vitest';
import {
  appointmentStatus,
  formatDay,
  formatTime,
  groupResults,
  releasedResultsOnly,
  splitAppointments,
  toAppointment,
  toLinkedPatient,
  toPortalRequest,
} from '../portalModel';

// Wednesday 7 Oct 2026, 10:00 in Windhoek
const NOW = new Date('2026-10-07T08:00:00Z');

const resultRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  lab_request_id: 'req-1',
  request_date: '2026-10-01',
  lab_facility: 'PathCare Windhoek',
  test_name: 'Haemoglobin',
  test_value: '10.2',
  test_unit: 'g/dL',
  reference_range: '12.0-16.0',
  released_at: '2026-10-05T09:00:00Z',
  released_to_patient: true,
  ...overrides,
});

describe('lab results in the patient app: only what the doctor released', () => {
  it('never shows a result the doctor has not released, even if one ever reached the app', () => {
    // Clinical safety: a patient must not read a worrying result before the doctor has seen it
    const shown = releasedResultsOnly([
      resultRow(),
      resultRow({ id: 'r2', released_to_patient: false }),
      resultRow({ id: 'r3', released_to_patient: null }),
      resultRow({ id: 'r4', released_to_patient: 'true' }),
      resultRow({ id: 'r5', released_to_patient: undefined }),
    ]);
    expect(shown.map((result) => result.id)).toEqual(['r1']);
  });

  it('shows the value with its unit and reference range, flagged against the range', () => {
    const [result] = releasedResultsOnly([resultRow()]);
    expect(result).toMatchObject({ value: '10.2', unit: 'g/dL', referenceRange: '12.0-16.0', status: 'low' });
    expect(releasedResultsOnly([resultRow({ test_value: '13.1' })])[0].status).toBe('normal');
  });

  it('groups results by lab request, the latest released first', () => {
    const groups = groupResults(
      releasedResultsOnly([
        resultRow({ id: 'a', lab_request_id: 'old', released_at: '2026-09-01T09:00:00Z' }),
        resultRow({ id: 'b', lab_request_id: 'new', released_at: '2026-10-05T09:00:00Z' }),
        resultRow({ id: 'c', lab_request_id: 'new', test_name: 'WBC', released_at: '2026-10-05T09:00:00Z' }),
      ])
    );
    expect(groups.map((group) => [group.key, group.results.length])).toEqual([
      ['new', 2],
      ['old', 1],
    ]);
  });
});

describe('appointments in the patient app', () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    visit_id: 'v1',
    practice_id: 'practice-1',
    practice_name: 'Klein Windhoek Clinic',
    scheduled_date: '2026-10-09',
    scheduled_time: '09:30:00',
    status: 'scheduled',
    is_cancelled: false,
    is_checked_in: false,
    is_confirmed: false,
    visit_type: 'follow_up',
    doctor_name: 'Dr N. Amutenya',
    ...overrides,
  });

  it('splits upcoming (soonest first) from earlier visits (newest first)', () => {
    const appointments = [
      row({ visit_id: 'later', scheduled_date: '2026-10-20' }),
      row({ visit_id: 'soon' }),
      row({ visit_id: 'seen', scheduled_date: '2026-09-01', status: 'completed' }),
      row({ visit_id: 'cancelled', scheduled_date: '2026-10-15', status: 'cancelled', is_cancelled: true }),
    ].map((r) => toAppointment(r, 'pat-1')!);
    const { upcoming, past } = splitAppointments(appointments, NOW);
    expect(upcoming.map((a) => a.visit.id)).toEqual(['soon', 'later']);
    // A cancelled appointment in the future is not "coming up"
    expect(past.map((a) => a.visit.id)).toEqual(['cancelled', 'seen']);
  });

  it('labels each appointment in plain words', () => {
    const at = (overrides: Record<string, unknown>) => appointmentStatus(toAppointment(row(overrides), 'pat-1')!, NOW).label;
    expect(at({})).toBe('Booked');
    expect(at({ is_confirmed: true })).toBe('Confirmed');
    expect(at({ status: 'no-show' })).toBe('Missed');
    expect(at({ status: 'completed' })).toBe('Seen');
    expect(at({ is_checked_in: true })).toBe('At the practice');
    expect(at({ scheduled_date: '2026-10-06' })).toBe('Time passed');
  });

  it('keeps the patient id on the visit so the app runs the same cancel checks as the server', () => {
    expect(toAppointment(row(), 'pat-1')?.visit.patient_id).toBe('pat-1');
    expect(toAppointment({ practice_id: 'x' }, 'pat-1')).toBeNull();
  });
});

describe('dates and records', () => {
  it('writes dates day first, as Namibians read them', () => {
    expect(formatDay('2026-10-09')).toBe('Fri 9 Oct 2026');
    expect(formatDay('2026-10-09T12:00:00Z')).toBe('Fri 9 Oct 2026');
    expect(formatDay(null)).toBeNull();
    expect(formatTime('09:30:00')).toBe('09:30');
  });

  // Saved times are UTC; a request sent at 01:30 in Windhoek on the 9th is 23:30 UTC on the 8th
  it('shows the Windhoek day of a moment, not the UTC day', () => {
    expect(formatDay('2026-10-08T23:30:00Z')).toBe('Fri 9 Oct 2026');
    expect(formatDay('2026-10-08T23:30:00.000+00:00')).toBe('Fri 9 Oct 2026');
    expect(formatDay('2026-10-08T21:59:00Z')).toBe('Thu 8 Oct 2026');
  });

  it('shows bank details only when the practice set both bank and account number', () => {
    const base = { patient_id: 'p1', relationship: 'self', first_name: 'Maria', last_name: 'Nghipondoka' };
    expect(toLinkedPatient({ ...base, bank_name: 'FNB Namibia', bank_account_number: '62012345678' })?.bank).toMatchObject({
      bankName: 'FNB Namibia',
      accountNumber: '62012345678',
    });
    expect(toLinkedPatient({ ...base, bank_name: 'FNB Namibia' })?.bank).toBeNull();
    expect(toLinkedPatient({ ...base, relationship: 'spouse' })?.relationship).toBe('self');
  });

  it('ignores request rows with an unknown kind or status instead of showing them wrongly', () => {
    const base = { id: 'q1', patient_id: 'p1', created_at: '2026-10-07T08:00:00Z', kind: 'book', status: 'pending' };
    expect(toPortalRequest(base)).toMatchObject({ kind: 'book', status: 'pending' });
    expect(toPortalRequest({ ...base, kind: 'refund' })).toBeNull();
    expect(toPortalRequest({ ...base, status: 'lost' })).toBeNull();
  });
});
