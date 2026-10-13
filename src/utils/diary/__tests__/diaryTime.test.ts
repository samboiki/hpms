import { describe, it, expect } from 'vitest';
import { addDaysToKey, formatDiaryDateRange, parseDateKey, timeToMinutes } from '../diaryTime';
import { isMissingColumnError, isMissingTableError } from '../dbErrors';

describe('diary dates and times', () => {
  it('reads times the way the database returns them (HH:mm:ss) as well as the form (HH:mm)', () => {
    expect(timeToMinutes('13:30:00')).toBe(810);
    expect(timeToMinutes('9:05')).toBe(545);
    expect(timeToMinutes('25:00')).toBeNull();
    expect(timeToMinutes('')).toBeNull();
  });

  it('rejects impossible dates instead of rolling them into the next month', () => {
    expect(parseDateKey('2026-02-30')).toBeNull();
    expect(parseDateKey('2028-02-29')).not.toBeNull();
  });

  it('counts days across month ends without time-zone drift', () => {
    expect(addDaysToKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('writes ranges day first and short, as staff write them', () => {
    expect(formatDiaryDateRange('2026-10-07', '2026-10-11')).toBe('7-11 Oct 2026');
    expect(formatDiaryDateRange('2026-10-28', '2026-11-03')).toBe('28 Oct-3 Nov 2026');
    expect(formatDiaryDateRange('2026-12-30', '2027-01-02')).toBe('30 Dec 2026-2 Jan 2027');
  });
});

describe('database errors', () => {
  it('treats a missing diary_blocks table as "not set up yet", so the diary keeps working before the SQL is applied', () => {
    expect(isMissingTableError({ code: '42P01', message: 'relation "public.diary_blocks" does not exist' }, 'diary_blocks')).toBe(true);
    expect(isMissingTableError({ code: 'PGRST205', message: "Could not find the table 'public.diary_blocks' in the schema cache" }, 'diary_blocks')).toBe(true);
  });

  it('still reports other failures, which staff must see', () => {
    expect(isMissingTableError({ code: '42P01', message: 'relation "public.branches" does not exist' }, 'diary_blocks')).toBe(false);
    expect(isMissingTableError({ code: '42501', message: 'permission denied for table diary_blocks' }, 'diary_blocks')).toBe(false);
    expect(isMissingTableError(null, 'diary_blocks')).toBe(false);
  });

  it('recognises an unknown column, so a query can fall back to the columns every database has', () => {
    expect(isMissingColumnError({ code: '42703', message: 'column practice_sms_logs.failure_reason does not exist' })).toBe(true);
    expect(isMissingColumnError({ code: '23505' })).toBe(false);
  });
});
