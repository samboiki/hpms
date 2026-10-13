import { describe, it, expect } from 'vitest';
import {
  checkVideoLink,
  defaultVideoLinkFromSetting,
  initialVideoLink,
  isVideoBooking,
  opensInApp,
  shortVideoLink,
  storedVideoLink,
  VIDEO_LINK_MAX,
  withNextBookingVideo
} from '../videoBookings';

describe('checkVideoLink (the room link a video booking keeps)', () => {
  it('keeps a secure link as it was pasted', () => {
    expect(checkVideoLink('  https://zoom.example.com/j/123456789?pwd=abc  ')).toEqual({ ok: true, link: 'https://zoom.example.com/j/123456789?pwd=abc' });
  });

  it('adds https:// to a link typed without it, as people type links', () => {
    expect(checkVideoLink('meet.example.com/abc-defg-hij')).toEqual({ ok: true, link: 'https://meet.example.com/abc-defg-hij' });
  });

  it('refuses an http link: the call and the patient would travel unencrypted', () => {
    expect(checkVideoLink('http://meet.example.com/room')).toEqual({ ok: false, error: 'Use the secure link that starts with https://.' });
  });

  it('refuses what a patient could not open: two links, an address without a domain, a script', () => {
    expect(checkVideoLink('https://a.example.com/x https://b.example.com/y').ok).toBe(false);
    expect(checkVideoLink('https://localhost/room').ok).toBe(false);
    expect(checkVideoLink('javascript:alert(1)').ok).toBe(false);
    expect(checkVideoLink('').ok).toBe(false);
    expect(checkVideoLink(`https://meet.example.com/${'x'.repeat(VIDEO_LINK_MAX)}`).ok).toBe(false);
  });
});

describe('a booking seen by video', () => {
  it('is a booking that keeps a usable room link; a booking in the rooms has none', () => {
    expect(isVideoBooking({ video_link: 'https://meet.jit.si/hpms-abc-defghijklmnopqrstuvwxyz234' })).toBe(true);
    expect(isVideoBooking({ video_link: null })).toBe(false);
    expect(isVideoBooking({ video_link: 'http://old.example.com' })).toBe(false);
    expect(storedVideoLink(42)).toBeNull();
  });

  it('starts from the link it has, else the practice default, so reception does not type it every time', () => {
    expect(initialVideoLink('https://zoom.example.com/j/1', 'https://meet.example.com/practice-room')).toBe('https://zoom.example.com/j/1');
    expect(initialVideoLink(null, 'https://meet.example.com/practice-room')).toBe('https://meet.example.com/practice-room');
    expect(initialVideoLink(null, null)).toBe('');
  });

  it('reads the practice default from its setting row and ignores a damaged one', () => {
    expect(defaultVideoLinkFromSetting({ url: 'https://meet.example.com/practice-room' })).toBe('https://meet.example.com/practice-room');
    expect(defaultVideoLinkFromSetting({ url: 'http://insecure.example.com' })).toBeNull();
    expect(defaultVideoLinkFromSetting(null)).toBeNull();
  });

  it('opens a OneHealth room inside the app and any other service in its own tab', () => {
    expect(opensInApp('https://meet.jit.si/hpms-abc-room')).toBe(true);
    expect(opensInApp('https://zoom.example.com/j/1')).toBe(false);
    expect(opensInApp('not a link')).toBe(false);
  });

  it('shortens a long link for a diary card without the https:// noise', () => {
    expect(shortVideoLink('https://meet.jit.si/hpms-1a2b3c4d-abcdefghijklmnopqrstuvwxyz', 30)).toBe('meet.jit.si/hpms-1a2b3c4d-a...');
    expect(shortVideoLink('https://zoom.example.com/j/1/')).toBe('zoom.example.com/j/1');
  });
});

describe('withNextBookingVideo (the room a message names)', () => {
  const next = { nextBookingOn: '2026-10-20', nextBookingTime: '09:30' };
  const ROOM = 'https://meet.jit.si/hpms-invented-room';

  // A message saying "your visit on 20 October" must not carry the room of another booking
  it('uses the room only when it belongs to the booking whose date the message gives', () => {
    expect(withNextBookingVideo(next, { date: '2026-10-20', link: ROOM })?.nextBookingVideoLink).toBe(ROOM);
    expect(withNextBookingVideo(next, { date: '2026-10-27', link: ROOM })?.nextBookingVideoLink).toBeNull();
    expect(withNextBookingVideo(next, null)?.nextBookingVideoLink).toBeNull();
  });

  it('leaves the field unfilled when the room could not be looked up, and keeps "no next booking" as it is', () => {
    expect(withNextBookingVideo(next, undefined)).toBe(next);
    expect(withNextBookingVideo(null, { date: '2026-10-20', link: ROOM })).toBeNull();
  });
});
