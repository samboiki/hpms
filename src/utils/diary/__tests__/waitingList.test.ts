import { describe, it, expect } from 'vitest';
import {
  bookingPrefillFor,
  cleanDays,
  describeDays,
  freeMinutesFrom,
  describeOffer,
  describePreferences,
  describeTimes,
  fitsSlot,
  freedSlotOf,
  isLapsedEntry,
  isOpenEntry,
  normalizeWaitingListRow,
  offerMessage,
  OFFER_REPLY_INVITE,
  sortWaitingList,
  validateWaitingListDraft,
  waitingNow,
  whoCouldTake,
  type DiarySlot,
  type WaitingListDraft,
  type WaitingListEntry
} from '../waitingList';
import { interpretReply } from '../../../../supabase/functions/_shared/smsReplyIntent';
import { maySendToOptedOutPatient, replyContextFor } from '../../../../supabase/functions/_shared/smsMessagePolicy';
import { OFFER_SMS_SOURCE, OFFER_SMS_TYPE, smsOfferState } from '../waitingList';

// Invented patients and practitioners. 13 Oct 2026 is a Tuesday.
const TODAY = '2026-10-13';
const NOW = { date: TODAY, minutes: 9 * 60 };

const entry = (id: string, extra: Partial<WaitingListEntry> = {}): WaitingListEntry => ({
  id,
  patient: { id: `p-${id}`, firstName: 'Maria', lastName: 'Shikongo', cellNumber: '0811234567', smsOptOut: false },
  practitionerId: 'pr-a',
  appointmentTypeId: null,
  lengthMinutes: 15,
  days: [],
  from: null,
  to: null,
  until: '2026-10-31',
  current: null,
  note: null,
  status: 'waiting',
  offer: null,
  bookedVisitId: null,
  createdAt: '2026-10-01T08:00:00Z',
  ...extra
});

const slot = (extra: Partial<DiarySlot> = {}): DiarySlot => ({ practitionerId: 'pr-a', date: '2026-10-14', time: '10:30', lengthMinutes: 30, ...extra });

describe('fitsSlot (could this patient take the freed time?)', () => {
  it('offers a time with the practitioner the patient asked for, on a day and at a time that suit them', () => {
    expect(fitsSlot(entry('a', { days: [3], from: '08:00', to: '12:00' }), slot(), NOW)).toBe(true);
  });

  it('never offers a time with another practitioner than the one asked for, but "any practitioner" takes any', () => {
    expect(fitsSlot(entry('a'), slot({ practitionerId: 'pr-b' }), NOW)).toBe(false);
    expect(fitsSlot(entry('a', { practitionerId: null }), slot({ practitionerId: 'pr-b' }), NOW)).toBe(true);
  });

  it('respects the days and the time window the patient can come (a working patient cannot come at 10:30)', () => {
    expect(fitsSlot(entry('a', { days: [1, 5] }), slot(), NOW)).toBe(false); // Wednesday
    expect(fitsSlot(entry('a', { from: '14:00' }), slot(), NOW)).toBe(false);
    expect(fitsSlot(entry('a', { to: '10:40' }), slot(), NOW)).toBe(false); // 10:30 + 15 min ends after 10:40
    expect(fitsSlot(entry('a', { to: '10:45' }), slot(), NOW)).toBe(true);
  });

  it('needs a time long enough for what the patient needs', () => {
    expect(fitsSlot(entry('a', { lengthMinutes: 45 }), slot({ lengthMinutes: 30 }), NOW)).toBe(false);
  });

  it('only offers a time earlier than the booking the patient already has (they asked for earlier, not later)', () => {
    const current = { visitId: 'v-later', date: '2026-10-20', time: '09:00' };
    expect(fitsSlot(entry('a', { current }), slot(), NOW)).toBe(true);
    expect(fitsSlot(entry('a', { current: { ...current, date: '2026-10-14', time: '10:30' } }), slot(), NOW)).toBe(false);
    expect(fitsSlot(entry('a', { current: { ...current, date: '2026-10-14', time: '08:00' } }), slot(), NOW)).toBe(false);
  });

  it('never offers a time that has passed or lies after the last day the patient waits', () => {
    expect(fitsSlot(entry('a'), slot({ date: TODAY, time: '08:30' }), NOW)).toBe(false);
    expect(fitsSlot(entry('a'), slot({ date: '2026-11-02' }), NOW)).toBe(false);
  });

  it('skips patients who were booked, taken off the list, or whose last day passed', () => {
    expect(fitsSlot(entry('a', { status: 'booked' }), slot(), NOW)).toBe(false);
    expect(fitsSlot(entry('a', { status: 'removed' }), slot(), NOW)).toBe(false);
    expect(fitsSlot(entry('a', { until: '2026-10-12' }), slot(), NOW)).toBe(false);
    // Offered someone else's time earlier: still waiting for theirs
    expect(fitsSlot(entry('a', { status: 'offered' }), slot(), NOW)).toBe(true);
  });
});

