import { differenceInCalendarDays, eachDayOfInterval, endOfMonth, format, getDay, isValid, isWeekend, parseISO, startOfDay, startOfMonth } from 'date-fns';
import { formatDoctorName } from '../../../utils/formatDoctorName';

/**
 * Shared helpers for staff management (team list, leave, payroll, timesheets).
 * Kept free of React so the rules can be unit tested.
 */

/**
 * Staff, HR and payroll management is limited to practice administrators (and platform
 * super admins). Doctors, nurses and receptionists get self-service only.
 */
export function isStaffAdmin(user?: { role?: string | null; is_super_admin?: boolean | null } | null): boolean {
  return !!user && (user.role === 'admin' || user.is_super_admin === true);
}

export const STAFF_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  doctor: 'Doctor',
  nurse: 'Nurse',
  receptionist: 'Receptionist'
};

export function formatRole(role?: string | null): string {
  if (!role) return 'Unknown role';
  return STAFF_ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

/** Doctors get exactly one "Dr." prefix; everyone else is shown as stored. */
export function formatStaffName(staff: { full_name?: string | null; role?: string | null }): string {
  const name = (staff.full_name ?? '').trim();
  if (staff.role === 'doctor') return formatDoctorName(name, name || 'Unnamed doctor');
  return name || 'Unnamed staff member';
}

export function maskAccountNumber(accountNumber?: string | null): string {
  if (!accountNumber) return 'Not provided';
  return `•••• ${accountNumber.slice(-4)}`;
}

/**
 * Postgres `date` columns arrive as 'yyyy-MM-dd'. `new Date('2026-10-01')` is UTC midnight,
 * which shifts the calendar day for anyone not on UTC, so parse as a local date instead.
 */
export function parseDateOnly(value: string): Date {
  return parseISO(value.slice(0, 10));
}

/**
 * MonthInput emits 'yyyy-MM', or '' when its clear button is pressed. `new Date('-01')` is an
 * Invalid Date that makes date-fns `format` throw and blanks the page, so return null instead.
 */
export function parseMonthValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const month = parseISO(`${value}-01`);
  return isValid(month) ? month : null;
}

/** True when `day` falls on or between the two date-only strings (inclusive). */
export function isDayWithinRange(day: Date, start: string, end: string): boolean {
  const key = format(day, 'yyyy-MM-dd');
  return key >= start.slice(0, 10) && key <= end.slice(0, 10);
}

/**
 * Calendar cells for a Sunday-first month grid: leading `null`s so the 1st lands under
 * the correct weekday header, followed by every day of the month.
 */
export function getMonthGridCells(month: Date): Array<Date | null> {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const leadingBlanks: null[] = Array.from({ length: getDay(days[0]) }, () => null);
  return [...leadingBlanks, ...days];
}

/** Working days (Mon-Fri) requested, matching the database's calculate_leave_days(). */
export function countLeaveDays(start: string, end: string, isHalfDay: boolean): number {
  if (!start || !end || start > end) return 0;
  const days = eachDayOfInterval({ start: parseDateOnly(start), end: parseDateOnly(end) })
    .filter(day => !isWeekend(day)).length;
  return Math.max(0, isHalfDay ? days - 0.5 : days);
}

/** Whole calendar days between today and the leave start (0 = starts today). */
export function daysOfNotice(start: string, today: Date = new Date()): number {
  return differenceInCalendarDays(parseDateOnly(start), startOfDay(today));
}

/** A real event shown in a staff member's "Recent activity" list. */
export interface StaffActivityItem {
  id: string;
  kind: 'leave' | 'timesheet' | 'payslip';
  title: string;
  detail: string;
  /** ISO timestamp or yyyy-MM-dd used for ordering and display */
  date: string;
}

export interface StaffStatusInfo {
  id: string;
  role: string;
  is_active: boolean | null;
}

/**
 * Why a staff member may not be deactivated, or null when it is allowed.
 * Prevents an admin locking themselves out or leaving the practice without an admin.
 */
export function getDeactivationBlocker(
  target: StaffStatusInfo,
  currentUserId: string | undefined,
  team: StaffStatusInfo[]
): string | null {
  if (target.is_active === false) return null;
  if (target.id === currentUserId) {
    return 'You cannot deactivate your own account. Ask another administrator to do it.';
  }
  if (target.role === 'admin') {
    const otherActiveAdmins = team.filter(
      member => member.id !== target.id && member.role === 'admin' && member.is_active !== false
    );
    if (otherActiveAdmins.length === 0) {
      return 'This is the only active administrator. Make another staff member an administrator first.';
    }
  }
  return null;
}

/**
 * Supabase reports success when row-level security silently filters an UPDATE down to
 * zero rows. Call with the rows returned by `.select()` so a blocked save is not shown as saved.
 */
export function ensureRowsUpdated(rows: unknown[] | null | undefined, what: string): void {
  if (!rows || rows.length === 0) {
    throw new Error(
      `${what} could not be changed: your account is not permitted to change this record. ` +
      'A database access policy needs updating; please contact support.'
    );
  }
}

/** Turns raw database errors into messages a practice manager can act on. */
export function describeDbError(error: unknown, fallback: string): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';
  if (!message) return fallback;
  if (/row-level security|permission denied/i.test(message)) {
    return `${fallback}: your account is not permitted to make this change.`;
  }
  if (/duplicate key|already exists/i.test(message)) {
    return `${fallback}: a record with these details already exists.`;
  }
  return message;
}

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

/** RFC 4180 CSV so names containing commas or quotes stay in their column in Excel. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const escape = (raw: string | number | null | undefined) => {
    const text = raw === null || raw === undefined ? '' : String(raw);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map(column => escape(column.label)).join(',');
  const body = rows.map(row => columns.map(column => escape(column.value(row))).join(','));
  return [header, ...body].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 names (e.g. accented characters) correctly
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
