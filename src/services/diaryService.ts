/**
 * Diary data: blocked time (table diary_blocks, proposals/2026-10-07-diary.sql), the checks made
 * before a booking is saved, and the "next free slot" search. The rules live in src/utils/diary (pure
 * and tested); this file only talks to Supabase.
 *
 * Until the SQL proposal is applied diary_blocks does not exist: blocked-time loads return
 * 'not_enabled', the diary shows no blocked time, and bookings are still checked for clashes,
 * same-day duplicates and public holidays.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
  normalizeDiaryBlockRow,
  validateDiaryBlockInput,
  type DiaryBlock,
  type DiaryBlockInput
} from '../utils/diary/blockedTime';
import {
  findBookingWarnings,
  takenStartTimes,
  type BookingProposal,
  type BookingWarning,
  type DayVisit,
  type LegacyAppointment
} from '../utils/diary/bookingChecks';
import { countTypeBookings, dailyLimitWarning, type AppointmentType, type TypedBooking } from '../utils/diary/appointmentTypes';
import type { TypeLengths } from '../utils/diary/bookingLength';
import { isMissingColumnError, isMissingTableError } from '../utils/diary/dbErrors';
import { addDaysToKey, toDateKey, weekdayOfKey } from '../utils/diary/diaryTime';
import { findNextFreeSlot, practiceHoursResolver, type FreeSlot } from '../utils/diary/nextFreeSlot';
import { visitDay } from '../utils/diary/visitOverlap';
import type { SeriesDateWarnings } from '../utils/diary/repeatBookings';
import { practitionerDayHours, practitionerHoursResolver, type PractitionerDay, type WorkingHoursRow } from '../utils/diary/workingHours';
import type { Visit } from '../types/enhanced-visit.types';

// diary_blocks is not in the generated database types yet, so it is read with the untyped client and
// every row is checked at runtime (normalizeDiaryBlockRow)
const db = supabase as unknown as SupabaseClient;

export const DIARY_BLOCKS_TABLE = 'diary_blocks';
const BLOCK_COLUMNS =
  'id, practice_id, branch_id, doctor_id, reason, start_date, end_date, start_time, end_time, recurrence, branch:branches(name)';
const VISIT_COLUMNS_BASE = 'id, patient_id, doctor_id, visit_date, visit_time, scheduled_date, scheduled_time, status, is_cancelled, visit_type';

// Columns later diary updates added to visits: duration_minutes (proposals/2026-10-07-diary-2.sql), the practice's
// own status and appointment type (proposals/2026-10-12-diary-statuses-and-types.sql). Until a column exists, reads
// leave it out (a booking is its type's default length, without a status or type) and writes are retried without
// it, so booking works before the update
const OPTIONAL_VISIT_COLUMNS = ['duration_minutes', 'diary_status_id', 'appointment_type_id'] as const;
type OptionalVisitColumn = (typeof OPTIONAL_VISIT_COLUMNS)[number];
const missingVisitColumns = new Set<OptionalVisitColumn>();

/** True when the error says this column does not exist (yet). */
const namesMissingColumn = (error: unknown, column: OptionalVisitColumn): boolean =>
  isMissingColumnError(error) && String((error as { message?: unknown } | null)?.message ?? '').includes(column);

/** The optional column a "column does not exist" error names, if it is one not already left out. */
const missingOptionalColumn = (error: unknown): OptionalVisitColumn | null =>
  OPTIONAL_VISIT_COLUMNS.find((column) => !missingVisitColumns.has(column) && namesMissingColumn(error, column)) ?? null;

/** The visits columns the diary reads: with the booked length, status and type once the columns exist. */
const visitColumns = (): string =>
  [VISIT_COLUMNS_BASE, ...OPTIONAL_VISIT_COLUMNS.filter((column) => !missingVisitColumns.has(column))].join(', ');

/**
 * Runs a visits read that selects visitColumns(); when one of the newer columns is not there yet, runs it again
 * without it.
 */
async function readVisits<T>(run: (columns: string) => PromiseLike<{ data: unknown; error: unknown }>): Promise<{ data: T | null; error: unknown }> {
  let result = await run(visitColumns());
  for (let column = missingOptionalColumn(result.error); result.error && column; column = missingOptionalColumn(result.error)) {
    missingVisitColumns.add(column);
    result = await run(visitColumns());
  }
  // The column list is built at run time, so the client cannot type the rows: the caller names them
  return { data: (result.data ?? null) as T | null, error: result.error };
}

