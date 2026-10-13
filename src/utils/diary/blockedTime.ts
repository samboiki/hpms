/**
 * Blocked time in the diary: a practitioner who is not available (leave, a meeting, lunch) or the
 * practice or one branch closed. Rows live in the diary_blocks table (proposals/2026-10-07-diary.sql).
 * Booking into blocked time is still possible after reception confirms; these functions only work
 * out when a block applies.
 *
 * A block covers the days from startDate to endDate (inclusive) that match its recurrence, and on each
 * of those days either the whole day or the same startTime-endTime window:
 *   none     - every day from startDate to endDate (leave from 7 to 11 Oct, or a meeting on one day)
 *   daily    - every day from startDate, until endDate when there is one
 *   weekdays - Monday to Friday from startDate (lunch 13:00-14:00), until endDate when there is one
 *   weekly   - the weekday of startDate (every Wednesday afternoon), until endDate when there is one
 */
import {
  MINUTES_PER_DAY,
  formatDiaryDate,
  formatDiaryDateRange,
  formatTimeRange,
  minutesToTime,
  parseDateKey,
  timeToMinutes,
  weekdayOfKey
} from './diaryTime';

export const DIARY_BLOCK_RECURRENCES = ['none', 'daily', 'weekdays', 'weekly'] as const;
export type DiaryBlockRecurrence = (typeof DIARY_BLOCK_RECURRENCES)[number];

/** Same limit as the CHECK constraint in the SQL proposal */
export const DIARY_BLOCK_REASON_MAX = 120;

