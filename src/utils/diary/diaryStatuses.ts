/**
 * A practice's own booking statuses (parity B3): "Waiting for X-ray", "Called, no answer", each with a name and a
 * colour. Each one belongs to one fixed stage (src/utils/visitStage.ts): billing, reminders and reports keep using the
 * stages, a status only adds the words reception chooses. A status shows on a booking while the booking is at its
 * stage (a "Called, no answer" label never sits on a completed visit), and visit actions offer the statuses of the
 * booking's current stage. Stored in diary_statuses; a booking's status in visits.diary_status_id
 * (proposals/2026-10-12-diary-statuses-and-types.sql, whose save_diary_status() checks the same rules).
 */
import { VISIT_STAGES, getVisitStage, isVisitStage, type VisitStage, type VisitStageFields } from '../visitStage';

/** The colours a status can have (the CHECK constraint on diary_statuses.colour) */
export const DIARY_STATUS_COLOURS = ['blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'purple', 'gray'] as const;
export type DiaryStatusColour = (typeof DIARY_STATUS_COLOURS)[number];

/**
 * Written out in full so Tailwind keeps them. The chip's words stay dark on a pale tint (readable in every colour); the
 * dot carries the colour, and the words are always there, so colour is never the only signal.
 */
export const DIARY_STATUS_COLOUR_STYLES: Record<DiaryStatusColour, { label: string; chip: string; dot: string }> = {
  blue: { label: 'Blue', chip: 'bg-blue-50 text-blue-900 ring-blue-200', dot: 'bg-blue-500' },
  teal: { label: 'Teal', chip: 'bg-teal-50 text-teal-900 ring-teal-200', dot: 'bg-teal-500' },
  green: { label: 'Green', chip: 'bg-green-50 text-green-900 ring-green-200', dot: 'bg-green-500' },
  amber: { label: 'Amber', chip: 'bg-amber-50 text-amber-900 ring-amber-200', dot: 'bg-amber-500' },
  orange: { label: 'Orange', chip: 'bg-orange-50 text-orange-900 ring-orange-200', dot: 'bg-orange-500' },
  red: { label: 'Red', chip: 'bg-red-50 text-red-900 ring-red-200', dot: 'bg-red-500' },
  pink: { label: 'Pink', chip: 'bg-pink-50 text-pink-900 ring-pink-200', dot: 'bg-pink-500' },
  purple: { label: 'Purple', chip: 'bg-purple-50 text-purple-900 ring-purple-200', dot: 'bg-purple-500' },
  gray: { label: 'Grey', chip: 'bg-gray-100 text-gray-800 ring-gray-200', dot: 'bg-gray-500' }
};

/** Same limits as save_diary_status() */
export const DIARY_STATUS_NAME_MAX = 40;
export const DIARY_STATUSES_MAX = 30;

export interface DiaryStatus {
  id: string;
  name: string;
  colour: DiaryStatusColour;
  stage: VisitStage;
  /** false once removed: no longer offered, but bookings that have it still show it */
  isActive: boolean;
}

const isColour = (value: unknown): value is DiaryStatusColour =>
  typeof value === 'string' && (DIARY_STATUS_COLOURS as readonly string[]).includes(value);

/** A diary_statuses row, or null when it can't be used. */
export function normalizeDiaryStatusRow(row: unknown): DiaryStatus | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : '';
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!id || !name || !isVisitStage(r.stage)) return null;
  return { id, name, colour: isColour(r.colour) ? r.colour : 'gray', stage: r.stage, isActive: r.is_active !== false };
}

/** In the order of the flow (booked first), then by name: how Diary settings and the report list them. */
export function sortDiaryStatuses(statuses: DiaryStatus[]): DiaryStatus[] {
  const position = (stage: VisitStage) => VISIT_STAGES.indexOf(stage);
  return [...statuses].sort((a, b) => position(a.stage) - position(b.stage) || a.name.localeCompare(b.name));
}

export interface DiaryStatusInput {
  name: string;
  colour: string;
  stage: string;
}

export type DiaryStatusValidation =
  | { ok: true; value: { name: string; colour: DiaryStatusColour; stage: VisitStage } }
  | { ok: false; errors: string[] };

/** Checks the Diary settings form in plain words, before the database does the same (save_diary_status). */
export function validateDiaryStatus(input: DiaryStatusInput, existing: DiaryStatus[], editingId: string | null = null): DiaryStatusValidation {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push('Name the status, for example "Waiting for X-ray".');
  else if (name.length > DIARY_STATUS_NAME_MAX) errors.push(`Keep the name to ${DIARY_STATUS_NAME_MAX} characters.`);
  else if (existing.some((status) => status.isActive && status.id !== editingId && status.name.toLowerCase() === name.toLowerCase())) {
    errors.push(`There is already a status called "${name}".`);
  }
  if (!isColour(input.colour)) errors.push('Choose a colour.');
  if (!isVisitStage(input.stage)) errors.push('Choose the step of the visit the status belongs to.');
  if (!editingId && existing.filter((status) => status.isActive).length >= DIARY_STATUSES_MAX) {
    errors.push(`A practice can have ${DIARY_STATUSES_MAX} statuses: remove one first.`);
  }
  if (errors.length > 0 || !isColour(input.colour) || !isVisitStage(input.stage)) return { ok: false, errors };
  return { ok: true, value: { name, colour: input.colour, stage: input.stage } };
}

/** A booking as the diary holds it: its stage flags and its own status */
export interface StatusedBooking extends VisitStageFields {
  diary_status_id?: string | null;
}

/**
 * The status the diary shows on a booking: its own status while the booking is at that status's stage, else none
 * (the fixed stage speaks for itself). A removed status still shows on the bookings that have it.
 */
export function shownDiaryStatus(statuses: DiaryStatus[], booking: StatusedBooking): DiaryStatus | null {
  if (!booking.diary_status_id) return null;
  const status = statuses.find((item) => item.id === booking.diary_status_id);
  return status && status.stage === getVisitStage(booking) ? status : null;
}

/** The statuses visit actions offer for a booking: the practice's statuses for the booking's current stage. */
export function diaryStatusChoices(statuses: DiaryStatus[], booking: VisitStageFields): DiaryStatus[] {
  const stage = getVisitStage(booking);
  return sortDiaryStatuses(statuses.filter((status) => status.isActive && status.stage === stage));
}

export interface DiaryStatusCount {
  status: DiaryStatus;
  /** The bookings that have it (the last status each was given), for the list the count opens */
  bookingIds: string[];
}

/**
 * The diary report's "By status": for each of the practice's statuses (removed ones only when a booking has them), the
 * bookings of the period that were last given it. Unknown ids (another practice's, or deleted) are not counted.
 */
export function countByDiaryStatus(bookings: Array<{ id: string; statusId?: string | null }>, statuses: DiaryStatus[]): DiaryStatusCount[] {
  const byStatus = new Map<string, string[]>();
  for (const booking of bookings) {
    if (!booking.statusId) continue;
    byStatus.set(booking.statusId, [...(byStatus.get(booking.statusId) ?? []), booking.id]);
  }
  return sortDiaryStatuses(statuses)
    .filter((status) => status.isActive || byStatus.has(status.id))
    .map((status) => ({ status, bookingIds: byStatus.get(status.id) ?? [] }));
}
