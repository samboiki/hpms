/**
 * The diary's waiting list (parity B21): reads diary_waiting_list and writes it through its functions
 * (proposals/2026-10-13-diary-waiting-list.sql), finds free times that suit an entry (diary_free_slots, the diary's own
 * rules on the server) and sends an offer by SMS through centralized-sms-gateway (communicationService), only after
 * reception confirmed the number and the text. The rules are in src/utils/diary/waitingList.ts. Before the SQL is
 * applied the table is missing: loads say 'not_set_up' and the diary works as before.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { communicationService, getCommunicationErrorMessage } from './communicationService';
import { normalizePhoneNumber } from '../components/patients/patientContact';
import { isMissingColumnError, isMissingFunctionError, isMissingTableError, isPermissionError } from '../utils/diary/dbErrors';
import { isOptedOutSmsError } from '../utils/patientLists/listSend';
import { addDaysToKey, timeToMinutes } from '../utils/diary/diaryTime';
import {
  OFFER_SMS_SOURCE,
  OFFER_SMS_TYPE,
  WAITING_LIST_TABLE,
  fitsSlot,
  normalizeWaitingListRow,
  type DiarySlot,
  type WaitingListEntry,
  type WaitingListValue
} from '../utils/diary/waitingList';

// The new table and functions are not in the generated database types yet: rows are read untyped and checked
const db = supabase as unknown as SupabaseClient;

export const WAITING_LIST_NOT_SET_UP_MESSAGE =
  'The waiting list is not set up yet. Your administrator needs to apply the diary update first; until then the diary works as before.';

// The patient's sms_opt_out (replied STOP) decides whether a time may be offered by SMS. Before the two-way SMS update
// the column is missing and, as for the SMS gateway, nobody has opted out.
const entryColumns = (patientColumns: string) =>
  `*, patient:patients!diary_waiting_list_patient_id_fkey(${patientColumns}), ` +
  'current:visits!diary_waiting_list_current_visit_id_fkey(scheduled_date, scheduled_time, visit_date, visit_time, status, is_cancelled)';
const PATIENT_COLUMNS = 'id, first_name, last_name, cell_number, sms_opt_out';
const PATIENT_COLUMNS_BEFORE_TWO_WAY_SMS = 'id, first_name, last_name, cell_number';

export type WaitingListLoad = { state: 'ready'; entries: WaitingListEntry[] } | { state: 'not_set_up' } | { state: 'error'; message: string };

/** The practice's entries still on the list (waiting or offered), whatever their last day. Never throws: the diary
 * loads it on opening and keeps working without it. */
export async function loadWaitingList(practiceId: string): Promise<WaitingListLoad> {
  try {
    const read = (patientColumns: string) =>
      db
        .from(WAITING_LIST_TABLE)
        .select(entryColumns(patientColumns))
        .eq('practice_id', practiceId)
        .in('status', ['waiting', 'offered'])
        .order('created_at', { ascending: true })
        .limit(500);
    let { data, error } = await read(PATIENT_COLUMNS);
    if (error && isMissingColumnError(error)) ({ data, error } = await read(PATIENT_COLUMNS_BEFORE_TWO_WAY_SMS));
    if (error) {
      if (isMissingTableError(error, WAITING_LIST_TABLE)) return { state: 'not_set_up' };
      console.error('Could not load the waiting list:', error);
      return { state: 'error', message: 'Could not load the waiting list. Please try again.' };
    }
    return {
      state: 'ready',
      entries: ((data ?? []) as unknown[]).map(normalizeWaitingListRow).filter((entry): entry is WaitingListEntry => entry !== null)
    };
  } catch (error) {
    console.error('Could not load the waiting list:', error);
    return { state: 'error', message: 'Could not load the waiting list. Please try again.' };
  }
}

export type WaitingListWrite = { ok: true; id: string } | { ok: false; message: string; notSetUp?: boolean };

// The functions refuse in plain words (a patient already on the list, a day in the past, another practice's booking)
const PLAIN_REFUSALS = new Set(['22023', '23505', 'P0002', '23514']);

