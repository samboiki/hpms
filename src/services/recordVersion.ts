/**
 * "Someone else changed this first" (parity Q12). The version of a patient's row, a visit or an invoice is its
 * updated_at: the database moves it on every change and records who made it in updated_by, and an invoice line change
 * moves its invoice's (proposals/2026-10-13-record-versions.sql). A screen keeps the versions of what it showed when it
 * was opened and asks checkRecordVersions before it saves: when nothing moved it saves as before; when something did,
 * RecordChangeGuard says who changed it and when, and the person chooses. The comparison and the words are pure
 * (tested); only readRecordVersions and loadPeopleNames read the database.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { addDaysToKey, formatServiceDate } from '../utils/billing/dates';
import { windhoekClock } from '../utils/patientLists/listDates';

// The generated database types do not know updated_by yet
const db = supabase as unknown as SupabaseClient;

export type VersionedRecord = 'patient' | 'visit' | 'invoice';

const TABLES: Record<VersionedRecord, string> = { patient: 'patients', visit: 'visits', invoice: 'invoices_enhanced' };

/** What each record is called in the warning */
export const RECORD_WORDS: Record<VersionedRecord, string> = {
  patient: "this patient's details",
  visit: 'this visit',
  invoice: "this visit's invoice"
};

/** The version a screen opened: the row's updated_at as read with the values it shows */
export interface OpenedVersion {
  kind: VersionedRecord;
  id: string;
  updatedAt: string | null;
}

/** What the database holds now */
export interface CurrentVersion {
  updatedAt: string | null;
  /** Who changed it last: a user id; null for an automatic change; undefined where the database does not record it */
  updatedBy: string | null | undefined;
}

export interface RecordChange {
  kind: VersionedRecord;
  id: string;
  /** When it changed last (updated_at now) */
  at: string | null;
  updatedBy: string | null | undefined;
}

export type VersionCheck =
  | { state: 'unchanged' }
  | { state: 'changed'; changes: RecordChange[]; current: OpenedVersion[] }
  /** Deleted since it was opened, or no longer visible to this person */
  | { state: 'gone'; kind: VersionedRecord }
  /** It could not be read (offline, a database error): the screen saves as it did before this check existed */
  | { state: 'not_checked'; reason: string };

export const versionKey = (kind: VersionedRecord, id: string): string => `${kind}:${id}`;

const STAMP = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/**
 * Microseconds since 1970 of a timestamp as the database returns it ("2026-10-12T19:15:31.123456+00:00"); null when it
 * cannot be read. Microseconds matter: two saves within the same millisecond are still two versions.
 */
export function stampMicros(value: string | null | undefined): number | null {
  const match = STAMP.exec((value ?? '').trim());
  if (!match) return null;
  const [, day, hours, minutes, seconds, fraction = '', zone = 'Z'] = match;
  const offset = zone === 'Z' ? 'Z' : zone.length === 3 ? `${zone}:00` : zone.includes(':') ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const millis = Date.parse(`${day}T${hours}:${minutes}:${seconds}${offset}`);
  return Number.isNaN(millis) ? null : millis * 1000 + Number(fraction.padEnd(6, '0'));
}

/** Whether the record changed since it was opened: the same instant written differently is not a change */
export function versionMoved(opened: string | null, current: string | null): boolean {
  if (opened === current) return false;
  const before = stampMicros(opened);
  const now = stampMicros(current);
  if (before === null || now === null) return (opened ?? '') !== (current ?? '');
  return before !== now;
}

/** The opened records that changed since (or are gone), from what the database holds now */
export function compareVersions(opened: readonly OpenedVersion[], now: ReadonlyMap<string, CurrentVersion>): VersionCheck {
  const changes: RecordChange[] = [];
  for (const version of opened) {
    const current = now.get(versionKey(version.kind, version.id));
    if (!current) return { state: 'gone', kind: version.kind };
    if (versionMoved(version.updatedAt, current.updatedAt)) {
      changes.push({ kind: version.kind, id: version.id, at: current.updatedAt, updatedBy: current.updatedBy });
    }
  }
  if (changes.length === 0) return { state: 'unchanged' };
  return {
    state: 'changed',
    changes,
    current: opened.map(version => ({ ...version, updatedAt: now.get(versionKey(version.kind, version.id))?.updatedAt ?? version.updatedAt }))
  };
}

const isMissingColumn = (error: { code?: string; message?: string }): boolean =>
  error.code === '42703' || error.code === 'PGRST204' || /updated_by/.test(error.message ?? '');

interface VersionRow {
  id: string;
  updated_at: string | null;
  updated_by?: string | null;
}

