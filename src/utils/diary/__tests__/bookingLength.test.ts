import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_TYPE_LENGTHS,
  FALLBACK_BOOKING_LENGTH,
  defaultLengthFor,
  formatBookingLength,
  normalizeTypeLengths,
  resolveBookingLength,
  validateTypeLengths
} from '../bookingLength';
import { visitOverlapsSlot, type ConflictVisit } from '../visitOverlap';

const PRACTICE = { consultation: 20, 'follow-up': 10, procedure: 60, emergency: 30 };

describe('resolveBookingLength', () => {
  it('uses the length reception chose, which the form now stores', () => {
    expect(resolveBookingLength({ duration_minutes: 45, visit_type: 'consultation' }, PRACTICE)).toBe(45);
  });

  it("uses the practice's default for the type when no length was stored (older bookings)", () => {
    expect(resolveBookingLength({ duration_minutes: null, visit_type: 'procedure' }, PRACTICE)).toBe(60);
    expect(resolveBookingLength({ visit_type: 'something else' }, PRACTICE)).toBe(20);
  });

  it('keeps the old 30 minutes for callers that do not know the practice defaults', () => {
    expect(resolveBookingLength({ visit_type: 'follow-up' })).toBe(FALLBACK_BOOKING_LENGTH);
  });

  it('ignores a stored length the database would refuse, instead of drawing a 2-minute card', () => {
    expect(resolveBookingLength({ duration_minutes: 2, visit_type: 'follow-up' }, PRACTICE)).toBe(10);
    expect(resolveBookingLength({ duration_minutes: '45', visit_type: 'follow-up' }, PRACTICE)).toBe(45);
  });
});

describe('practice defaults', () => {
  it('start from a set that changes no existing consultation: 30 minutes as before, follow-ups 15', () => {
    expect(DEFAULT_TYPE_LENGTHS).toEqual({ consultation: 30, 'follow-up': 15, procedure: 30, emergency: 30 });
    expect(normalizeTypeLengths(null)).toEqual(DEFAULT_TYPE_LENGTHS);
  });

  it('read the saved lengths and fill anything missing or invalid from the starting set', () => {
    expect(normalizeTypeLengths({ consultation: 15, procedure: '60', emergency: 0 })).toEqual({
      consultation: 15,
      'follow-up': 15,
      procedure: 60,
      emergency: 30
    });
  });

  it('are the same in the SQL proposal, so a new practice sees what the diary uses', () => {
    const sql = readFileSync('proposals/2026-10-07-diary-2.sql', 'utf8');
    expect(sql).toContain(`'${JSON.stringify(DEFAULT_TYPE_LENGTHS).replace(/,/g, ', ').replace(/:/g, ': ')}'::jsonb`);
  });

  it('give the type default, consultation for unknown types', () => {
    expect(defaultLengthFor('emergency', PRACTICE)).toBe(30);
    expect(defaultLengthFor(undefined, PRACTICE)).toBe(20);
  });

  it('are checked in plain words before saving', () => {
    expect(validateTypeLengths({ consultation: 20, 'follow-up': 10, procedure: 60, emergency: 30 })).toEqual({ ok: true, lengths: PRACTICE });
    const result = validateTypeLengths({ consultation: 600, 'follow-up': 10, procedure: 60, emergency: 30 });
    expect(result).toEqual({ ok: false, errors: ['Consultation: choose 5 to 480 minutes.'] });
  });
});

describe('formatBookingLength', () => {
  it('reads like the booking form', () => {
    expect(formatBookingLength(15)).toBe('15 min');
    expect(formatBookingLength(60)).toBe('1 hour');
    expect(formatBookingLength(90)).toBe('1 h 30 min');
  });
});

describe('visitOverlapsSlot with real lengths', () => {
  const procedure: ConflictVisit = {
    id: 'v1',
    visit_date: '2026-10-07',
    visit_time: '09:00:00',
    scheduled_date: '2026-10-07',
    scheduled_time: '09:00:00',
    status: 'scheduled',
    is_cancelled: false,
    duration_minutes: null,
    visit_type: 'procedure'
  };
  const at = (hhmm: string) => new Date(2026, 9, 7, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3)));

  it('blocks the whole hour of a 60-minute procedure, so 09:45 is not offered on top of it', () => {
    expect(visitOverlapsSlot(procedure, at('09:45'), 15, PRACTICE)).toBe(true);
    expect(visitOverlapsSlot(procedure, at('10:00'), 15, PRACTICE)).toBe(false);
  });

  it('frees the time after a short follow-up instead of the old fixed 30 minutes', () => {
    const followUp = { ...procedure, visit_type: 'follow-up', duration_minutes: 10 };
    expect(visitOverlapsSlot(followUp, at('09:10'), 20, PRACTICE)).toBe(false);
  });
});