/** The booked length to save on a visit ({} while visits has no duration_minutes column yet). */
export function bookingLengthFields(minutes: number | null | undefined): { duration_minutes?: number } {
  return missingVisitColumns.has('duration_minutes') || !minutes ? {} : { duration_minutes: Math.round(minutes) };
}

/**
 * Saves a visit with its booked length; when the database does not have the length column yet, saves
 * it again without the length, so bookings keep working before the diary update.
 */
export async function writeWithBookingLength<T>(
  minutes: number | null | undefined,
  write: (lengthFields: { duration_minutes?: number }) => PromiseLike<{ data: T | null; error: unknown }>
): Promise<{ data: T | null; error: unknown }> {
  const fields = bookingLengthFields(minutes);
  const first = await write(fields);
  if (first.error && 'duration_minutes' in fields && namesMissingColumn(first.error, 'duration_minutes')) {
    missingVisitColumns.add('duration_minutes');
    return write({});
  }
  return first;
}

/**
 * The practice's appointment type to save on a visit ({} for none, or while visits has no appointment_type_id column
 * yet, so the booking is still saved before the diary update).
 */
export function appointmentTypeFields(typeId: string | null | undefined): { appointment_type_id?: string | null } {
  return missingVisitColumns.has('appointment_type_id') || typeId === undefined ? {} : { appointment_type_id: typeId };
}

/**
 * Saves a visit with its appointment type; when the database does not have the column yet, saves it again without the
 * type (the booking keeps its visit type and length).
 */
export async function writeWithAppointmentType<T>(
  typeId: string | null | undefined,
  write: (typeFields: { appointment_type_id?: string | null }) => PromiseLike<{ data: T | null; error: unknown }>
): Promise<{ data: T | null; error: unknown }> {
  const fields = appointmentTypeFields(typeId);
  const first = await write(fields);
  if (first.error && 'appointment_type_id' in fields && namesMissingColumn(first.error, 'appointment_type_id')) {
    missingVisitColumns.add('appointment_type_id');
    return write({});
  }
  return first;
}

export const DIARY_NOT_ENABLED_MESSAGE =
  'Blocked time is not switched on yet. Your administrator needs to apply the diary update first.';

export type DiaryBlocksLoad =
  | { state: 'ready'; blocks: DiaryBlock[] }
  | { state: 'not_enabled' }
  | { state: 'error'; message: string };

// While the table is missing, every day clicked in the diary would send a request that fails; ask
// again after a few minutes instead (a reload after the SQL is applied picks it up at once)
const NOT_ENABLED_RECHECK_MS = 5 * 60 * 1000;
let blocksMissingSince: number | null = null;

/** The practice's blocks that cover any day from fromKey to toKey (inclusive, 'yyyy-MM-dd'). */
export async function loadDiaryBlocks(practiceId: string, fromKey: string, toKey: string): Promise<DiaryBlocksLoad> {
  if (blocksMissingSince !== null && Date.now() - blocksMissingSince < NOT_ENABLED_RECHECK_MS) return { state: 'not_enabled' };
  const { data, error } = await db
    .from(DIARY_BLOCKS_TABLE)
    .select(BLOCK_COLUMNS)
    .eq('practice_id', practiceId)
    .lte('start_date', toKey)
    .or(`end_date.is.null,end_date.gte.${fromKey}`)
    .order('start_date', { ascending: true })
    .limit(500);
  if (error) {
    if (isMissingTableError(error, DIARY_BLOCKS_TABLE)) {
      blocksMissingSince = Date.now();
      return { state: 'not_enabled' };
    }
    console.error('Could not load blocked time:', error);
    return { state: 'error', message: error.message };
  }
  blocksMissingSince = null;
  const blocks = ((data ?? []) as unknown[])
    .map(normalizeDiaryBlockRow)
    .filter((block): block is DiaryBlock => block !== null);
  return { state: 'ready', blocks };
}

export type DiaryBlockSave =
  | { ok: true; block: DiaryBlock }
  | { ok: false; message: string; notEnabled?: boolean };

