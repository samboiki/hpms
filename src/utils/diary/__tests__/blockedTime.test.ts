import { describe, it, expect } from 'vitest';
import {
  blocksOnDay,
  blocksOverlapping,
  describeDiaryBlock,
  diaryBlockDayLabel,
  diaryBlockOccursOn,
  diaryBlockWindowOn,
  normalizeDiaryBlockRow,
  validateDiaryBlockInput,
  type DiaryBlock,
  type DiaryBlockInput
} from '../blockedTime';

// 5 Oct 2026 is a Monday, 7 Oct a Wednesday, 10 Oct a Saturday, 11 Oct a Sunday
const lunch = (overrides: Partial<DiaryBlock> = {}): DiaryBlock => ({
  id: 'b1',
  practiceId: 'p1',
  branchId: null,
  branchName: null,
  doctorId: 'pr-a',
  reason: 'Lunch',
  startDate: '2026-10-05',
  endDate: null,
  startMinutes: 13 * 60,
  endMinutes: 14 * 60,
  recurrence: 'weekdays',
  ...overrides
});

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

describe('when a block applies', () => {
  it('repeats a weekday lunch Monday to Friday but not on Saturday, when many practices still see patients', () => {
    const block = lunch();
    expect(diaryBlockOccursOn(block, '2026-10-07')).toBe(true);
    expect(diaryBlockOccursOn(block, '2026-10-09')).toBe(true);
    expect(diaryBlockOccursOn(block, '2026-10-10')).toBe(false);
    expect(diaryBlockOccursOn(block, '2026-10-11')).toBe(false);
  });

  it('repeats a weekly block only on the weekday it started, so a Wednesday theatre list does not grey Thursdays', () => {
    const block = lunch({ recurrence: 'weekly', startDate: '2026-10-07', startMinutes: minutes('14:00'), endMinutes: minutes('17:00') });
    expect(diaryBlockOccursOn(block, '2026-10-14')).toBe(true);
    expect(diaryBlockOccursOn(block, '2026-10-15')).toBe(false);
  });

  it('stops after its last day and does not start early, so an old arrangement never greys the diary for ever', () => {
    const block = lunch({ endDate: '2026-10-09' });
    expect(diaryBlockOccursOn(block, '2026-10-02')).toBe(false);
    expect(diaryBlockOccursOn(block, '2026-10-09')).toBe(true);
    expect(diaryBlockOccursOn(block, '2026-10-12')).toBe(false);
  });

  it('covers every day of a leave period, the weekend included, from morning to night', () => {
    const leave = lunch({ reason: 'Annual leave', recurrence: 'none', startDate: '2026-10-07', endDate: '2026-10-11', startMinutes: null, endMinutes: null });
    expect(diaryBlockWindowOn(leave, '2026-10-10')).toEqual({ start: 0, end: 24 * 60 });
    expect(diaryBlockWindowOn(leave, '2026-10-12')).toBeNull();
  });
});

describe('blocksOverlapping', () => {
  const blocks = [lunch()];

  it('lets a booking end exactly when lunch starts, but flags one that runs into it', () => {
    expect(blocksOverlapping(blocks, '2026-10-07', minutes('12:30'), minutes('13:00'), 'pr-a')).toEqual([]);
    expect(blocksOverlapping(blocks, '2026-10-07', minutes('12:45'), minutes('13:15'), 'pr-a')).toHaveLength(1);
    expect(blocksOverlapping(blocks, '2026-10-07', minutes('14:00'), minutes('14:30'), 'pr-a')).toEqual([]);
  });

  it("keeps one practitioner's lunch out of another practitioner's diary", () => {
    expect(blocksOverlapping(blocks, '2026-10-07', minutes('13:00'), minutes('13:30'), 'pr-b')).toEqual([]);
  });

  it('greys every diary when the practice is closed, including the all-practitioners view', () => {
    const closed = lunch({ id: 'b2', doctorId: null, reason: 'Staff training', recurrence: 'none', startDate: '2026-10-07', endDate: '2026-10-07', startMinutes: null, endMinutes: null });
    expect(blocksOverlapping([closed], '2026-10-07', minutes('09:00'), minutes('09:30'), 'pr-b')).toEqual([closed]);
    expect(blocksOverlapping([closed], '2026-10-07', minutes('09:00'), minutes('09:30'), null)).toEqual([closed]);
    // A practitioner's own block is not shown when the diary is not filtered to one practitioner
    expect(blocksOverlapping(blocks, '2026-10-07', minutes('13:00'), minutes('13:30'), null)).toEqual([]);
  });

  it('lists whole-day blocks first, because they explain the rest of the day', () => {
    const closed = lunch({ id: 'b2', doctorId: null, reason: 'Closed', recurrence: 'none', startDate: '2026-10-07', endDate: '2026-10-07', startMinutes: null, endMinutes: null });
    expect(blocksOnDay([lunch(), closed], '2026-10-07').map((b) => b.id)).toEqual(['b2', 'b1']);
  });
});

