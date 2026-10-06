/**
 * Single source of truth for where a visit is in the clinic's patient flow,
 * which earlier stages it may be moved back to, and how each stage is stored.
 *
 * Flow: scheduled -> checked in (waiting) -> with doctor -> with nurse (handoff) -> completed.
 * Real practices need to correct mistakes at the desk and in the consult room:
 * undo a check-in, send a patient back to the waiting room, take a patient back
 * from the nurse, reopen a visit completed by mistake, undo a no-show when the
 * patient walks in late, or restore a cancelled appointment.
 * Every change to `visits` is written to the audit log by a database trigger.
 */

export type VisitStage =
  | 'scheduled'
  | 'checked-in'
  | 'in-progress'
  | 'handed-off'
  | 'completed'
  | 'no-show'
  | 'cancelled';

export interface VisitStageFields {
  status?: string | null;
  is_checked_in?: boolean | null;
  is_ready?: boolean | null;
  is_handoff?: boolean | null;
  is_cancelled?: boolean | null;
}

export const STAGE_LABELS: Record<VisitStage, string> = {
  scheduled: 'Scheduled',
  'checked-in': 'Checked in (waiting)',
  'in-progress': 'With doctor',
  'handed-off': 'With nurse (handed off)',
  completed: 'Completed',
  'no-show': 'No-show',
  cancelled: 'Cancelled'
};

/** Derives the stage from the stored flags (works for raw visits and dashboard appointments). */
export function getVisitStage(visit: VisitStageFields): VisitStage {
  const status = visit.status ?? '';
  if (visit.is_cancelled || status === 'cancelled') return 'cancelled';
  if (status === 'no-show') return 'no-show';
  if (status === 'completed') return 'completed';
  if (visit.is_handoff) return 'handed-off';
  if (status === 'in-progress') return 'in-progress';
  if (visit.is_checked_in || visit.is_ready || status === 'ready') return 'checked-in';
  return 'scheduled';
}

const BACKWARD_MOVES: Record<VisitStage, VisitStage[]> = {
  scheduled: [],
  'checked-in': ['scheduled'],
  'in-progress': ['checked-in'],
  'handed-off': ['in-progress', 'checked-in'],
  completed: ['in-progress', 'handed-off'],
  'no-show': ['checked-in', 'scheduled'],
  cancelled: ['scheduled']
};

/** Earlier stages a visit in `stage` may be moved back to, most common first. */
export function getBackwardMoves(stage: VisitStage): VisitStage[] {
  return BACKWARD_MOVES[stage];
}

/** Button label for moving a visit from one stage back to another. */
export function getMoveLabel(from: VisitStage, to: VisitStage): string {
  if (from === 'completed') return to === 'handed-off' ? 'Reopen: back to nurse' : 'Reopen: back to doctor';
  if (from === 'no-show') return to === 'checked-in' ? 'Patient arrived (undo no-show)' : 'Undo no-show';
  if (from === 'cancelled') return 'Restore appointment';
  if (to === 'scheduled') return 'Undo check-in';
  if (to === 'checked-in') return 'Back to waiting room';
  if (to === 'in-progress') return 'Back to doctor';
  return `Move to ${STAGE_LABELS[to]}`;
}

/** Confirmation text shown before a stage correction is saved. */
export function getMoveConfirmMessage(from: VisitStage, to: VisitStage): string {
  const base = `Move this visit from "${STAGE_LABELS[from]}" to "${STAGE_LABELS[to]}"?`;
  if (from === 'cancelled') return `${base} Make sure the time slot is still free.`;
  return base;
}

/** Column values that represent each stage in the `visits` table. */
export function getStageUpdate(stage: VisitStage): Record<string, string | boolean> {
  switch (stage) {
    case 'scheduled':
      return { status: 'scheduled', is_checked_in: false, is_ready: false, is_handoff: false, is_cancelled: false };
    case 'checked-in':
      return { status: 'scheduled', is_checked_in: true, is_handoff: false, is_cancelled: false };
    case 'in-progress':
      return { status: 'in-progress', is_checked_in: true, is_handoff: false, is_cancelled: false };
    case 'handed-off':
      return { status: 'in-progress', is_checked_in: true, is_handoff: true, is_cancelled: false };
    case 'completed':
      return { status: 'completed' };
    case 'no-show':
      return { status: 'no-show' };
    case 'cancelled':
      return { status: 'cancelled', is_cancelled: true };
  }
}