/** Saves a new block after checking it (created_by is filled in by the database). */
export async function saveDiaryBlock(practiceId: string, input: DiaryBlockInput): Promise<DiaryBlockSave> {
  const checked = validateDiaryBlockInput(input);
  if (!checked.ok) return { ok: false, message: checked.errors.join(' ') };

  const { data, error } = await db
    .from(DIARY_BLOCKS_TABLE)
    .insert({ practice_id: practiceId, ...checked.fields })
    .select(BLOCK_COLUMNS)
    .single();
  if (error) {
    if (isMissingTableError(error, DIARY_BLOCKS_TABLE)) return { ok: false, notEnabled: true, message: DIARY_NOT_ENABLED_MESSAGE };
    console.error('Could not save blocked time:', error);
    return { ok: false, message: `Not saved: ${error.message}` };
  }
  const block = normalizeDiaryBlockRow(data);
  return block ? { ok: true, block } : { ok: false, message: 'Saved, but the block could not be read back. Reload the diary.' };
}

/** Removes a block. A delete that row-level security refuses removes nothing and reports no error. */
export async function removeDiaryBlock(blockId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await db.from(DIARY_BLOCKS_TABLE).delete().eq('id', blockId).select('id');
  if (error) {
    console.error('Could not remove blocked time:', error);
    return { ok: false, message: `Not removed: ${error.message}` };
  }
  if (!data || data.length === 0) {
    return { ok: false, message: 'Not removed: this block belongs to another practice or was already removed.' };
  }
  return { ok: true };
}

export interface PracticeBranch {
  id: string;
  name: string;
}

/** Active branches of the practice, for "branch closed" blocks ([] when they cannot be read). */
export async function loadPracticeBranches(practiceId: string): Promise<PracticeBranch[]> {
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, is_active')
    .eq('practice_id', practiceId)
    .order('name', { ascending: true });
  if (error) {
    console.error('Could not load branches for blocked time:', error);
    return [];
  }
  return (data ?? []).filter((branch) => branch.is_active !== false).map((branch) => ({ id: branch.id, name: branch.name }));
}

/** The practice's visits on one day (bookings are matched on scheduled_date, then visit_date). */
async function loadDayVisits(practiceId: string, dateKey: string): Promise<DayVisit[]> {
  const { data, error } = await readVisits<DayVisit[]>((columns) =>
    db
      .from('visits')
      .select(columns)
      .eq('practice_id', practiceId)
      .or(`scheduled_date.eq.${dateKey},visit_date.eq.${dateKey}`)
  );
  if (error) {
    console.error('Could not load the day for the booking check:', error);
    throw new Error('Could not check the diary for clashes. Please try again.');
  }
  return ((data ?? []) as DayVisit[]).filter((visit) => visitDay(visit) === dateKey);
}

/**
 * Start times the practitioner's bookings take that day (each as long as it was booked), so the
 * booking form's time list marks them. The booking being edited does not count. `step`: the time
 * list's step (the practitioner's slot, slotLength.ts).
 */
export async function loadBookedTimes(
  doctorId: string,
  dateKey: string,
  lengths: TypeLengths | null | undefined,
  ignoreVisitId?: string | null,
  step?: number
): Promise<string[]> {
  const { data, error } = await readVisits<DayVisit[]>((columns) =>
    db.from('visits').select(columns).eq('doctor_id', doctorId).eq('scheduled_date', dateKey)
  );
  if (error) throw error;
  return takenStartTimes(data ?? [], lengths, ignoreVisitId, step);
}

/**
 * The practitioner's bookings of a practice appointment type on the given days, for its daily limit. [] before the
 * diary update (no booking has a type then). Throws when they cannot be read, so a failed check never looks clear.
 */
async function loadTypeBookings(practiceId: string, doctorId: string, typeId: string, dates: string[]): Promise<TypedBooking[]> {
  if (missingVisitColumns.has('appointment_type_id') || dates.length === 0) return [];
  const { data, error } = await db
    .from('visits')
    .select('id, doctor_id, appointment_type_id, scheduled_date, visit_date, status, is_cancelled')
    .eq('practice_id', practiceId)
    .eq('doctor_id', doctorId)
    .eq('appointment_type_id', typeId)
    .in('scheduled_date', dates);
  if (error) {
    // Another read running at the same time may have noticed it first
    if (namesMissingColumn(error, 'appointment_type_id')) {
      missingVisitColumns.add('appointment_type_id');
      return [];
    }
    console.error('Could not count the bookings of the appointment type:', error);
    throw new Error('Could not check the appointment type\'s daily limit. Please try again.');
  }
  return (data ?? []) as TypedBooking[];
}

