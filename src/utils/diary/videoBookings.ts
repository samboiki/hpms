/**
 * Video consultations in the diary (parity B16): a booking seen by video keeps its room link (visits.video_link,
 * proposals/2026-10-13-video-bookings.sql). The link is typed (the practitioner's own Zoom, Teams or Meet room),
 * the practice's default link (Diary settings, practice_settings 'video_consult_link'), or a new private OneHealth
 * room (telemedicineLinks.ts: unguessable, made in the browser). The booking and its diary card show it, and the
 * appointment messages can carry it as {{videoLink}} (src/utils/templates/mergeFields.ts and the reminders in
 * supabase/functions/_shared/appointmentReminders.ts).
 */
import { DEFAULT_TELEMEDICINE_BASE_URL } from '../../components/telemedicine/telemedicineLinks';

/** Same limits as visits_video_link_check */
export const VIDEO_LINK_MAX = 500;
export const VIDEO_LINK_MIN = 12;

/** The practice_settings key of the practice's default room link ({ "url": "https://..." }) */
export const VIDEO_LINK_SETTING_KEY = 'video_consult_link';

export type VideoLinkCheck = { ok: true; link: string } | { ok: false; error: string };

/**
 * A room link as it is kept: https only (an http link would send the call unencrypted), one link without spaces,
 * up to VIDEO_LINK_MAX characters. "meet.example.com/room" gets its https:// added, as people type links.
 */
export function checkVideoLink(input: string | null | undefined): VideoLinkCheck {
  let link = (input ?? '').trim();
  if (!link) return { ok: false, error: 'Add the link of the video room.' };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(link)) link = `https://${link}`;
  if (/^http:\/\//i.test(link)) return { ok: false, error: 'Use the secure link that starts with https://.' };
  if (!/^https:\/\//i.test(link)) return { ok: false, error: 'A video room link starts with https://.' };
  if (/\s/.test(link) || /[<>"]/.test(link)) return { ok: false, error: 'Paste one link only, without spaces.' };
  if (link.length > VIDEO_LINK_MAX) return { ok: false, error: `The link is too long (at most ${VIDEO_LINK_MAX} characters).` };
  let host = '';
  try {
    host = new URL(link).hostname;
  } catch {
    return { ok: false, error: 'This is not a link a patient can open.' };
  }
  if (!host.includes('.') || link.length < VIDEO_LINK_MIN) return { ok: false, error: 'This is not a link a patient can open.' };
  return { ok: true, link: link.replace(/^https:\/\//i, 'https://') };
}

/** The link to keep on a booking, or null for a booking seen in the rooms */
export const storedVideoLink = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const check = checkVideoLink(value);
  return check.ok ? check.link : null;
};

/** Seen by video: the booking keeps a room link */
export const isVideoBooking = (booking: { video_link?: string | null } | null | undefined): boolean => !!storedVideoLink(booking?.video_link);

/** "meet.jit.si/hpms-1a2b3c4d-..." for a card or a list: the host and the start of the path */
export function shortVideoLink(link: string, max = 40): string {
  const shown = link.replace(/^https:\/\//i, '').replace(/\/$/, '');
  return shown.length > max ? `${shown.slice(0, max - 3)}...` : shown;
}

/**
 * A OneHealth room (Jitsi) opens inside the app's call screen; any other link (Zoom, Teams, Meet) opens in a new tab,
 * where its own app takes over.
 */
export function opensInApp(link: string): boolean {
  try {
    return new URL(link).origin === new URL(DEFAULT_TELEMEDICINE_BASE_URL).origin;
  } catch {
    return false;
  }
}

/** The practice's default link from its practice_settings row ({ url }), or null */
export function defaultVideoLinkFromSetting(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return storedVideoLink(value);
  return storedVideoLink((value as Record<string, unknown>).url);
}

/** What the booking form starts a video booking with: the link it already has, else the practice's default */
export const initialVideoLink = (existing: string | null | undefined, practiceDefault: string | null): string =>
  storedVideoLink(existing) ?? practiceDefault ?? '';

/** The patient's next booking (from today on) and its room link, null when it is seen in the rooms */
export interface NextBookingVideo {
  /** 'yyyy-MM-dd' */
  date: string;
  link: string | null;
}

/**
 * A message's next-booking values with the booking's room link for {{videoLink}}. The link is only used when it belongs
 * to the same booking whose date fills {{appointmentDate}}; unknown (undefined) leaves the field unfilled.
 */
export function withNextBookingVideo<T extends { nextBookingOn?: string | null }>(
  next: T | null,
  video: NextBookingVideo | null | undefined
): (T & { nextBookingVideoLink?: string | null }) | null {
  if (!next || video === undefined) return next;
  return { ...next, nextBookingVideoLink: video && video.date === next.nextBookingOn ? video.link : null };
}