describe('describeDiaryBlock', () => {
  it('reads the way reception would say it, with day-first dates', () => {
    expect(describeDiaryBlock(lunch(), 'N. Amupolo')).toBe(
      'N. Amupolo is unavailable 13:00-14:00 every weekday from 5 Oct 2026: Lunch'
    );
    expect(
      describeDiaryBlock(lunch({ doctorId: null, reason: 'Staff training', recurrence: 'none', startDate: '2026-10-07', endDate: '2026-10-07', startMinutes: null, endMinutes: null }))
    ).toBe('The practice is closed all day on 7 Oct 2026: Staff training');
    expect(
      describeDiaryBlock(lunch({ doctorId: null, branchId: 'br1', branchName: 'Ongwediva', reason: 'Renovations', recurrence: 'none', startDate: '2026-10-07', endDate: '2026-10-09', startMinutes: null, endMinutes: null }))
    ).toBe('The Ongwediva branch is closed all day, 7-9 Oct 2026: Renovations');
    expect(
      describeDiaryBlock(lunch({ recurrence: 'weekly', startDate: '2026-10-07', endDate: '2026-11-25', startMinutes: minutes('14:00'), endMinutes: minutes('17:00'), reason: 'Theatre list' }), 'N. Amupolo')
    ).toBe('N. Amupolo is unavailable 14:00-17:00 every Wednesday from 7 Oct 2026 until 25 Nov 2026: Theatre list');
  });

  it("keeps the day's diary note short: only who, the time that day and why", () => {
    expect(diaryBlockDayLabel(lunch(), 'N. Amupolo')).toBe('N. Amupolo unavailable 13:00-14:00: Lunch');
    expect(diaryBlockDayLabel(lunch({ doctorId: null, startMinutes: null, endMinutes: null, reason: 'Staff training' }))).toBe(
      'Practice closed all day: Staff training'
    );
    expect(diaryBlockDayLabel(lunch({ doctorId: null, branchId: 'br1', branchName: 'Rundu', reason: 'Stocktake' }))).toBe(
      'Rundu branch closed 13:00-14:00: Stocktake'
    );
  });
});

describe('validateDiaryBlockInput', () => {
  const input = (overrides: Partial<DiaryBlockInput> = {}): DiaryBlockInput => ({
    scope: { kind: 'doctor', doctorId: 'pr-a' },
    reason: ' Lunch ',
    startDate: '2026-10-05',
    endDate: null,
    allDay: false,
    startTime: '13:00',
    endTime: '14:00',
    recurrence: 'weekdays',
    ...overrides
  });

  it('accepts an open-ended weekday lunch and saves exactly what the database expects', () => {
    expect(validateDiaryBlockInput(input())).toEqual({
      ok: true,
      fields: {
        branch_id: null,
        doctor_id: 'pr-a',
        reason: 'Lunch',
        start_date: '2026-10-05',
        end_date: null,
        start_time: '13:00',
        end_time: '14:00',
        recurrence: 'weekdays'
      }
    });
  });

  it('saves a practice closure for everyone, with no practitioner and no times', () => {
    const result = validateDiaryBlockInput(input({ scope: { kind: 'practice' }, allDay: true, recurrence: 'none', endDate: '2026-10-05' }));
    expect(result.ok && result.fields).toMatchObject({ doctor_id: null, branch_id: null, start_time: null, end_time: null });
  });

  it('explains in plain words what is missing instead of saving a block nobody understands', () => {
    const result = validateDiaryBlockInput(input({ reason: '  ', recurrence: 'none', endDate: null, startTime: '14:00', endTime: '13:00' }));
    expect(result).toEqual({
      ok: false,
      errors: ['Give a reason, for example Leave, Lunch or Meeting.', 'Choose the last day.', 'The end time must be after the start time.']
    });
  });

  it('refuses a last day before the first day, which would block nothing', () => {
    const result = validateDiaryBlockInput(input({ recurrence: 'none', startDate: '2026-10-09', endDate: '2026-10-05' }));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toContain("The last day can't be before the first day.");
  });
});

describe('normalizeDiaryBlockRow', () => {
  it('reads a database row (times come back as HH:mm:ss) with its branch name', () => {
    const block = normalizeDiaryBlockRow({
      id: 'b9',
      practice_id: 'p1',
      branch_id: 'br1',
      doctor_id: null,
      reason: 'Stocktake',
      start_date: '2026-10-07',
      end_date: '2026-10-07',
      start_time: '08:00:00',
      end_time: '10:30:00',
      recurrence: 'none',
      branch: { name: 'Rundu' }
    });
    expect(block).toMatchObject({ branchName: 'Rundu', startMinutes: 480, endMinutes: 630, recurrence: 'none' });
  });

  it('skips a row without an id, reason or valid first day, so one bad row cannot break the diary', () => {
    expect(normalizeDiaryBlockRow({ id: 'b1', practice_id: 'p1', reason: '', start_date: '2026-10-07' })).toBeNull();
    expect(normalizeDiaryBlockRow({ id: 'b1', practice_id: 'p1', reason: 'Leave', start_date: 'soon' })).toBeNull();
    expect(normalizeDiaryBlockRow(null)).toBeNull();
  });
});