/** The daily-limit warning for one day of a proposal (null when the type has no limit or the day is not full). */
function typeLimitWarning(
  type: AppointmentType | null | undefined,
  bookings: TypedBooking[],
  proposal: BookingProposal,
  practitionerName?: (id: string) => string | null | undefined
): BookingWarning | null {
  if (!type || type.dailyLimit === null) return null;
  const booked = countTypeBookings(bookings, { typeId: type.id, practitionerId: proposal.doctorId, date: proposal.date, ignoreVisitId: proposal.visitId });
  return dailyLimitWarning(type, booked, proposal.date, practitionerName?.(proposal.doctorId));
}

/** The practitioner's rows in the older appointments table that day; the old check looked there too. */
async function loadLegacyAppointments(doctorId: string, dateKey: string): Promise<LegacyAppointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, time, duration')
    .eq('doctor_id', doctorId)
    .eq('date', dateKey)
    .neq('status', 'cancelled');
  // Optional: this table is not where the diary keeps bookings, so a failure must not stop one
  if (error) return [];
  return (data ?? []).map((row) => ({ id: row.id, time: row.time, duration: row.duration }));
}

export interface BookingCheckRequest {
  practiceId: string;
  proposal: BookingProposal;
  /** Practitioner names for the messages */
  practitionerName?: (id: string) => string | null | undefined;
  /** Lower-case weekday when the practice's business hours say it is closed that day */
  closedWeekday?: string | null;
  /** The practice's default length per visit type (for the other bookings without a stored length) */
  lengths?: TypeLengths | null;
  /** The practitioner's working hours that day (undefined: none saved, no check) */
  practitionerDay?: PractitionerDay | null;
  /** The practice's appointment type the booking is made as: its daily limit is checked too */
  appointmentType?: AppointmentType | null;
}

/**
 * Everything reception should see before the booking is saved (empty: nothing to confirm). Throws
 * when the day's bookings cannot be read, so a failed check never looks like a free slot.
 */
export async function checkBooking(request: BookingCheckRequest): Promise<BookingWarning[]> {
  const { proposal } = request;
  const limitType = request.appointmentType?.dailyLimit ? request.appointmentType : null;
  const [visits, legacyAppointments, blocks, typeBookings] = await Promise.all([
    loadDayVisits(request.practiceId, proposal.date),
    loadLegacyAppointments(proposal.doctorId, proposal.date),
    loadDiaryBlocks(request.practiceId, proposal.date, proposal.date),
    limitType ? loadTypeBookings(request.practiceId, proposal.doctorId, limitType.id, [proposal.date]) : Promise.resolve([])
  ]);
  const warnings = findBookingWarnings({
    proposal,
    visits,
    legacyAppointments,
    blocks: blocks.state === 'ready' ? blocks.blocks : [],
    doctorName: request.practitionerName,
    closedWeekday: request.closedWeekday,
    lengths: request.lengths,
    practitionerDay: request.practitionerDay
  });
  const limit = typeLimitWarning(limitType, typeBookings, proposal, request.practitionerName);
  return limit ? [...warnings, limit] : warnings;
}

/** A booking of a period with its patient's name, for the diary report and the patient's bookings */
export interface RangeVisit extends DayVisit {
  is_checked_in?: boolean | null;
  is_ready?: boolean | null;
  /** The practice's own status (null or absent before the diary update) */
  diary_status_id?: string | null;
  patient?: { first_name: string | null; last_name: string | null } | null;
}

const RANGE_PAGE = 1000;
const RANGE_MAX_PAGES = 10;

/**
 * Every booking of the practice from `from` to `to` ('yyyy-MM-dd', on scheduled_date), read in pages
 * of 1000 (the API's limit per request). Optionally one patient's only. Throws when it cannot read.
 */
