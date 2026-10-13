/**
 * Scripts and their repeats: how many repeats are left, when the next one falls due, and whether the script can
 * still be used. The due day is worked out the way patient_list_facts() does for the "Repeat medicine due" list
 * (proposals/2026-10-07-dispensing-and-stock.sql): the last dispensing of the script plus its days of medicine.
 */
import { addDaysToKey, daysBetweenKeys } from '../billing/dates';

export interface DispensingRecord {
  id: string;
  number: string;
  patientId: string;
  visitId: string | null;
  itemId: string;
  quantity: number;
  directions: string;
  directionsCode: string | null;
  prescribedAs: string | null;
  daysSupply: number | null;
  repeatsAllowed: number;
  /** The first dispensing of the script, for a repeat */
  repeatOf: string | null;
  isChronic: boolean;
  validUntil: string | null;
  prescriberId: string | null;
  billed: boolean;
  unitPriceCents: number | null;
  dispensedOn: string;
  createdAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
}

export type ScriptState = 'repeats_left' | 'all_used' | 'expired' | 'cancelled' | 'no_repeats';

export interface ScriptSummary {
  first: DispensingRecord;
  /** Repeats dispensed (not cancelled), oldest first */
  repeats: DispensingRecord[];
  repeatsLeft: number;
  lastDispensedOn: string;
  /** When the next repeat falls due; null without repeats left or without days of medicine */
  nextDueOn: string | null;
  state: ScriptState;
}

const byDay = (a: DispensingRecord, b: DispensingRecord): number =>
  a.dispensedOn.localeCompare(b.dispensedOn) || a.createdAt.localeCompare(b.createdAt);

/** One summary per script (a first dispensing and its repeats), the scripts with repeats due first */
export function summarizeScripts(records: readonly DispensingRecord[], todayKey: string): ScriptSummary[] {
  const repeatsOf = new Map<string, DispensingRecord[]>();
  for (const record of records) {
    if (record.repeatOf && !record.cancelledAt) {
      repeatsOf.set(record.repeatOf, [...(repeatsOf.get(record.repeatOf) ?? []), record]);
    }
  }
  const summaries = records
    .filter(record => record.repeatOf === null)
    .map((first): ScriptSummary => {
      const repeats = [...(repeatsOf.get(first.id) ?? [])].sort(byDay);
      const last = first.cancelledAt ? first : [first, ...repeats].sort(byDay)[repeats.length];
      const repeatsLeft = Math.max(first.repeatsAllowed - repeats.length, 0);
      const state: ScriptState = first.cancelledAt
        ? 'cancelled'
        : first.repeatsAllowed === 0
          ? 'no_repeats'
          : repeatsLeft === 0
            ? 'all_used'
            : first.validUntil !== null && first.validUntil < todayKey
              ? 'expired'
              : 'repeats_left';
      const days = last.daysSupply ?? first.daysSupply;
      return {
        first,
        repeats,
        repeatsLeft: state === 'repeats_left' ? repeatsLeft : 0,
        lastDispensedOn: last.dispensedOn,
        nextDueOn: state === 'repeats_left' && days !== null ? addDaysToKey(last.dispensedOn, days) : null,
        state
      };
    });
  return summaries.sort((a, b) =>
    (a.nextDueOn ?? '9999-12-31').localeCompare(b.nextDueOn ?? '9999-12-31') || b.lastDispensedOn.localeCompare(a.lastDispensedOn));
}

/** "Due today", "Due in 3 days (12 Oct)", "4 days overdue" for the patient file and the visit */
export function dueText(nextDueOn: string | null, todayKey: string, formatDay: (key: string) => string): string | null {
  if (!nextDueOn) return null;
  const days = daysBetweenKeys(todayKey, nextDueOn);
  if (days === 0) return 'Due today';
  if (days < 0) return `${-days} day${days === -1 ? '' : 's'} overdue (since ${formatDay(nextDueOn)})`;
  return `Due in ${days} day${days === 1 ? '' : 's'} (${formatDay(nextDueOn)})`;
}

export const SCRIPT_STATE_LABELS: Readonly<Record<ScriptState, string>> = {
  repeats_left: 'Repeats left',
  all_used: 'All repeats dispensed',
  expired: 'Repeats expired',
  cancelled: 'Cancelled',
  no_repeats: 'No repeats'
};
