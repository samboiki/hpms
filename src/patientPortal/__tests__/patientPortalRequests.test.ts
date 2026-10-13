import { describe, expect, it } from 'vitest';
import {
  appendAppCancellationNote,
  APP_CANCELLATION_NOTE,
  checkVisitChange,
  PORTAL_REQUEST_LIMITS,
  requestableDateRange,
  validatePortalRequest,
} from '../../../supabase/functions/_shared/patientPortalRequests.ts';
import type { SmsVisit } from '../../../supabase/functions/_shared/smsReplyPlan.ts';

// Wednesday 7 Oct 2026, 10:00 in Windhoek (UTC+2)
const NOW = new Date('2026-10-07T08:00:00Z');
const OWNER = { patientId: 'pat-1', practiceId: 'practice-1' };

const visit = (overrides: Partial<SmsVisit> = {}): SmsVisit => ({
  id: 'visit-1',
  practice_id: 'practice-1',
  patient_id: 'pat-1',
  status: 'scheduled',
  is_cancelled: false,
  is_checked_in: false,
  scheduled_date: '2026-10-09',
  scheduled_time: '09:30',
  ...overrides,
});

const book = (overrides: Record<string, unknown> = {}, pendingForPatient = 0) =>
  validatePortalRequest(
    { kind: 'book', patientId: 'pat-1', preferredDate: '2026-10-08', preferredTime: 'morning', message: 'Check-up', ...overrides },
    { now: NOW, pendingForPatient }
  );

describe('booking requests: reception still chooses the slot', () => {
  it('accepts a day from tomorrow, with a time of day and a reason', () => {
    expect(book()).toEqual({
      ok: true,
      request: { kind: 'book', patientId: 'pat-1', visitId: null, preferredDate: '2026-10-08', preferredTime: 'morning', message: 'Check-up' },
    });
  });

  it('sends same-day needs to the phone: a request might only be read tomorrow', () => {
    expect(book({ preferredDate: '2026-10-07' })).toMatchObject({ ok: false, field: 'preferredDate', message: expect.stringMatching(/phone the practice/) });
  });

  it(`refuses days more than ${PORTAL_REQUEST_LIMITS.maxDaysAhead} days ahead and dates that do not exist`, () => {
    const { last } = requestableDateRange(NOW);
    expect(book({ preferredDate: last }).ok).toBe(true);
    expect(book({ preferredDate: '2027-01-06' }).ok).toBe(false);
    expect(book({ preferredDate: '2026-11-31' }).ok).toBe(false);
  });

  it('uses the clinic\'s date: just after midnight in Windhoek is already the next day', () => {
    // 22:30 UTC on 7 Oct is 00:30 on 8 Oct in Windhoek, so "tomorrow" is the 9th
    expect(requestableDateRange(new Date('2026-10-07T22:30:00Z')).first).toBe('2026-10-09');
  });

  it(`stops a patient from flooding reception: at most ${PORTAL_REQUEST_LIMITS.maxPendingPerPatient} requests waiting`, () => {
    expect(book({}, PORTAL_REQUEST_LIMITS.maxPendingPerPatient)).toMatchObject({ ok: false, field: 'limit' });
  });

  it('keeps messages short and the time of day to the listed choices', () => {
    expect(book({ message: 'x'.repeat(PORTAL_REQUEST_LIMITS.maxMessageLength + 1) })).toMatchObject({ ok: false, field: 'message' });
    expect(book({ preferredTime: 'midnight' })).toMatchObject({ ok: false, field: 'preferredTime' });
    expect(book({ preferredTime: null })).toMatchObject({ ok: true, request: { preferredTime: 'any' } });
  });

  it('refuses kinds the app does not offer (a cancel is not a request: it happens at once)', () => {
    expect(validatePortalRequest({ kind: 'cancel', patientId: 'pat-1' }, { now: NOW, pendingForPatient: 0 })).toMatchObject({ ok: false, field: 'kind' });
  });
});

describe('cancelling or moving an appointment in the app', () => {
  it('allows the patient\'s own scheduled appointment, more than the cut-off ahead', () => {
    expect(checkVisitChange(visit(), OWNER, NOW)).toEqual({ ok: true });
  });

  it(`stops ${PORTAL_REQUEST_LIMITS.cancelCutoffHours} hours before the start: the practice needs a call to fill the slot`, () => {
    const soon = visit({ scheduled_date: '2026-10-07', scheduled_time: '11:30' }); // 1.5 hours away
    expect(checkVisitChange(soon, OWNER, NOW)).toMatchObject({ ok: false, code: 'too_late', message: expect.stringMatching(/phone the practice/) });
    const justOutside = visit({ scheduled_date: '2026-10-07', scheduled_time: '12:01' });
    expect(checkVisitChange(justOutside, OWNER, NOW)).toEqual({ ok: true });
  });

  it('never touches another patient\'s appointment, even one on the same phone', () => {
    expect(checkVisitChange(visit({ patient_id: 'sister' }), OWNER, NOW)).toMatchObject({ ok: false, message: 'This appointment was not found.' });
    expect(checkVisitChange(null, OWNER, NOW)).toMatchObject({ ok: false, code: 'missing' });
  });

  it('leaves visits that started, finished or were cancelled to the practice', () => {
    expect(checkVisitChange(visit({ is_checked_in: true }), OWNER, NOW)).toMatchObject({ ok: false, code: 'under_way' });
    expect(checkVisitChange(visit({ status: 'completed' }), OWNER, NOW)).toMatchObject({ ok: false, code: 'completed' });
    expect(checkVisitChange(visit({ status: 'cancelled' }), OWNER, NOW)).toMatchObject({ ok: false, message: 'This appointment is already cancelled.' });
    expect(checkVisitChange(visit({ scheduled_date: '2026-10-01' }), OWNER, NOW)).toMatchObject({ ok: false, code: 'past' });
  });

  it('a new time is a request for reception, once per appointment', () => {
    const request = { kind: 'reschedule', patientId: 'pat-1', visitId: 'visit-1', preferredDate: '2026-10-12', preferredTime: 'afternoon' };
    const context = { now: NOW, pendingForPatient: 0, visit: visit(), patientPracticeId: 'practice-1' };
    expect(validatePortalRequest(request, context)).toMatchObject({ ok: true, request: { kind: 'reschedule', visitId: 'visit-1' } });
    expect(validatePortalRequest(request, { ...context, pendingForVisit: 1 })).toMatchObject({ ok: false, field: 'visit' });
    expect(validatePortalRequest(request, { ...context, visit: visit({ is_checked_in: true }) })).toMatchObject({ ok: false, field: 'visit' });
  });

  it('marks the visit so staff can see the patient cancelled it in the app', () => {
    expect(appendAppCancellationNote(null)).toBe(APP_CANCELLATION_NOTE);
    expect(appendAppCancellationNote('Bring X-rays')).toBe(`Bring X-rays\n\n${APP_CANCELLATION_NOTE}`);
  });
});

describe('profile changes', () => {
  it('need a message saying what to change; staff update the file themselves', () => {
    const context = { now: NOW, pendingForPatient: 0 };
    expect(validatePortalRequest({ kind: 'profile_change', patientId: 'pat-1', message: '  ' }, context)).toMatchObject({ ok: false, field: 'message' });
    expect(validatePortalRequest({ kind: 'profile_change', patientId: 'pat-1', message: 'New address: 12 Feld St, Windhoek' }, context)).toMatchObject({
      ok: true,
      request: { kind: 'profile_change', preferredDate: null, message: 'New address: 12 Feld St, Windhoek' },
    });
  });
});