function refusal(error: { code?: string; message?: string } | null, functionName: string): { ok: false; message: string; notSetUp?: boolean } {
  if (isMissingFunctionError(error, functionName)) return { ok: false, notSetUp: true, message: WAITING_LIST_NOT_SET_UP_MESSAGE };
  if (isPermissionError(error) || PLAIN_REFUSALS.has(error?.code ?? '')) return { ok: false, message: error?.message || 'Not saved.' };
  console.error(`Could not save (${functionName}):`, error);
  return { ok: false, message: `Not saved: ${error?.message ?? 'unknown error'}` };
}

/** Adds a patient to the list (entryId null) or changes their open entry, after validateWaitingListDraft. */
export async function saveWaitingListEntry(entryId: string | null, value: WaitingListValue): Promise<WaitingListWrite> {
  const { data, error } = await db.rpc('save_waiting_list_entry', {
    p_entry_id: entryId,
    p_entry: {
      patient_id: value.patientId,
      practitioner_id: value.practitionerId,
      appointment_type_id: value.appointmentTypeId,
      length_minutes: value.lengthMinutes,
      preferred_days: value.days,
      preferred_from: value.from,
      preferred_to: value.to,
      wait_until: value.until,
      current_visit_id: value.currentVisitId,
      note: value.note
    }
  });
  return error ? refusal(error, 'save_waiting_list_entry') : { ok: true, id: String(data) };
}

/** Records the time offered to the patient (after the SMS went out, or they were phoned). */
export async function recordWaitingListOffer(entryId: string, slot: DiarySlot): Promise<WaitingListWrite> {
  const { error } = await db.rpc('record_waiting_list_offer', {
    p_entry_id: entryId,
    p_date: slot.date,
    p_time: slot.time,
    p_practitioner_id: slot.practitionerId
  });
  return error ? refusal(error, 'record_waiting_list_offer') : { ok: true, id: entryId };
}

/** Takes the patient off the list: booked (with their new booking) or removed. */
export async function closeWaitingListEntry(entryId: string, outcome: 'booked' | 'removed', visitId?: string | null): Promise<WaitingListWrite> {
  const { error } = await db.rpc('close_waiting_list_entry', { p_entry_id: entryId, p_outcome: outcome, p_visit_id: visitId ?? null });
  return error ? refusal(error, 'close_waiting_list_entry') : { ok: true, id: entryId };
}

export type FreeTimesLoad = { state: 'ready'; slots: DiarySlot[] } | { state: 'error'; message: string };

/**
 * The first free times that suit the entry, from now until its last day (at most 31 days: the server's limit). The
 * server works out free times with the diary's own rules (working hours, breaks, blocked time, holidays, bookings) for
 * the entry's appointment type, else a consultation's length; fitsSlot then keeps those on the patient's days and
 * times, long enough and earlier than their own booking.
 */
