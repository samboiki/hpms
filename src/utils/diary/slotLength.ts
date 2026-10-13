/**
 * Each practitioner's diary slot (parity B6): 10, 15, 20, 30 or 60 minutes, set by a practice administrator in Diary
 * settings > Working hours. The day and week grids draw their rows at it, the booking form's time list offers start
 * times at it, and "Next free slot" looks at those times. A practitioner without one keeps what the diary did before:
 * rows of 30 minutes and start times every 15 minutes. Stored in diary_settings.practitioner_slots ({"<users.id>": 15};
 * proposals/2026-10-12-diary-statuses-and-types.sql, whose save_diary_settings() accepts the same lengths).
 */
import { GRID_SLOT_MINUTES } from './gridHours';

/** The slots Diary settings offers (and save_diary_settings accepts); each divides an hour, so slots meet the hour */
export const SLOT_LENGTH_OPTIONS = [10, 15, 20, 30, 60] as const;

/** Start times without a slot: every 15 minutes, as the booking form always offered */
export const DEFAULT_START_STEP = 15;

/** users.id -> minutes */
export type PractitionerSlots = Record<string, number>;

export const isSlotLength = (value: unknown): value is number =>
  typeof value === 'number' && (SLOT_LENGTH_OPTIONS as readonly number[]).includes(value);

/** diary_settings.practitioner_slots as stored, keeping only lengths the diary offers. */
export function normalizePractitionerSlots(raw: unknown): PractitionerSlots {
  const slots: PractitionerSlots = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return slots;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const minutes = typeof value === 'string' ? Number(value) : value;
    if (id && isSlotLength(minutes)) slots[id] = minutes;
  }
  return slots;
}

/** The practitioner's own slot, or null when none is saved. */
export function slotLengthOf(slots: PractitionerSlots | null | undefined, practitionerId: string | null | undefined): number | null {
  const minutes = practitionerId ? slots?.[practitionerId] : undefined;
  return isSlotLength(minutes) ? minutes : null;
}

/** The step of the booking form's start times and of "Next free slot" for a practitioner. */
export function startStepFor(slots: PractitionerSlots | null | undefined, practitionerId: string | null | undefined): number {
  return slotLengthOf(slots, practitionerId) ?? DEFAULT_START_STEP;
}

/** A practitioner's rows in the grids: their slot, else the diary's 30 minutes. */
export function gridSlotFor(slots: PractitionerSlots | null | undefined, practitionerId: string | null | undefined): number {
  return slotLengthOf(slots, practitionerId) ?? GRID_SLOT_MINUTES;
}

/**
 * The rows of a grid showing several practitioners: the shortest of their slots, so every practitioner's slots start
 * on a row (the day grid then draws each column's own slots; the week grid's rows are this length).
 */
export function gridRowMinutes(slots: PractitionerSlots | null | undefined, practitionerIds: Iterable<string | null | undefined>): number {
  let rows: number | null = null;
  for (const id of practitionerIds) {
    if (!id) continue;
    const minutes = gridSlotFor(slots, id);
    rows = rows === null ? minutes : Math.min(rows, minutes);
  }
  return rows ?? GRID_SLOT_MINUTES;
}

/**
 * The first start time of a time list at a practitioner's slot: `from` rounded down to the slot, so the list meets the
 * hour (a 20-minute practitioner gets 07:20, 07:40, 08:00 when the practice opens at 07:30, not 07:30, 07:50, 08:10).
 */
export function alignToSlot(minutes: number, step: number): number {
  const size = Math.max(5, Math.round(step));
  return Math.floor(minutes / size) * size;
}