describe('whoCouldTake (first come, first served)', () => {
  it('lists whoever waited longest first, so nobody is skipped because reception knows another patient better', () => {
    const list = [
      entry('late', { createdAt: '2026-10-10T08:00:00Z' }),
      entry('early', { createdAt: '2026-09-20T08:00:00Z' }),
      entry('other-practitioner', { practitionerId: 'pr-b', createdAt: '2026-09-01T08:00:00Z' })
    ];
    expect(whoCouldTake(list, slot(), NOW).map((e) => e.id)).toEqual(['early', 'late']);
  });
});

describe('the list as reception reads it', () => {
  it('shows open entries first and the ones whose last day passed after them, so they can be removed', () => {
    const list = [entry('lapsed', { until: '2026-10-01', createdAt: '2026-09-01T00:00:00Z' }), entry('open'), entry('booked', { status: 'booked' })];
    expect(sortWaitingList(list, TODAY).map((e) => e.id)).toEqual(['open', 'lapsed']);
    expect(isOpenEntry(list[1], TODAY)).toBe(true);
    expect(isLapsedEntry(list[0], TODAY)).toBe(true);
  });

  it('describes what suits the patient in plain words', () => {
    expect(describeDays([])).toBe('Any day');
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe('Any day');
    expect(describeDays([5, 1, 3])).toBe('Mon, Wed and Fri');
    expect(describeTimes('08:00', '12:00')).toBe('08:00-12:00');
    expect(describeTimes(null, '11:00')).toBe('Until 11:00');
    expect(describePreferences({ days: [2], from: null, to: null, until: '2026-10-31' })).toBe('Tue, any time, until 31 Oct 2026');
    expect(describeOffer({ date: '2026-10-14', time: '10:30', practitionerId: 'pr-a', at: null })).toBe('Offered Wed 14 Oct at 10:30');
  });
});

describe('validateWaitingListDraft', () => {
  const draft = (extra: Partial<WaitingListDraft> = {}): WaitingListDraft => ({
    patientId: 'p-1',
    practitionerId: 'pr-a',
    appointmentTypeId: null,
    lengthMinutes: 15,
    days: [5, 1, 1, 9],
    from: '8:00',
    to: '12:00',
    until: '2026-10-31',
    currentVisitId: null,
    note: '  Can come at short notice  ',
    ...extra
  });

  it('keeps a usable entry tidy: days once each and in week order, times as HH:mm, the note trimmed', () => {
    const result = validateWaitingListDraft(draft(), TODAY);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ days: [1, 5], from: '08:00', to: '12:00', note: 'Can come at short notice', until: '2026-10-31' })
    });
  });

  it('refuses what would never match: no patient, a window shorter than the visit, a last day in the past or a year away', () => {
    const errorsOf = (extra: Partial<WaitingListDraft>) => {
      const result = validateWaitingListDraft(draft(extra), TODAY);
      return result.ok ? [] : result.errors;
    };
    expect(errorsOf({ patientId: null })).toContain('Choose the patient who is waiting.');
    expect(errorsOf({ from: '10:00', to: '10:10' })[0]).toMatch(/room for the whole appointment/);
    expect(errorsOf({ until: '2026-10-12' })[0]).toMatch(/cannot be in the past/);
    expect(errorsOf({ until: '2027-10-14' })[0]).toMatch(/at most a year/);
    expect(errorsOf({ from: '25:00' })[0]).toMatch(/not a time of day/);
    expect(errorsOf({ note: 'x'.repeat(301) })[0]).toMatch(/300 characters/);
  });
});

describe('cleanDays', () => {
  it('drops anything that is not a day of the week', () => {
    expect(cleanDays([0, 6, 7, -1, 'x', 3])).toEqual([3, 6, 0]);
    expect(cleanDays(null)).toEqual([]);
  });
});

