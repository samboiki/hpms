import { describe, it, expect } from 'vitest';
import {
  countLeaveDays,
  daysOfNotice,
  describeDbError,
  ensureRowsUpdated,
  formatStaffName,
  getDeactivationBlocker,
  getMonthGridCells,
  isDayWithinRange,
  isStaffAdmin,
  maskAccountNumber,
  parseDateOnly,
  parseMonthValue,
  toCsv
} from '../staffUtils';

// Leave dates are Postgres `date` values. Parsed as UTC they shift a day for anyone not on UTC,
// which made the first day of every approved leave disappear from the leave calendar.
describe('leave calendar dates', () => {
  it('parses a date-only value as local midnight of that calendar day', () => {
    const date = parseDateOnly('2026-10-01');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 9, 1, 0]);
  });

  it('shows leave on both its first and last day', () => {
    expect(isDayWithinRange(new Date(2026, 9, 5), '2026-10-05', '2026-10-07')).toBe(true);
    expect(isDayWithinRange(new Date(2026, 9, 7), '2026-10-05', '2026-10-07')).toBe(true);
    expect(isDayWithinRange(new Date(2026, 9, 8), '2026-10-05', '2026-10-07')).toBe(false);
  });

  it('starts the month grid under the correct weekday (1 Oct 2026 is a Thursday)', () => {
    const cells = getMonthGridCells(new Date(2026, 9, 15));
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]?.getDate()).toBe(1);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });
});

// Requested days are deducted from leave balances and unpaid leave from salary,
// so weekends must never be counted.
describe('countLeaveDays', () => {
  it('counts only working days', () => {
    expect(countLeaveDays('2026-10-02', '2026-10-05', false)).toBe(2); // Fri + Mon
  });

  it('counts a single half day as half a day', () => {
    expect(countLeaveDays('2026-10-06', '2026-10-06', true)).toBe(0.5);
  });

  it('never returns a negative or positive count for impossible ranges', () => {
    expect(countLeaveDays('2026-10-03', '2026-10-04', true)).toBe(0); // weekend only
    expect(countLeaveDays('2026-10-09', '2026-10-05', false)).toBe(0); // end before start
  });
});

describe('daysOfNotice', () => {
  it('measures notice in calendar days from today, ignoring the time of day', () => {
    const lateAfternoon = new Date(2026, 9, 6, 17, 30);
    expect(daysOfNotice('2026-10-07', lateAfternoon)).toBe(1);
    expect(daysOfNotice('2026-10-06', lateAfternoon)).toBe(0);
  });
});

// Deactivating yourself or the last administrator locks the practice out of staff management.
describe('getDeactivationBlocker', () => {
  const admin = { id: 'a1', role: 'admin', is_active: true };
  const nurse = { id: 'n1', role: 'nurse', is_active: true };

  it('stops administrators deactivating their own account', () => {
    expect(getDeactivationBlocker(admin, 'a1', [admin, { id: 'a2', role: 'admin', is_active: true }])).toMatch(/your own account/);
  });

  it('stops the last active administrator being deactivated', () => {
    const inactiveAdmin = { id: 'a3', role: 'admin', is_active: false };
    expect(getDeactivationBlocker(admin, 'someone-else', [admin, nurse, inactiveAdmin])).toMatch(/only active administrator/);
  });

  it('allows deactivating an administrator when another active one remains', () => {
    const otherAdmin = { id: 'a2', role: 'admin', is_active: true };
    expect(getDeactivationBlocker(admin, 'a2', [admin, otherAdmin])).toBeNull();
  });

  it('never blocks reactivation or ordinary staff', () => {
    expect(getDeactivationBlocker({ ...admin, is_active: false }, 'a1', [])).toBeNull();
    expect(getDeactivationBlocker(nurse, 'a1', [admin, nurse])).toBeNull();
  });
});

// Supabase returns no error when row-level security filters an UPDATE to zero rows;
// without this check edits to other staff were reported as saved but silently dropped.
describe('ensureRowsUpdated', () => {
  it('throws when no row was changed', () => {
    expect(() => ensureRowsUpdated([], 'The leave request')).toThrow(/could not be changed/);
    expect(() => ensureRowsUpdated(null, 'The leave request')).toThrow();
  });

  it('passes when the row was changed', () => {
    expect(() => ensureRowsUpdated([{ id: 'x' }], 'The leave request')).not.toThrow();
  });
});

describe('describeDbError', () => {
  it('explains permission failures in plain language', () => {
    const message = describeDbError({ message: 'new row violates row-level security policy for table "users"' }, 'Could not save');
    expect(message).toBe('Could not save: your account is not permitted to make this change.');
  });

  it('falls back when there is no message', () => {
    expect(describeDbError(undefined, 'Could not save')).toBe('Could not save');
  });
});

// Exported staff lists are opened in Excel; a name with a comma must not shift columns.
describe('toCsv', () => {
  it('quotes values containing commas or quotes and blanks missing values', () => {
    const csv = toCsv(
      [{ name: 'Doe, Jane "JD"', dept: null }],
      [
        { label: 'Name', value: row => row.name },
        { label: 'Department', value: row => row.dept }
      ]
    );
    expect(csv).toBe('Name,Department\r\n"Doe, Jane ""JD""",');
  });
});

// The month picker's clear button sends ''. new Date('-01') is invalid and crashed the page.
describe('parseMonthValue', () => {
  it('ignores a cleared month instead of producing an invalid date', () => {
    expect(parseMonthValue('')).toBeNull();
    expect(parseMonthValue('2026-13')).toBeNull();
  });

  it('returns the first day of the chosen month', () => {
    const month = parseMonthValue('2026-10');
    expect(month && [month.getFullYear(), month.getMonth(), month.getDate()]).toEqual([2026, 9, 1]);
  });
});

describe('staff display and access helpers', () => {
  it('gives doctors exactly one "Dr." and leaves other staff names unchanged', () => {
    expect(formatStaffName({ full_name: 'Dr. Hilma Amalwa', role: 'doctor' })).toBe('Dr. Hilma Amalwa');
    expect(formatStaffName({ full_name: 'Hilma Amalwa', role: 'doctor' })).toBe('Dr. Hilma Amalwa');
    expect(formatStaffName({ full_name: 'Maria Shikongo', role: 'nurse' })).toBe('Maria Shikongo');
  });

  it('limits staff, HR and payroll management to administrators', () => {
    expect(isStaffAdmin({ role: 'admin' })).toBe(true);
    expect(isStaffAdmin({ role: 'doctor', is_super_admin: true })).toBe(true);
    expect(isStaffAdmin({ role: 'doctor' })).toBe(false);
    expect(isStaffAdmin(null)).toBe(false);
  });

  it('never shows a full bank account number', () => {
    expect(maskAccountNumber('62251234567')).toBe('•••• 4567');
    expect(maskAccountNumber(null)).toBe('Not provided');
  });
});