export async function loadVisitsInRange(
  practiceId: string,
  from: string,
  to: string,
  options: { patientId?: string } = {}
): Promise<RangeVisit[]> {
  const rows: RangeVisit[] = [];
  for (let page = 0; page < RANGE_MAX_PAGES; page++) {
    const { data, error } = await readVisits<RangeVisit[]>((columns) => {
      let query = db
        .from('visits')
        .select(`${columns}, is_checked_in, is_ready, practice_id, patient:patients!visits_patient_id_fkey(first_name, last_name)`)
        .eq('practice_id', practiceId)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to);
      if (options.patientId) query = query.eq('patient_id', options.patientId);
      return query
        .order('scheduled_date', { ascending: true })
        .order('scheduled_time', { ascending: true })
        .order('id', { ascending: true })
        .range(page * RANGE_PAGE, (page + 1) * RANGE_PAGE - 1);
    });
    if (error) {
      console.error('Could not load the bookings of the period:', error);
      throw new Error('Could not load the bookings. Please try again.');
    }
    rows.push(...(data ?? []));
    if (!data || data.length < RANGE_PAGE) break;
  }
  return rows;
}

// The same columns the dashboard's visits store reads, so the week and month views draw like the day
const DIARY_RANGE_SELECT =
  '*, patient:patients!visits_patient_id_fkey(id, first_name, last_name, cell_number, email, date_of_birth), doctor:users!doctor_id(id, full_name, role)';

/**
 * The practice's bookings for the week or month on screen, with patient and practitioner, read in
 * pages of 1000. Throws when they cannot be read.
 */
export async function loadDiaryRangeVisits(practiceId: string, from: string, to: string): Promise<Visit[]> {
  const rows: Visit[] = [];
  for (let page = 0; page < RANGE_MAX_PAGES; page++) {
    const { data, error } = await db
      .from('visits')
      .select(DIARY_RANGE_SELECT)
      .eq('practice_id', practiceId)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true })
      .order('id', { ascending: true })
      .range(page * RANGE_PAGE, (page + 1) * RANGE_PAGE - 1);
    if (error) {
      console.error('Could not load the diary for the week or month:', error);
      throw new Error("Could not load the diary's bookings. Please try again.");
    }
    rows.push(...((data ?? []) as Visit[]));
    if (!data || data.length < RANGE_PAGE) break;
  }
  return rows;
}

export interface SeriesCheckRequest {
  practiceId: string;
  /** One booking per date of the series (same patient, practitioner, time and length) */
  proposals: BookingProposal[];
  practitionerName?: (id: string) => string | null | undefined;
  /** practices.business_hours as stored: a series may cross a day the practice is closed */
  businessHours: unknown;
  lengths?: TypeLengths | null;
  /** Practitioner working hours (each date is checked against its own weekday) */
  workingHours?: WorkingHoursRow[];
  /** The practice's appointment type of the series: its daily limit is checked on every date */
  appointmentType?: AppointmentType | null;
}

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * The booking checks for every date of a repeat booking, read in three requests (four with a type's
 * daily limit) whatever the length of the series. Throws when the bookings cannot be read, so a
 * failed check never looks clear.
 */
export async function checkBookingSeries(request: SeriesCheckRequest): Promise<SeriesDateWarnings[]> {
  const dates = [...new Set(request.proposals.map((proposal) => proposal.date))].sort();
  if (dates.length === 0) return [];
  const doctorId = request.proposals[0].doctorId;
  const list = dates.join(',');
  const limitType = request.appointmentType?.dailyLimit ? request.appointmentType : null;
  const [visitsResult, legacyResult, blocks, typeBookings] = await Promise.all([
    readVisits<DayVisit[]>((columns) =>
      db.from('visits').select(columns).eq('practice_id', request.practiceId).or(`scheduled_date.in.(${list}),visit_date.in.(${list})`)
    ),
    supabase.from('appointments').select('id, date, time, duration').eq('doctor_id', doctorId).in('date', dates).neq('status', 'cancelled'),
    loadDiaryBlocks(request.practiceId, dates[0], dates[dates.length - 1]),
    limitType ? loadTypeBookings(request.practiceId, doctorId, limitType.id, dates) : Promise.resolve([])
  ]);
  if (visitsResult.error) {
    console.error('Could not load the days of the series for the booking check:', visitsResult.error);
    throw new Error('Could not check the diary for clashes. Please try again.');
  }
  const visits = visitsResult.data ?? [];
  // The older appointments table is optional: a failure there must not stop the series
  const legacy = legacyResult.error ? [] : legacyResult.data ?? [];
  const hoursFor = practiceHoursResolver(request.businessHours);
  return request.proposals.map((proposal) => {
    const practitionerDay = practitionerDayHours(request.workingHours ?? [], proposal.doctorId, proposal.date);
    const warnings = findBookingWarnings({
      proposal,
      visits: visits.filter((visit) => visitDay(visit) === proposal.date),
      legacyAppointments: legacy
        .filter((row) => row.date === proposal.date)
        .map((row) => ({ id: row.id, time: row.time, duration: row.duration })),
      blocks: blocks.state === 'ready' ? blocks.blocks : [],
      doctorName: request.practitionerName,
      // A practitioner who works that day (their own hours) is not "closed" with the practice
      closedWeekday: practitionerDay || hoursFor(proposal.date) ? null : WEEKDAY_KEYS[weekdayOfKey(proposal.date)] ?? null,
      lengths: request.lengths,
      practitionerDay
    });
    const limit = typeLimitWarning(limitType, typeBookings, proposal, request.practitionerName);
    return { date: proposal.date, warnings: limit ? [...warnings, limit] : warnings };
  });
}

