import { describe, it, expect } from 'vitest';
import { diaryRangeFor, isInDiaryRange, monthGridWeeks } from '../diaryRange';
import { layoutLanes } from '../laneLayout';

// Wednesday 7 October 2026
const DAY = new Date(2026, 9, 7);

describe('diaryRangeFor', () => {
  it('loads one day for the day view, as before', () => {
    expect(diaryRangeFor('day', DAY)).toEqual({ from: '2026-10-07', to: '2026-10-07' });
  });

  it('loads Monday to Sunday for the week view: the same days the week grid draws', () => {
    expect(diaryRangeFor('week', DAY)).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    // A Sunday belongs to the week that started the Monday before
    expect(diaryRangeFor('week', new Date(2026, 9, 11))).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('loads the whole calendar month for the month view', () => {
    expect(diaryRangeFor('month', DAY)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(diaryRangeFor('month', new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('tells whether a booking is in the range', () => {
    expect(isInDiaryRange({ from: '2026-10-05', to: '2026-10-11' }, '2026-10-11')).toBe(true);
    expect(isInDiaryRange({ from: '2026-10-05', to: '2026-10-11' }, '2026-10-12')).toBe(false);
  });
});

describe('monthGridWeeks', () => {
  it('lays October 2026 out in whole weeks from Monday 28 September, so weekdays line up in columns', () => {
    const weeks = monthGridWeeks(DAY);
    expect(weeks).toHaveLength(5);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0][0]).toEqual({ date: '2026-09-28', inMonth: false });
    expect(weeks[0][3]).toEqual({ date: '2026-10-01', inMonth: true });
    expect(weeks[4][6]).toEqual({ date: '2026-11-01', inMonth: false });
  });
});

describe('layoutLanes', () => {
  it('gives a booking that overlaps nothing the whole column', () => {
    expect(layoutLanes([{ id: 'a', start: 540, end: 570 }]).get('a')).toEqual({ lane: 0, lanes: 1 });
  });

  it('puts a double booking side by side, so neither patient is hidden', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 540, end: 570 },
      { id: 'b', start: 540, end: 600 }
    ]);
    expect(lanes.get('b')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('a')).toEqual({ lane: 1, lanes: 2 });
  });

  it('reuses a lane once its booking ends, and keeps later groups full width', () => {
    const lanes = layoutLanes([
      { id: 'long', start: 540, end: 660 },
      { id: 'first', start: 540, end: 570 },
      { id: 'second', start: 570, end: 600 },
      { id: 'later', start: 700, end: 730 }
    ]);
    expect(lanes.get('long')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get('first')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('second')).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get('later')).toEqual({ lane: 0, lanes: 1 });
  });

  it('treats back-to-back bookings as not overlapping', () => {
    const lanes = layoutLanes([
      { id: 'a', start: 540, end: 570 },
      { id: 'b', start: 570, end: 600 }
    ]);
    expect(lanes.get('a')).toEqual({ lane: 0, lanes: 1 });
    expect(lanes.get('b')).toEqual({ lane: 0, lanes: 1 });
  });
});
