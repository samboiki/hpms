/**
 * The diary report's "Move to a recall list" (parity O5) also gives each patient a recall (patient_recalls, through
 * set_patient_recall and its rules), so they come due on the "Recall due" list and the recall closes once they book;
 * a list entry alone did neither. This file only decides which recall each patient gets; patientRecallService sets them.
 *  - No-shows by patient: a recall due today, "Missed appointment on 7 Oct 2026" (their latest miss of the period). A
 *    patient who already has that recall still to do keeps it, so moving them twice adds no second one.
 *  - Recalled but not seen: their recall moves to today with its reason, as Eminance's "Move no shows" does. It is due
 *    now, closes when they book, and leaves the period's "Recalled but not seen" list.
 * Dates are Windhoek date keys ('yyyy-MM-dd').
 */
import { tidyRecallReason, type PatientRecall } from '../patientLists/recalls';
import { formatDiaryDate } from './diaryTime';

export interface ReportRecall {
  patientId: string;
  dueOn: string;
  reason: string;
  /** The recall to move (its date changes); null sets a new one */
  recallId: string | null;
}

/** "Missed appointment on 7 Oct 2026" */
export const missedAppointmentReason = (date: string): string => `Missed appointment on ${formatDiaryDate(date)}`;

const key = (patientId: string, reason: string): string => `${patientId}|${tidyRecallReason(reason).toLowerCase()}`;

/** A recall due today for each patient who missed an appointment, unless they already have that recall to do. */
export function noShowRecalls(
  rows: ReadonlyArray<{ patientId: string; dates: readonly string[] }>,
  inForce: readonly PatientRecall[],
  todayKey: string
): ReportRecall[] {
  const held = new Set(inForce.filter((recall) => recall.status === 'open' || recall.status === 'booked').map((recall) => key(recall.patientId, recall.reason)));
  const recalls: ReportRecall[] = [];
  for (const row of rows) {
    const lastMissed = [...row.dates].sort().pop();
    if (!lastMissed) continue;
    const reason = missedAppointmentReason(lastMissed);
    if (held.has(key(row.patientId, reason))) continue;
    held.add(key(row.patientId, reason));
    recalls.push({ patientId: row.patientId, dueOn: todayKey, reason, recallId: null });
  }
  return recalls;
}

/** Each recall whose day passed with nothing booked, moved to today with its own reason. */
export function movedRecalls(recalls: readonly PatientRecall[], todayKey: string): ReportRecall[] {
  return recalls
    .filter((recall) => recall.status === 'open' && recall.dueOn < todayKey)
    .map((recall) => ({ patientId: recall.patientId, dueOn: todayKey, reason: recall.reason, recallId: recall.id }));
}

/** What staff read after the recalls were set: how many, and the first refusal in the database's own words. */
export function reportRecallsMessage(
  kind: 'no_shows' | 'not_seen',
  result: { set: number; refused: number; firstRefusal: string | null }
): { text: string; tone: 'success' | 'error' } {
  const { set, refused, firstRefusal } = result;
  if (set === 0 && refused === 0) return { text: 'Everyone listed already has this recall to do.', tone: 'success' };
  const done =
    set === 0
      ? ''
      : kind === 'no_shows'
        ? `${set} ${set === 1 ? 'recall' : 'recalls'} set for today`
        : `${set} ${set === 1 ? 'recall moves' : 'recalls move'} to today`;
  if (refused === 0) return { text: `${done}: each closes when the patient books.`, tone: 'success' };
  const failed = `${refused} could not be set${firstRefusal ? `: ${firstRefusal}` : ''}`;
  return { text: done ? `${done}; ${failed}` : failed, tone: 'error' };
}