export interface NextFreeSlotRequest {
  practiceId: string;
  doctorId: string;
  /** Look from this day (today when it is in the past) */
  fromDate: Date;
  durationMinutes: number;
  /** practices.business_hours as stored */
  businessHours: unknown;
  /** The booking being moved */
  ignoreVisitId?: string | null;
  /** Days to look at, default four weeks */
  days?: number;
  /** The practice's default length per visit type (for bookings without a stored length) */
  lengths?: TypeLengths | null;
  /** Practitioner working hours: when this practitioner has some, they are used instead of the opening hours */
  workingHours?: WorkingHoursRow[];
  /** Start times are multiples of this: the practitioner's slot (slotLength.ts startStepFor), default 15 minutes */
  stepMinutes?: number;
}

/** The practitioner's next free slot, or null when nothing fits in the period. */
export async function findNextFreeSlotFor(request: NextFreeSlotRequest): Promise<FreeSlot | null> {
  const now = new Date();
  const todayKey = toDateKey(now);
  const requestedKey = toDateKey(request.fromDate);
  const fromKey = requestedKey < todayKey ? todayKey : requestedKey;
  const days = request.days ?? 28;
  const toKey = addDaysToKey(fromKey, days - 1);

  const [visitsResult, blocks] = await Promise.all([
    readVisits<DayVisit[]>((columns) =>
      db
        .from('visits')
        .select(columns)
        .eq('practice_id', request.practiceId)
        .eq('doctor_id', request.doctorId)
        .or(
          `and(scheduled_date.gte.${fromKey},scheduled_date.lte.${toKey}),and(scheduled_date.is.null,visit_date.gte.${fromKey},visit_date.lte.${toKey})`
        )
    ),
    loadDiaryBlocks(request.practiceId, fromKey, toKey)
  ]);
  if (visitsResult.error) {
    console.error('Could not load bookings for the next free slot:', visitsResult.error);
    throw new Error("Could not load the practitioner's bookings. Please try again.");
  }

  return findNextFreeSlot({
    doctorId: request.doctorId,
    fromDate: fromKey,
    notBefore: fromKey === todayKey ? format(now, 'HH:mm') : null,
    durationMinutes: request.durationMinutes,
    days,
    hoursFor: practitionerHoursResolver(request.workingHours ?? [], request.doctorId, practiceHoursResolver(request.businessHours)),
    visits: visitsResult.data ?? [],
    blocks: blocks.state === 'ready' ? blocks.blocks : [],
    ignoreVisitId: request.ignoreVisitId,
    lengths: request.lengths,
    stepMinutes: request.stepMinutes
  });
}

/** No-shows of the patient in the last 12 months: how many, and the latest date. Null when unknown. */
export async function loadNoShowHistory(patientId: string): Promise<{ count: number; lastDate: string | null } | null> {
  const since = addDaysToKey(toDateKey(new Date()), -365);
  const { data, count, error } = await supabase
    .from('visits')
    .select('scheduled_date, visit_date', { count: 'exact' })
    .eq('patient_id', patientId)
    .eq('status', 'no-show')
    .gte('scheduled_date', since)
    .order('scheduled_date', { ascending: false })
    .limit(1);
  if (error) {
    console.error('Could not load missed appointments:', error);
    return null;
  }
  const last = data?.[0];
  return { count: count ?? data?.length ?? 0, lastDate: last ? last.scheduled_date || last.visit_date : null };
}