export interface DiaryBlock {
  id: string;
  practiceId: string;
  /** Set for a branch closure (doctorId is then null) */
  branchId: string | null;
  branchName: string | null;
  /** The practitioner who is unavailable; null = everyone (the practice or a branch is closed) */
  doctorId: string | null;
  reason: string;
  /** 'yyyy-MM-dd' */
  startDate: string;
  /** Last day ('yyyy-MM-dd'); null = repeats with no end date */
  endDate: string | null;
  /** Minutes since midnight; both null = the whole day */
  startMinutes: number | null;
  endMinutes: number | null;
  recurrence: DiaryBlockRecurrence;
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const isRecurrence = (value: unknown): value is DiaryBlockRecurrence =>
  typeof value === 'string' && (DIARY_BLOCK_RECURRENCES as readonly string[]).includes(value);

export const isAllDayBlock = (block: Pick<DiaryBlock, 'startMinutes' | 'endMinutes'>): boolean =>
  block.startMinutes === null || block.endMinutes === null;

/** Practice and branch closures apply to every practitioner; a practitioner's block only to them. */
export function diaryBlockAppliesTo(block: DiaryBlock, doctorId: string | null): boolean {
  return block.doctorId === null || (doctorId !== null && block.doctorId === doctorId);
}

/** True when the block covers (part of) that day. */
export function diaryBlockOccursOn(block: DiaryBlock, dateKey: string): boolean {
  if (!parseDateKey(dateKey)) return false;
  if (dateKey < block.startDate) return false;
  if (block.endDate !== null && dateKey > block.endDate) return false;
  // A one-off block always has a last day; without one it covers its first day only
  if (block.recurrence === 'none' && block.endDate === null && dateKey !== block.startDate) return false;
  if (block.recurrence === 'weekdays') {
    const weekday = weekdayOfKey(dateKey);
    return weekday >= 1 && weekday <= 5;
  }
  if (block.recurrence === 'weekly') return weekdayOfKey(dateKey) === weekdayOfKey(block.startDate);
  return true;
}

/** The blocked minutes of that day, or null when the block does not cover the day. */
export function diaryBlockWindowOn(block: DiaryBlock, dateKey: string): { start: number; end: number } | null {
  if (!diaryBlockOccursOn(block, dateKey)) return null;
  if (block.startMinutes === null || block.endMinutes === null) return { start: 0, end: MINUTES_PER_DAY };
  return { start: block.startMinutes, end: block.endMinutes };
}

/**
 * Blocks that take any part of startMinutes-endMinutes on that day in this practitioner's diary
 * (doctorId null: only practice and branch closures). Whole-day blocks come first.
 */
export function blocksOverlapping(
  blocks: DiaryBlock[],
  dateKey: string,
  startMinutes: number,
  endMinutes: number,
  doctorId: string | null
): DiaryBlock[] {
  return sortBlocks(
    blocks.filter((block) => {
      if (!diaryBlockAppliesTo(block, doctorId)) return false;
      const window = diaryBlockWindowOn(block, dateKey);
      return window !== null && startMinutes < window.end && endMinutes > window.start;
    })
  );
}

/**
 * Blocks on a day: all of them (doctorId undefined), or the ones in one practitioner's diary
 * (doctorId null: practice and branch closures only). Whole-day blocks first, then by start time.
 */
export function blocksOnDay(blocks: DiaryBlock[], dateKey: string, doctorId?: string | null): DiaryBlock[] {
  return sortBlocks(
    blocks.filter(
      (block) => diaryBlockOccursOn(block, dateKey) && (doctorId === undefined || diaryBlockAppliesTo(block, doctorId))
    )
  );
}

function sortBlocks(blocks: DiaryBlock[]): DiaryBlock[] {
  return [...blocks].sort((a, b) => (a.startMinutes ?? -1) - (b.startMinutes ?? -1));
}

/** "Dr Amupolo", "The Ongwediva branch", "The practice" */
export function diaryBlockWho(block: DiaryBlock, doctorName?: string | null): string {
  if (block.doctorId !== null) return doctorName?.trim() || 'The practitioner';
  if (block.branchId !== null) return block.branchName?.trim() ? `The ${block.branchName.trim()} branch` : 'The branch';
  return 'The practice';
}

/** "all day on 7 Oct 2026", "13:00-14:00 every weekday from 1 Oct 2026", "all day, 7-11 Oct 2026" */
export function diaryBlockWhen(block: DiaryBlock): string {
  const window = isAllDayBlock(block) ? 'all day' : formatTimeRange(block.startMinutes ?? 0, block.endMinutes ?? 0);
  if (block.recurrence === 'none') {
    const last = block.endDate ?? block.startDate;
    return last === block.startDate
      ? `${window} on ${formatDiaryDate(block.startDate)}`
      : `${window}, ${formatDiaryDateRange(block.startDate, last)}`;
  }
  const every =
    block.recurrence === 'weekdays'
      ? 'every weekday'
      : block.recurrence === 'weekly'
        ? `every ${WEEKDAY_NAMES[weekdayOfKey(block.startDate)] ?? 'week'}`
        : 'every day';
  const until = block.endDate ? ` until ${formatDiaryDate(block.endDate)}` : '';
  return `${window} ${every} from ${formatDiaryDate(block.startDate)}${until}`;
}

/** "N. Amupolo is unavailable 13:00-14:00 every weekday from 1 Oct 2026: Lunch" */
export function describeDiaryBlock(block: DiaryBlock, doctorName?: string | null): string {
  const verb = block.doctorId !== null ? 'is unavailable' : 'is closed';
  return `${diaryBlockWho(block, doctorName)} ${verb} ${diaryBlockWhen(block)}: ${block.reason}`;
}

/** The block as it affects one day, for the diary of that day: "N. Amupolo unavailable 13:00-14:00: Lunch" */
export function diaryBlockDayLabel(block: DiaryBlock, doctorName?: string | null): string {
  const branch = block.branchName?.trim();
  const who =
    block.doctorId !== null
      ? doctorName?.trim() || 'Practitioner'
      : block.branchId !== null
        ? (branch ? `${branch} branch` : 'Branch')
        : 'Practice';
  const verb = block.doctorId !== null ? 'unavailable' : 'closed';
  const window = isAllDayBlock(block) ? 'all day' : formatTimeRange(block.startMinutes ?? 0, block.endMinutes ?? 0);
  return `${who} ${verb} ${window}: ${block.reason}`;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/** A diary_blocks row (with the embedded branch name) as a DiaryBlock, or null when it can't be used. */
export function normalizeDiaryBlockRow(row: unknown): DiaryBlock | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const practiceId = text(r.practice_id);
  const reason = text(r.reason);
  const startDate = text(r.start_date)?.slice(0, 10) ?? null;
  if (!id || !practiceId || !reason || !startDate || !parseDateKey(startDate)) return null;

  const endDate = text(r.end_date)?.slice(0, 10) ?? null;
  if (endDate !== null && (!parseDateKey(endDate) || endDate < startDate)) return null;

  const startMinutes = timeToMinutes(text(r.start_time));
  const endMinutes = timeToMinutes(text(r.end_time));
  const hasWindow = startMinutes !== null && endMinutes !== null && endMinutes > startMinutes;

  const branch = Array.isArray(r.branch) ? r.branch[0] : r.branch;
  const branchName = branch && typeof branch === 'object' ? text((branch as Record<string, unknown>).name) : null;

  return {
    id,
    practiceId,
    branchId: text(r.branch_id),
    branchName,
    doctorId: text(r.doctor_id),
    reason,
    startDate,
    endDate,
    // A row without a usable window blocks the whole day rather than nothing
    startMinutes: hasWindow ? startMinutes : null,
    endMinutes: hasWindow ? endMinutes : null,
    recurrence: isRecurrence(r.recurrence) ? r.recurrence : 'none'
  };
}

export type DiaryBlockScope =
  | { kind: 'practice' }
  | { kind: 'branch'; branchId: string }
  | { kind: 'doctor'; doctorId: string };

/** What the "Block time" form collects. */
export interface DiaryBlockInput {
  scope: DiaryBlockScope;
  reason: string;
  /** 'yyyy-MM-dd' */
  startDate: string;
  /** One-off: the last day (required). Repeating: until when (optional). */
  endDate: string | null;
  allDay: boolean;
  /** 'HH:mm' when not all day */
  startTime: string | null;
  endTime: string | null;
  recurrence: DiaryBlockRecurrence;
}

/** The diary_blocks columns a new block is saved with (practice_id is added by the service). */
export interface DiaryBlockFields {
  branch_id: string | null;
  doctor_id: string | null;
  reason: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  recurrence: DiaryBlockRecurrence;
}

export type DiaryBlockValidation = { ok: true; fields: DiaryBlockFields } | { ok: false; errors: string[] };

/** Checks the form in plain words and returns the columns to save. Mirrors the SQL CHECK constraints. */
export function validateDiaryBlockInput(input: DiaryBlockInput): DiaryBlockValidation {
  const errors: string[] = [];
  const reason = input.reason.trim();
  if (!reason) errors.push('Give a reason, for example Leave, Lunch or Meeting.');
  else if (reason.length > DIARY_BLOCK_REASON_MAX) errors.push(`Keep the reason under ${DIARY_BLOCK_REASON_MAX} characters.`);

  if (input.scope.kind === 'doctor' && !input.scope.doctorId) errors.push('Choose the practitioner.');
  if (input.scope.kind === 'branch' && !input.scope.branchId) errors.push('Choose the branch.');

  const startOk = parseDateKey(input.startDate) !== null;
  if (!startOk) errors.push('Choose the first day.');
  const endDate = input.endDate && input.endDate.trim() !== '' ? input.endDate : null;
  if (endDate !== null && !parseDateKey(endDate)) errors.push('The last day is not a valid date.');
  else if (input.recurrence === 'none' && endDate === null) errors.push('Choose the last day.');
  else if (startOk && endDate !== null && endDate < input.startDate) errors.push("The last day can't be before the first day.");

  let startTime: string | null = null;
  let endTime: string | null = null;
  if (!input.allDay) {
    const start = timeToMinutes(input.startTime);
    const end = timeToMinutes(input.endTime);
    if (start === null || end === null) errors.push('Choose a start and end time, or tick "All day".');
    else if (end <= start) errors.push('The end time must be after the start time.');
    else {
      startTime = minutesToTime(start);
      endTime = minutesToTime(end);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    fields: {
      branch_id: input.scope.kind === 'branch' ? input.scope.branchId : null,
      doctor_id: input.scope.kind === 'doctor' ? input.scope.doctorId : null,
      reason,
      start_date: input.startDate,
      end_date: endDate,
      start_time: startTime,
      end_time: endTime,
      recurrence: input.recurrence
    }
  };
}