export async function findFreeTimesFor(
  practiceId: string,
  entry: WaitingListEntry,
  now: { date: string; minutes: number },
  limit = 5
): Promise<FreeTimesLoad> {
  let days = 0;
  while (days < 31 && addDaysToKey(now.date, days) <= entry.until) days += 1;
  if (days === 0) return { state: 'ready', slots: [] };
  const { data, error } = await db.rpc('diary_free_slots', {
    p_practice_id: practiceId,
    p_from: now.date,
    p_days: days,
    p_practitioner_id: entry.practitionerId,
    p_appointment_type_id: entry.appointmentTypeId,
    p_visit_type: null
  });
  if (error) {
    if (isMissingFunctionError(error, 'diary_free_slots')) {
      return { state: 'error', message: 'Free times cannot be looked up yet: the diary update with free slots is not applied.' };
    }
    console.error('Could not look up free times:', error);
    return { state: 'error', message: 'Could not look up the free times. Please try again.' };
  }
  const slots = ((data ?? []) as Array<Record<string, unknown>>)
    .map((row): DiarySlot | null => {
      const minutes = timeToMinutes(typeof row.slot_time === 'string' ? row.slot_time : null);
      if (typeof row.practitioner_id !== 'string' || typeof row.slot_date !== 'string' || minutes === null) return null;
      return {
        practitionerId: row.practitioner_id,
        date: row.slot_date.slice(0, 10),
        time: `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
        lengthMinutes: Number(row.length_minutes) || 0
      };
    })
    .filter((slot): slot is DiarySlot => slot !== null && fitsSlot(entry, slot, now))
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  return { state: 'ready', slots: slots.slice(0, limit) };
}

export type OfferSend = { ok: true; recorded: boolean; message?: string } | { ok: false; message: string };

export const ASKED_FOR_NO_SMS_MESSAGE = 'Not sent: this number asked for no SMS (it replied STOP). Phone the patient instead.';

/**
 * Sends the offer through the practice's SMS gateway, then records it on the entry. Called only from the confirmation
 * step (the number and the text shown first). Never to a patient who asked for no SMS: the SMS is a waitlist offer
 * (OFFER_SMS_TYPE), which the gateway does not send to a number that replied STOP, and the patient's YES reaches the
 * SMS Replies inbox as "wants the slot" and never confirms another booking.
 */
export async function sendWaitingListOffer(request: {
  practiceId: string;
  entry: WaitingListEntry;
  slot: DiarySlot;
  message: string;
}): Promise<OfferSend> {
  if (request.entry.patient.smsOptOut) return { ok: false, message: ASKED_FOR_NO_SMS_MESSAGE };
  const phone = normalizePhoneNumber(request.entry.patient.cellNumber);
  if (!phone) return { ok: false, message: 'The patient has no cell number that can receive an SMS.' };
  try {
    const response = await communicationService.sendSMS({
      practiceId: request.practiceId,
      recipientPhone: phone,
      messageContent: request.message,
      messageType: OFFER_SMS_TYPE,
      patientId: request.entry.patient.id,
      metadata: {
        source: OFFER_SMS_SOURCE,
        waiting_list_id: request.entry.id,
        offered_date: request.slot.date,
        offered_time: request.slot.time,
        offered_practitioner_id: request.slot.practitionerId
      },
      tags: [OFFER_SMS_SOURCE]
    });
    if (!response.success) {
      // The gateway refuses a number that replied STOP, also from another patient file (a shared family phone)
      if (isOptedOutSmsError(response.error)) return { ok: false, message: ASKED_FOR_NO_SMS_MESSAGE };
      return { ok: false, message: getCommunicationErrorMessage('sms', response.error) };
    }
  } catch (error) {
    console.error('Could not send the offer:', error);
    return { ok: false, message: 'Could not send the SMS. Check your connection and try again.' };
  }
  const recorded = await recordWaitingListOffer(request.entry.id, request.slot);
  return recorded.ok
    ? { ok: true, recorded: true }
    : { ok: true, recorded: false, message: `The SMS was sent, but the offer could not be noted on the list: ${recorded.message}` };
}

/** The practice's name and phone, which every offer SMS carries */
export async function loadOfferPractice(practiceId: string): Promise<{ name: string | null; phone: string | null }> {
  const { data, error } = await db.from('practices').select('name, contact_phone').eq('id', practiceId).maybeSingle();
  if (error) console.error('Could not read the practice for the offer SMS:', error);
  const row = (data ?? null) as { name?: string | null; contact_phone?: string | null } | null;
  return { name: row?.name ?? null, phone: row?.contact_phone ?? null };
}

export interface PatientBooking {
  visitId: string;
  /** 'yyyy-MM-dd' */
  date: string;
  /** 'HH:mm' or null */
  time: string | null;
  practitionerId: string | null;
}

/** The patient's bookings from today on that still hold their place: the one they may want earlier. */
export async function loadUpcomingBookings(patientId: string, todayKey: string): Promise<PatientBooking[]> {
  const { data, error } = await db
    .from('visits')
    .select('id, scheduled_date, scheduled_time, doctor_id')
    .eq('patient_id', patientId)
    .gte('scheduled_date', todayKey)
    .not('is_cancelled', 'is', true)
    .not('status', 'in', '(cancelled,no-show,completed)')
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(10);
  if (error) {
    console.error("Could not load the patient's bookings:", error);
    return [];
  }
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => typeof row.id === 'string' && typeof row.scheduled_date === 'string')
    .map((row) => ({
      visitId: row.id as string,
      date: (row.scheduled_date as string).slice(0, 10),
      time: typeof row.scheduled_time === 'string' ? row.scheduled_time.slice(0, 5) : null,
      practitionerId: typeof row.doctor_id === 'string' ? row.doctor_id : null
    }));
}
