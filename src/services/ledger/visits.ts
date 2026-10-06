import { getVisitStage, type VisitStage } from '../../utils/visitStage';
import { shareOf } from './money';
import { dateKeyFrom, isInRange, monthKeyOf, monthKeysInRange, type DateRange } from './dates';

// ---------------------------------------------------------------------------------------------
// Visits (appointments and walk-ins)
// ---------------------------------------------------------------------------------------------

/** visits columns the Finance page reads */
export interface RawVisitRow {
  id: string;
  doctor_id?: string | null;
  visit_date?: string | null;
  scheduled_date?: string | null;
  status?: string | null;
  is_cancelled?: boolean | null;
  is_checked_in?: boolean | null;
  is_ready?: boolean | null;
  is_handoff?: boolean | null;
}

export interface LedgerVisit {
  id: string;
  doctorId: string | null;
  /** The appointment day: the scheduled date (moved when rescheduled), else the visit date */
  dateKey: string | null;
  /** Where the visit is in the patient flow, from the shared stage rules (utils/visitStage) */
  stage: VisitStage;
}

/**
 * The live visits table rejects the status 'no-show', so a missed appointment is saved as
 * cancelled with a note that starts with this marker.
 */
export const NO_SHOW_NOTE_MARKER = '[Cancelled: did not attend (no-show)]';

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * A visit's day is its scheduled date, falling back to the visit date (walk-ins only have a
 * visit date), the same rule the diary uses to place appointments. A cancelled visit whose id is
 * in `noShowNoteIds` (its note starts with NO_SHOW_NOTE_MARKER) was a missed appointment.
 */
export function normalizeVisit(row: RawVisitRow, noShowNoteIds: ReadonlySet<string> = NO_IDS): LedgerVisit {
  const stage = getVisitStage(row);
  return {
    id: row.id,
    doctorId: row.doctor_id ?? null,
    dateKey: dateKeyFrom(row.scheduled_date) ?? dateKeyFrom(row.visit_date),
    stage: stage === 'cancelled' && noShowNoteIds.has(row.id) ? 'no-show' : stage
  };
}

// ---------------------------------------------------------------------------------------------
// Appointments and attendance
// ---------------------------------------------------------------------------------------------

export interface AttendanceMonthRow {
  monthKey: string;
  /** Every visit on a day of the month in the range: appointments and walk-ins */
  booked: number;
  /** Completed */
  attended: number;
  noShows: number;
  cancelled: number;
  /** Still scheduled, waiting, with the doctor or with the nurse: never closed */
  open: number;
  /** noShows / booked; null when nothing was booked */
  noShowRate: number | null;
  /** cancelled / booked; null when nothing was booked */
  cancellationRate: number | null;
}

export type AttendanceSummary = Omit<AttendanceMonthRow, 'monthKey'>;

type AttendanceCounts = Pick<AttendanceMonthRow, 'booked' | 'attended' | 'noShows' | 'cancelled' | 'open'>;

const COUNT_BY_STAGE: Record<VisitStage, keyof AttendanceCounts> = {
  completed: 'attended',
  'no-show': 'noShows',
  cancelled: 'cancelled',
  scheduled: 'open',
  'checked-in': 'open',
  'in-progress': 'open',
  'handed-off': 'open'
};

const withRates = (counts: AttendanceCounts): AttendanceSummary => ({
  ...counts,
  noShowRate: shareOf(counts.noShows, counts.booked),
  cancellationRate: shareOf(counts.cancelled, counts.booked)
});

/** Totals over months, with the rates recomputed from the totals (never averaged) */
export function summarizeAttendance(rows: AttendanceMonthRow[]): AttendanceSummary {
  const sum = (key: keyof AttendanceCounts) => rows.reduce((total, row) => total + row[key], 0);
  return withRates({ booked: sum('booked'), attended: sum('attended'), noShows: sum('noShows'), cancelled: sum('cancelled'), open: sum('open') });
}

/**
 * One row per month the range touches (zero rows included): every visit on a day in the range
 * counts once, in its month, by how it ended. Booked = attended + no-shows + cancelled + open.
 */
export function attendanceByMonth(visits: LedgerVisit[], range: DateRange): AttendanceMonthRow[] {
  const months = new Map<string, AttendanceCounts>(
    monthKeysInRange(range).map(key => [key, { booked: 0, attended: 0, noShows: 0, cancelled: 0, open: 0 }])
  );
  for (const visit of visits) {
    const dateKey = visit.dateKey;
    if (!dateKey || !isInRange(dateKey, range)) continue;
    const counts = months.get(monthKeyOf(dateKey));
    if (!counts) continue;
    counts.booked += 1;
    counts[COUNT_BY_STAGE[visit.stage]] += 1;
  }
  return [...months.entries()].map(([monthKey, counts]) => ({ monthKey, ...withRates(counts) }));
}