describe('normalizeWaitingListRow', () => {
  const row = {
    id: 'w-1',
    patient_id: 'p-1',
    patient: { id: 'p-1', first_name: 'Maria', last_name: 'Shikongo', cell_number: '0811234567' },
    practitioner_id: 'pr-a',
    appointment_type_id: null,
    length_minutes: 20,
    preferred_days: [1, 3],
    preferred_from: '08:00:00',
    preferred_to: null,
    wait_until: '2026-10-31',
    current_visit_id: 'v-1',
    current: { scheduled_date: '2026-10-28', scheduled_time: '14:00:00', status: 'scheduled', is_cancelled: false },
    note: null,
    status: 'offered',
    offered_date: '2026-10-14',
    offered_time: '10:30:00',
    offered_practitioner_id: 'pr-a',
    offered_at: '2026-10-13T08:00:00Z',
    created_at: '2026-10-01T08:00:00Z'
  };

  it('reads a row with its patient, the booking it wants earlier and the open offer', () => {
    const entryRead = normalizeWaitingListRow(row);
    expect(entryRead).toMatchObject({
      id: 'w-1',
      patient: { firstName: 'Maria', cellNumber: '0811234567' },
      lengthMinutes: 20,
      days: [1, 3],
      from: '08:00',
      to: null,
      current: { visitId: 'v-1', date: '2026-10-28', time: '14:00' },
      offer: { date: '2026-10-14', time: '10:30' }
    });
  });

  // The same flag a STOP reply sets and every other SMS honours; anything but true (missing before the two-way SMS
  // update, null) is not an opt-out, as for the SMS gateway
  it("reads the patient's STOP reply (patients.sms_opt_out)", () => {
    expect(normalizeWaitingListRow({ ...row, patient: { ...row.patient, sms_opt_out: true } })?.patient.smsOptOut).toBe(true);
    expect(normalizeWaitingListRow({ ...row, patient: { ...row.patient, sms_opt_out: null } })?.patient.smsOptOut).toBe(false);
    expect(normalizeWaitingListRow(row)?.patient.smsOptOut).toBe(false);
  });

  it('forgets the booking to move once it was cancelled: any earlier time then suits', () => {
    expect(normalizeWaitingListRow({ ...row, current: { ...row.current, is_cancelled: true } })?.current).toBeNull();
  });

  it('refuses rows it cannot use', () => {
    expect(normalizeWaitingListRow({ ...row, status: 'sideways' })).toBeNull();
    expect(normalizeWaitingListRow({ ...row, wait_until: 'soon' })).toBeNull();
    expect(normalizeWaitingListRow(null)).toBeNull();
  });
});

describe('offerMessage (the SMS that offers a freed time)', () => {
  const input = {
    practiceName: 'Example Family Practice',
    practicePhone: '061 123 456',
    patientFirstName: 'Maria',
    practitionerName: 'Dr A Nangolo',
    date: '2026-10-14',
    time: '10:30'
  };

  it('asks for YES or NO only while the practice collects replies, otherwise asks the patient to call', () => {
    expect(offerMessage({ ...input, repliesLive: true })).toBe(
      `Example Family Practice: Hi Maria, an earlier time came free: Wed 14 Oct at 10:30 with Dr A Nangolo. ${OFFER_REPLY_INVITE}`
    );
    expect(offerMessage({ ...input, repliesLive: false })).toBe(
      'Example Family Practice: Hi Maria, an earlier time came free: Wed 14 Oct at 10:30 with Dr A Nangolo. Call 061 123 456 to take it.'
    );
  });

  it('fits one SMS by shortening a long practice name, never the time or the instruction', () => {
    const text = offerMessage({ ...input, practiceName: 'The Very Long Named Family and Occupational Health Practice of Windhoek', repliesLive: true });
    expect(text.length).toBeLessThanOrEqual(160);
    expect(text).toContain('Wed 14 Oct at 10:30');
    expect(text.endsWith(OFFER_REPLY_INVITE)).toBe(true);
  });

  it('is sent so that a YES is read as "wants the slot" and NO as declined, never as confirming another booking', () => {
    const context = replyContextFor({ messageType: OFFER_SMS_TYPE, metadata: { source: OFFER_SMS_SOURCE } });
    expect(context).toBe('waitlist_offer');
    expect(interpretReply('Yes please', context).intent).toBe('waitlist_accept');
    expect(interpretReply('1', context).intent).toBe('waitlist_accept');
    expect(interpretReply('no', context).intent).toBe('waitlist_decline');
  });

  // A patient who replied STOP asked for no SMS: an earlier time is not care they booked, so the gateway must refuse it
  // for them, also when their number replied STOP from another patient file (a shared family phone)
  it('is a type the SMS gateway never sends to a number that replied STOP', () => {
    expect(maySendToOptedOutPatient(OFFER_SMS_TYPE, { source: OFFER_SMS_SOURCE })).toBe(false);
  });
});

