/**
 * Video consultations in the diary (parity B16): the practice's default room link (practice_settings
 * 'video_consult_link', which only practice administrators may change: that table's own policies) and a booking's
 * room link (visits.video_link, proposals/2026-10-13-video-bookings.sql). The rules are in
 * src/utils/diary/videoBookings.ts; this file only talks to Supabase. Before the SQL is applied visits has no
 * video_link column: a booking is saved without its link and the booking form says video bookings are not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingColumnError, isPermissionError } from '../utils/diary/dbErrors';
import {
  VIDEO_LINK_SETTING_KEY,
  checkVideoLink,
  defaultVideoLinkFromSetting,
  storedVideoLink,
  type NextBookingVideo
} from '../utils/diary/videoBookings';

// The new column is not in the generated database types yet
const db = supabase as unknown as SupabaseClient;

export const VIDEO_NOT_SET_UP_MESSAGE =
  'Video bookings are not set up yet: the booking is saved without its room link. Your administrator needs to apply the diary update first.';

// Once the database said visits has no video_link column, stop asking until the page is reloaded
let videoColumnMissing = false;

/** True once a save found that visits has no video_link column yet */
export const videoBookingsNotSetUp = (): boolean => videoColumnMissing;

const namesVideoColumn = (error: unknown): boolean => {
  if (!isMissingColumnError(error)) return false;
  const message = String((error as { message?: unknown })?.message ?? '');
  return message === '' || message.includes('video_link');
};

/**
 * Saves a visit with its room link (null: seen in the rooms; undefined: leave the link as it is). When the database
 * does not have the column yet, saves it again without the link, so the booking itself is never lost.
 */
export async function writeWithVideoLink<T>(
  link: string | null | undefined,
  write: (videoFields: { video_link?: string | null }) => PromiseLike<{ data: T | null; error: unknown }>
): Promise<{ data: T | null; error: unknown; videoSkipped: boolean }> {
  const fields = link === undefined || videoColumnMissing ? {} : { video_link: link };
  const first = await write(fields);
  if (first.error && 'video_link' in fields && namesVideoColumn(first.error)) {
    videoColumnMissing = true;
    const again = await write({});
    return { ...again, videoSkipped: link !== null };
  }
  return { ...first, videoSkipped: videoColumnMissing && !!link };
}

export type BookingVideoLoad = { state: 'ready'; link: string | null } | { state: 'not_set_up' } | { state: 'error'; message: string };

/** The room link a booking keeps, read when the booking form opens it for a change. Never throws: the form opens without it */
export const loadBookingVideoLink = (visitId: string): Promise<BookingVideoLoad> =>
  readBookingVideoLink(visitId).catch((error: unknown): BookingVideoLoad => {
    console.error("Could not read the booking's video link:", error);
    return { state: 'error', message: "The booking's video link could not be read." };
  });

async function readBookingVideoLink(visitId: string): Promise<BookingVideoLoad> {
  const { data, error } = await db.from('visits').select('video_link').eq('id', visitId).maybeSingle();
  if (error) {
    if (namesVideoColumn(error)) {
      videoColumnMissing = true;
      return { state: 'not_set_up' };
    }
    console.error('Could not read the booking\'s video link:', error);
    return { state: 'error', message: error.message };
  }
  return { state: 'ready', link: storedVideoLink((data as { video_link?: unknown } | null)?.video_link) };
}

/**
 * The patient's next booking from today on (not cancelled, not missed, not seen yet) and its room link, for a message's
 * {{videoLink}}. undefined when it cannot be read (or before the video bookings update): the field is then not filled.
 * Never throws, so the message window's other facts load whatever happens here.
 */
export const loadNextBookingVideoLink = (patientId: string, todayKey: string): Promise<NextBookingVideo | null | undefined> =>
  readNextBookingVideoLink(patientId, todayKey).catch((error: unknown) => {
    console.error("Could not read the patient's next booking:", error);
    return undefined;
  });

async function readNextBookingVideoLink(patientId: string, todayKey: string): Promise<NextBookingVideo | null | undefined> {
  const { data, error } = await db
    .from('visits')
    .select('scheduled_date, scheduled_time, video_link')
    .eq('patient_id', patientId)
    .gte('scheduled_date', todayKey)
    .not('is_cancelled', 'is', true)
    .not('status', 'in', '(cancelled,no-show,completed)')
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(1);
  if (error) {
    if (namesVideoColumn(error)) videoColumnMissing = true;
    else console.error("Could not read the patient's next booking:", error);
    return undefined;
  }
  const row = ((data ?? []) as Array<{ scheduled_date?: string | null; video_link?: unknown }>)[0];
  return row?.scheduled_date ? { date: row.scheduled_date.slice(0, 10), link: storedVideoLink(row.video_link) } : null;
}

/** The practice's default room link, or null when none is set (or it cannot be read; never throws) */
export const loadPracticeVideoLink = (practiceId: string): Promise<string | null> =>
  readPracticeVideoLink(practiceId).catch((error: unknown) => {
    console.error("Could not read the practice's video link:", error);
    return null;
  });

async function readPracticeVideoLink(practiceId: string): Promise<string | null> {
  const { data, error } = await db
    .from('practice_settings')
    .select('setting_value')
    .eq('practice_id', practiceId)
    .eq('setting_key', VIDEO_LINK_SETTING_KEY)
    .maybeSingle();
  if (error) {
    console.error('Could not read the practice\'s video link:', error);
    return null;
  }
  return defaultVideoLinkFromSetting((data as { setting_value?: unknown } | null)?.setting_value);
}

export type PracticeVideoLinkSave = { ok: true; link: string | null } | { ok: false; message: string };

/** Sets (or clears, with '') the practice's default room link. Practice administrators only (the table's policies). */
export async function savePracticeVideoLink(practiceId: string, input: string): Promise<PracticeVideoLinkSave> {
  let link: string | null = null;
  if (input.trim()) {
    const checked = checkVideoLink(input);
    if (!checked.ok) return { ok: false, message: checked.error };
    link = checked.link;
  }
  const { error } = await db.from('practice_settings').upsert(
    {
      practice_id: practiceId,
      setting_key: VIDEO_LINK_SETTING_KEY,
      setting_value: { url: link },
      setting_type: 'json',
      description: "The practice's video consultation room link, offered for every video booking",
      updated_at: new Date().toISOString()
    },
    { onConflict: 'practice_id,setting_key' }
  );
  if (error) {
    if (isPermissionError(error) || /row-level security/i.test(error.message)) {
      return { ok: false, message: 'Only a practice administrator can change the practice\'s video link.' };
    }
    console.error('Could not save the practice\'s video link:', error);
    return { ok: false, message: `Not saved: ${error.message}` };
  }
  return { ok: true, link };
}