async function readVersionRows(kind: VersionedRecord, columns: string, ids: readonly string[]): Promise<{ rows: VersionRow[]; error: { code?: string; message: string } | null }> {
  const { data, error } = await db.from(TABLES[kind]).select(columns).in('id', [...ids]);
  return { rows: (data ?? []) as unknown as VersionRow[], error };
}

/** The current versions of the records (those this person can no longer see are left out) */
export async function readRecordVersions(records: ReadonlyArray<{ kind: VersionedRecord; id: string }>): Promise<Map<string, CurrentVersion>> {
  const result = new Map<string, CurrentVersion>();
  const kinds = [...new Set(records.map(record => record.kind))];
  await Promise.all(kinds.map(async kind => {
    const ids = [...new Set(records.filter(record => record.kind === kind).map(record => record.id))];
    let withWho = true;
    let read = await readVersionRows(kind, 'id, updated_at, updated_by', ids);
    // Before proposals/2026-10-13-record-versions.sql there is no updated_by: compare without saying who
    if (read.error && isMissingColumn(read.error)) {
      withWho = false;
      read = await readVersionRows(kind, 'id, updated_at', ids);
    }
    if (read.error) throw new Error(read.error.message);
    for (const row of read.rows) {
      result.set(versionKey(kind, row.id), { updatedAt: row.updated_at ?? null, updatedBy: withWho ? row.updated_by ?? null : undefined });
    }
  }));
  return result;
}

/** Compares what the screen opened with what is saved now; never throws */
export async function checkRecordVersions(opened: readonly OpenedVersion[]): Promise<VersionCheck> {
  if (opened.length === 0) return { state: 'unchanged' };
  try {
    return compareVersions(opened, await readRecordVersions(opened));
  } catch (error) {
    return { state: 'not_checked', reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Names of the people who changed the records (staff of the practice; anyone else stays unnamed) */
export async function loadPeopleNames(ids: ReadonlyArray<string | null | undefined>): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return {};
  const { data, error } = await db.from('users').select('id, full_name').in('id', unique);
  if (error) return {};
  return Object.fromEntries(((data ?? []) as Array<{ id: string; full_name: string | null }>).map(row => [row.id, row.full_name?.trim() || 'A colleague']));
}

export interface People {
  /** The signed-in person */
  meId: string | null;
  names: Readonly<Record<string, string>>;
}

/** Who made the change, in words */
export function changedBy(updatedBy: string | null | undefined, people: People): string {
  if (updatedBy === undefined) return 'Someone';
  if (updatedBy === null) return 'OneHealth (an automatic change)';
  if (people.meId && updatedBy === people.meId) return 'You';
  return people.names[updatedBy] ?? "Someone who is not on the practice's staff list (for example the patient app)";
}

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** "today at 10:42", "yesterday at 18:05" or "on 7 Oct 2026 at 10:42": Windhoek time, as the practice reads it */
export function changedWhen(at: string | null, now: Date = new Date()): string {
  const micros = stampMicros(at);
  if (micros === null) return 'recently';
  const clock = windhoekClock(new Date(Math.floor(micros / 1000)));
  const today = windhoekClock(now).dateKey;
  const time = `${pad2(Math.floor(clock.minutes / 60))}:${pad2(clock.minutes % 60)}`;
  if (clock.dateKey === today) return `today at ${time}`;
  if (clock.dateKey === addDaysToKey(today, -1)) return `yesterday at ${time}`;
  return `on ${formatServiceDate(clock.dateKey)} at ${time}`;
}

/** What "Save mine anyway" throws away, in one plain sentence: "Test Reception's change is lost." */
export function lostChangeWords(changes: readonly RecordChange[], people: People): string {
  const whose = [...new Set(changes.map(change => {
    const who = changedBy(change.updatedBy, people);
    if (who === 'You') return 'your other change';
    if (change.updatedBy === null) return 'the automatic change';
    if (change.updatedBy === undefined) return "the other person's change";
    return people.names[change.updatedBy] ? `${who}'s change` : 'that change';
  }))];
  const sentence = whose.join(' and ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)} ${whose.length > 1 ? 'are' : 'is'} lost.`;
}

/** One sentence per change: "Anna changed this visit today at 10:42, after you opened it." */
export function describeChanges(changes: readonly RecordChange[], people: People, now: Date = new Date()): string[] {
  return changes.map(change => {
    const who = changedBy(change.updatedBy, people);
    const when = changedWhen(change.at, now);
    if (who === 'You') return `You changed ${RECORD_WORDS[change.kind]} ${when}, in another window or another part of OneHealth, after this screen opened it.`;
    if (change.updatedBy === null) return `OneHealth changed ${RECORD_WORDS[change.kind]} automatically ${when}, after you opened it.`;
    return `${who} changed ${RECORD_WORDS[change.kind]} ${when}, after you opened it.`;
  });
}