describe('smsOfferState (may the time be offered by SMS?)', () => {
  const patient = entry('s1').patient;

  it('never for a patient who replied STOP, whatever number is on file: reception phones them instead', () => {
    expect(smsOfferState({ ...patient, smsOptOut: true })).toBe('asked_for_no_sms');
    expect(smsOfferState({ ...patient, smsOptOut: true, cellNumber: null })).toBe('asked_for_no_sms');
  });

  it('only to a number that can take an SMS', () => {
    expect(smsOfferState(patient)).toBe('can_offer');
    expect(smsOfferState({ ...patient, cellNumber: 'no number' })).toBe('no_cell_number');
    expect(smsOfferState({ ...patient, cellNumber: null })).toBe('no_cell_number');
  });
});

describe('waitingNow', () => {
  // fitsSlot never offers a time that has passed: "now" must be the practice's day and time, also on a computer set to
  // another time zone, or a freed time just after midnight would be refused (or a passed one offered)
  it('is the Windhoek date and time, in the shape fitsSlot reads', () => {
    expect(waitingNow(new Date('2026-10-13T22:30:00Z'))).toEqual({ date: '2026-10-14', minutes: 30 });
    const entry14 = entry('n1', { days: [] });
    expect(fitsSlot(entry14, slot({ date: '2026-10-14', time: '00:15' }), waitingNow(new Date('2026-10-13T22:30:00Z')))).toBe(false);
    expect(fitsSlot(entry14, slot({ date: '2026-10-14', time: '00:45' }), waitingNow(new Date('2026-10-13T22:30:00Z')))).toBe(true);
  });
});

describe('freeMinutesFrom (how long is free from the time reception clicked?)', () => {
  const bookings = [
    { doctor_id: 'pr-a', date: '2026-10-14', time: '09:00', duration: 30 },
    { doctor_id: 'pr-a', date: '2026-10-14', time: '11:00:00', duration: 15 },
    { doctor_id: 'pr-a', date: '2026-10-14', time: '10:00', duration: 30, status: 'cancelled' },
    { doctor_id: 'pr-b', date: '2026-10-14', time: '10:15', duration: 30 },
    { doctor_id: 'pr-a', date: '2026-10-15', time: '10:15', duration: 30 }
  ];

  // Only patients who fit the free time are suggested: counting a cancelled booking, another practitioner's diary or
  // another day would hide patients who could come
  it('runs to the practitioner\'s next booking that day, ignoring cancelled ones and other diaries', () => {
    expect(freeMinutesFrom(bookings, 'pr-a', '2026-10-14', '10:00')).toBe(60);
  });

  it('is nothing when a booking already holds that time, and runs to the end of the day after the last one', () => {
    expect(freeMinutesFrom(bookings, 'pr-a', '2026-10-14', '09:15')).toBe(0);
    expect(freeMinutesFrom(bookings, 'pr-a', '2026-10-14', '23:00')).toBe(60);
    expect(freeMinutesFrom(bookings, 'pr-a', '2026-10-14', 'not a time')).toBe(0);
  });
});

// Cancel Visit, Delete Booking and the Reschedule form's Cancel Appointment all offer the same freed time
describe('freedSlotOf (the time a cancelled booking frees)', () => {
  it("is the booking's practitioner, day, start and length", () => {
    expect(freedSlotOf({ doctor_id: 'pr-1', date: '2026-10-14T00:00:00', time: '9:30:00', duration: 45 })).toEqual({
      practitionerId: 'pr-1',
      date: '2026-10-14',
      time: '09:30',
      lengthMinutes: 45
    });
  });

  it("frees nobody's time when the booking had no practitioner, day or time", () => {
    expect(freedSlotOf({ doctor_id: '', date: '2026-10-14', time: '09:30', duration: 30 })).toBeNull();
    expect(freedSlotOf({ doctor_id: 'pr-1', date: '', time: '09:30', duration: 30 })).toBeNull();
    expect(freedSlotOf({ doctor_id: 'pr-1', date: '2026-10-14', time: '', duration: 30 })).toBeNull();
  });
});

describe('bookingPrefillFor (booking a waiting patient)', () => {
  // The booking form starts with what the patient asked for, so reception does not type it twice or book the wrong length
  it('starts the booking form with the patient, practitioner, length, type and note from the list', () => {
    const waiting = entry('w1', { lengthMinutes: 45, appointmentTypeId: 'type-1', note: 'Prefers mornings' });
    expect(bookingPrefillFor(waiting, { visitType: 'follow-up' })).toEqual({
      patientId: 'p-w1',
      patientName: 'Maria Shikongo',
      patientFirstName: 'Maria',
      practitionerId: 'pr-a',
      type: 'follow-up',
      durationMinutes: 45,
      reason: 'Prefers mornings',
      appointmentTypeId: 'type-1'
    });
    expect(bookingPrefillFor(entry('w2'), null).type).toBe('consultation');
  });
});
