import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_START_STEP,
  SLOT_LENGTH_OPTIONS,
  alignToSlot,
  gridRowMinutes,
  gridSlotFor,
  normalizePractitionerSlots,
  slotLengthOf,
  startStepFor
} from '../slotLength';
import { GRID_SLOT_MINUTES, columnCells } from '../gridHours';
import { findNextFreeSlot, practiceHoursResolver } from '../nextFreeSlot';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
// Invented practitioners: Dr A sees patients every 20 minutes, Dr B every 15, Dr C saved nothing
const SLOTS = { 'pr-a': 20, 'pr-b': 15 };

describe('normalizePractitionerSlots', () => {
  it('keeps only the lengths the diary offers, so a mistyped value never draws a 7-minute grid', () => {
    expect(normalizePractitionerSlots({ 'pr-a': 20, 'pr-b': '15', 'pr-c': 7, 'pr-d': null })).toEqual({ 'pr-a': 20, 'pr-b': 15 });
    expect(normalizePractitionerSlots(null)).toEqual({});
    expect(normalizePractitionerSlots([20])).toEqual({});
  });

  it('offers the same lengths the database accepts (save_diary_settings)', () => {
    const sql = readFileSync('proposals/2026-10-12-diary-statuses-and-types.sql', 'utf8');
    expect(sql).toContain(`NOT IN (${SLOT_LENGTH_OPTIONS.join(', ')})`);
  });
});

describe('a practitioner without a slot keeps what the diary did before', () => {
  it('30-minute rows and start times every 15 minutes', () => {
    expect(slotLengthOf(SLOTS, 'pr-c')).toBeNull();
    expect(gridSlotFor(SLOTS, 'pr-c')).toBe(GRID_SLOT_MINUTES);
    expect(startStepFor(SLOTS, 'pr-c')).toBe(DEFAULT_START_STEP);
    expect(startStepFor(undefined, 'pr-a')).toBe(DEFAULT_START_STEP);
  });

  it("uses the practitioner's own slot for rows and start times when saved", () => {
    expect(gridSlotFor(SLOTS, 'pr-a')).toBe(20);
    expect(startStepFor(SLOTS, 'pr-a')).toBe(20);
  });
});

describe('gridRowMinutes (rows of a grid showing several practitioners)', () => {
  // The shortest slot, so every practitioner's slots start on a row of the time column
  it('takes the shortest slot of the practitioners shown', () => {
    expect(gridRowMinutes(SLOTS, ['pr-a', 'pr-b'])).toBe(15);
    expect(gridRowMinutes(SLOTS, ['pr-a'])).toBe(20);
    expect(gridRowMinutes(SLOTS, ['pr-a', 'pr-c'])).toBe(20);
    expect(gridRowMinutes(SLOTS, ['pr-c', ''])).toBe(GRID_SLOT_MINUTES);
    expect(gridRowMinutes(SLOTS, [])).toBe(GRID_SLOT_MINUTES);
  });
});

describe("columnCells (a practitioner's own slots beside a colleague's)", () => {
  it("starts a 20-minute practitioner's slots on the hour, with a filler when the grid starts earlier for a colleague", () => {
    expect(columnCells({ start: h(7, 45), end: h(9) }, 20)).toEqual([
      { start: h(7, 45), minutes: 15, filler: true },
      { start: h(8), minutes: 20, filler: false },
      { start: h(8, 20), minutes: 20, filler: false },
      { start: h(8, 40), minutes: 20, filler: false }
    ]);
  });

  it('cuts the last slot at the end of the grid instead of drawing past it', () => {
    expect(columnCells({ start: h(16), end: h(17, 15) }, 20).slice(-1)).toEqual([{ start: h(17), minutes: 15, filler: false }]);
  });
});

describe('alignToSlot (the first start time of the time list)', () => {
  it('meets the hour: a 20-minute practitioner starts at 07:20 when the practice opens at 07:30, not 07:30, 07:50, 08:10', () => {
    expect(alignToSlot(h(7, 30), 20)).toBe(h(7, 20));
    expect(alignToSlot(h(8), 15)).toBe(h(8));
  });
});

describe('"Next free slot" at a practitioner\'s slot', () => {
  it('only offers times on the 20-minute slots, after the booking already there', () => {
    const slot = findNextFreeSlot({
      doctorId: 'pr-a',
      fromDate: '2026-10-13',
      durationMinutes: 20,
      days: 1,
      hoursFor: practiceHoursResolver({ tuesday: { open: '08:00', close: '17:00' } }),
      visits: [
        {
          id: 'v1',
          patient_id: 'pt-1',
          doctor_id: 'pr-a',
          visit_date: null,
          visit_time: null,
          scheduled_date: '2026-10-13',
          scheduled_time: '08:00',
          status: 'scheduled',
          is_cancelled: false,
          duration_minutes: 25,
          visit_type: 'consultation'
        }
      ],
      blocks: [],
      stepMinutes: startStepFor(SLOTS, 'pr-a')
    });
    // 08:00-08:25 is taken: 08:15 would be free at 15-minute steps, but Dr A's next slot is 08:40
    expect(slot).toEqual({ date: '2026-10-13', time: '08:40' });
  });
});
