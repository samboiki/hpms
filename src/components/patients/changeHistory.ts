/**
 * The patient file's change history in plain words: who changed what, and when (the Change history tab; parity B18
 * booking audit and the patient's history).
 *
 * The database records every add, change and delete of a patient file, a visit, a vitals reading and a medical aid in
 * audit_logs (trigger log_audit_trail, supabase/migrations/20250609000001_create_audit_logs.sql): the whole row after
 * an add or a change, the whole row before a delete. A change keeps no "before", so what it changed is worked out
 * against the same record's previous entry in this patient's history. When that entry is not there (the record came
 * from another file, or is older than the trail) the entry says so instead of guessing.
 *
 * Only the fields staff care about are compared. A save that changed none of them is left out (three in four saves of
 * a patient file only touch updated_at), as invoiceAudit.ts leaves out invoice lines saved again unchanged.
 * Sentences name what changed, never the values ("Cell number changed"): values are personal data and are shown only
 * when an entry is opened.
 */
import { formatServiceDate } from '../../utils/billing/dates';
import { getVisitStage, STAGE_LABELS, type VisitStage } from '../../utils/visitStage';
import { formatRole, formatStaffName } from '../settings/UserManagement/staffUtils';
import { fundMoveKey } from '../../utils/accounts/fundMoves';

/** The stored row (a whole patient, visit, vitals or medical aid row) */
export type AuditValues = Readonly<Record<string, unknown>>;

/** A row of the view patient_audit_logs: the columns this screen reads (never the IP address, browser or description) */
export interface AuditLogRow {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_values: AuditValues | null;
  new_values: AuditValues | null;
  user_id: string | null;
  created_at: string;
}

export const AUDIT_LOG_COLUMNS = 'id, table_name, record_id, action, old_values, new_values, user_id, created_at';

export type ChangeGroup = 'patient' | 'visits' | 'medicalAid' | 'vitals';

export interface ChangeGroupInfo {
  key: ChangeGroup;
  label: string;
  /** Solar bold-duotone icon */
  icon: string;
  /** The audited table the group shows */
  table: string;
}

/** What staff filter the history by: what changed, not the database action */
export const CHANGE_GROUPS: readonly ChangeGroupInfo[] = [
  { key: 'patient', label: 'Patient file', icon: 'solar:user-id-bold-duotone', table: 'patients' },
  { key: 'visits', label: 'Visits', icon: 'solar:stethoscope-bold-duotone', table: 'visits' },
  { key: 'medicalAid', label: 'Medical aid', icon: 'solar:shield-plus-bold-duotone', table: 'medical_aid_details' },
  { key: 'vitals', label: 'Vital signs', icon: 'solar:heart-pulse-bold-duotone', table: 'vitals' }
];

export interface ChangeDetail {
  /** "Cell number" */
  label: string;
  /** The value before the change; null for an add */
  before: string | null;
  /** The value after the change; null for a removal */
  after: string | null;
  /** The values name a medical aid (shown with its logo) */
  fund?: boolean;
}

export interface ChangeEntry {
  /** The audit row's id */
  id: string;
  group: ChangeGroup;
  /** What happened, in a plain sentence without personal values */
  title: string;
  /** The values that matter, shown when the entry is opened */
  details: ChangeDetail[];
  /** Said instead of details when the values before a change are not known */
  note: string | null;
  at: string;
  userId: string | null;
  /** The visit the entry is about (a visit, or the visit a vitals reading was taken at) */
  visitId: string | null;
  /** The record was added, changed or deleted */
  kind: 'added' | 'changed' | 'removed';
  /** Why, when the change was part of moving many patients to another fund (the reason given for the move) */
  reason?: string;
}

/** People's names by user id, for a visit's practitioner */
export type Names = Readonly<Record<string, string>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);

/**
 * The PostgREST `.or()` filter for this patient's entries: the patient's own file, every row that names the patient
 * (visits, medical aid) and, since a vitals row names only its visit, the vitals of the patient's own visits. Null when
 * the patient id is not an id: a comma or bracket in it would change the filter itself and could list other files.
 */
export function patientHistoryFilter(patientId: string, visitIds: Iterable<string>): string | null {
  if (!isUuid(patientId)) return null;
  const clauses = [`record_id.eq.${patientId}`, `new_values->>patient_id.eq.${patientId}`, `old_values->>patient_id.eq.${patientId}`];
  const visits = [...new Set([...visitIds].filter(isUuid))].join(',');
  if (visits) {
    clauses.push(`and(table_name.eq.vitals,new_values->>visit_id.in.(${visits}))`, `and(table_name.eq.vitals,old_values->>visit_id.in.(${visits}))`);
  }
  return clauses.join(',');
}

/** The same rule as patientHistoryFilter, applied again to every row before it is shown */
export function belongsToPatient(row: AuditLogRow, patientId: string, visitIds: ReadonlySet<string>): boolean {
  if (!isUuid(patientId)) return false;
  if (row.record_id === patientId || row.new_values?.patient_id === patientId || row.old_values?.patient_id === patientId) return true;
  if (row.table_name !== 'vitals') return false;
  return [row.new_values?.visit_id, row.old_values?.visit_id].some(id => typeof id === 'string' && visitIds.has(id));
}

const valuesOf = (row: AuditLogRow): AuditValues => row.new_values ?? row.old_values ?? {};

const timeOf = (iso: string): number => Date.parse(iso);

/** The same record's entry just before `row` among `rows` (strictly earlier), if it is loaded */
export function previousEntry(rows: readonly AuditLogRow[], row: AuditLogRow): AuditLogRow | undefined {
  if (!row.record_id) return undefined;
  let previous: AuditLogRow | undefined;
  for (const other of rows) {
    if (other.table_name !== row.table_name || other.record_id !== row.record_id) continue;
    if (!(timeOf(other.created_at) < timeOf(row.created_at))) continue;
    if (!previous || timeOf(other.created_at) > timeOf(previous.created_at)) previous = other;
  }
  return previous;
}

/** Where a change's earlier values are kept once looked up: one record at one moment */
export const earlierKey = (row: Pick<AuditLogRow, 'table_name' | 'record_id' | 'created_at'>): string =>
  `${row.table_name}|${row.record_id ?? ''}|${row.created_at}`;

export interface EarlierLookup {
  key: string;
  table: string;
  recordId: string;
  /** Look for the record's last entry before this moment */
  before: string;
}

/** Changes whose earlier entry is not loaded, so it must be looked up (once per record and moment) */
export function earlierLookups(rows: readonly AuditLogRow[]): EarlierLookup[] {
  const lookups = new Map<string, EarlierLookup>();
  for (const row of rows) {
    if (row.action !== 'UPDATE' || !row.record_id || previousEntry(rows, row)) continue;
    const key = earlierKey(row);
    lookups.set(key, { key, table: row.table_name, recordId: row.record_id, before: row.created_at });
  }
  return [...lookups.values()];
}

/** Everyone the entries need a name for: who made each change and each visit's practitioner */
export function peopleIn(rows: readonly AuditLogRow[], earlier: Iterable<AuditValues | null> = []): string[] {
  const ids: unknown[] = rows.flatMap(row => [row.user_id, row.new_values?.doctor_id, row.old_values?.doctor_id]);
  for (const values of earlier) ids.push(values?.doctor_id);
  return [...new Set(ids.filter(isUuid))];
}

export interface StaffMember {
  full_name?: string | null;
  role?: string | null;
}

const NOT_ON_STAFF_LIST = 'Someone not on your staff list';

/** Who made a change: their name and role; changes made without a signed-in person were made by OneHealth itself */
export function describeWho(userId: string | null, staff: Readonly<Record<string, StaffMember>>): string {
  if (!userId) return 'OneHealth (automatic)';
  const member = staff[userId];
  if (!member) return NOT_ON_STAFF_LIST;
  return member.role ? `${formatStaffName(member)} (${formatRole(member.role)})` : formatStaffName(member);
}

/** Display names by user id ("Dr. A Tester" for a doctor) */
export const staffNames = (staff: Readonly<Record<string, StaffMember>>): Names =>
  Object.fromEntries(Object.entries(staff).map(([id, member]) => [id, formatStaffName(member)]));

// ---- Values as staff read them -----------------------------------------------------------------------------------

const BLANK = 'Blank';
const MAX_TEXT = 400;
const EARLIER_UNKNOWN = "The values before this change are not in this file's history, so what changed can't be shown.";

const asText = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());
const clip = (text: string): string => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 3).trimEnd()}...` : text);
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "a", "a and b", "a, b and c", "a, b, c and 2 more" */
function andList(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length > 3) return `${items.slice(0, 3).join(', ')} and ${items.length - 3} more`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

type Reader = (values: AuditValues, names: Names) => string | null;

interface Field {
  /** As written mid-sentence: "cell number" */
  label: string;
  read: Reader;
  /** What is compared to see whether the field changed, when not the shown value (a practitioner's id, not a name) */
  raw?: (values: AuditValues) => string;
  /** A value not worth listing for an add or a removal (a switch that is off) */
  quiet?: string;
  fund?: boolean;
  /** For a visit: what happened to it ("moved"), said instead of "<label> changed" */
  verb?: (after: AuditValues) => string;
}

const field = (label: string, read: Reader, extra: Partial<Field> = {}): Field => ({ label, read, ...extra });
const text = (key: string): Reader => values => clip(asText(values[key])) || null;
const words = (key: string): Reader => values => {
  const value = asText(values[key]).replace(/[-_]+/g, ' ');
  return value ? capitalize(value) : null;
};
const day = (key: string): Reader => values => {
  const value = asText(values[key]);
  if (!value) return null;
  const shown = formatServiceDate(value);
  return shown === '-' ? value : shown;
};
const measure = (key: string, unit: string): Reader => values => {
  const value = asText(values[key]);
  return value ? `${value}${unit}` : null;
};
const flag = (label: string, key: string, yes: string, no: string, extra: Partial<Field> = {}): Field =>
  field(label, values => (values[key] === true ? yes : no), { quiet: no, ...extra });
const person = (label: string, key: string): Field =>
  field(label, (values, names) => (asText(values[key]) ? names[asText(values[key])] ?? NOT_ON_STAFF_LIST : null), {
    raw: values => asText(values[key])
  });

// ---- Visits --------------------------------------------------------------------------------------------------------

const stageOf = (values: AuditValues): VisitStage =>
  getVisitStage({
    status: typeof values.status === 'string' ? values.status : null,
    is_checked_in: values.is_checked_in === true,
    is_ready: values.is_ready === true,
    is_handoff: values.is_handoff === true,
    is_cancelled: values.is_cancelled === true
  });

/** The stage's name, saying "practitioner" where the shared label says "doctor", as the patient's bookings do */
const stageLabel = (stage: VisitStage): string => (stage === 'in-progress' ? 'With the practitioner' : STAGE_LABELS[stage]);

const STAGE_VERBS: Record<VisitStage, string> = {
  scheduled: 'set back to scheduled',
  'checked-in': 'checked in',
  'in-progress': 'started',
  'handed-off': 'handed to the nurse',
  completed: 'completed',
  'no-show': 'marked as a no-show',
  cancelled: 'cancelled'
};

/** The day a visit is booked for, as the patient's bookings read it (the booked date, else the visit date) */
const visitDay = (values: AuditValues): string | null => {
  const date = asText(values.scheduled_date) || asText(values.visit_date);
  return date ? formatServiceDate(date) : null;
};

const visitWhen: Reader = values => {
  const date = visitDay(values);
  if (!date) return null;
  const time = (asText(values.scheduled_time) || asText(values.visit_time)).slice(0, 5);
  return time ? `${date}, ${time}` : date;
};

const visitSubject = (values: AuditValues): string => {
  const date = visitDay(values);
  return date ? `Visit of ${date}` : 'Visit';
};

const VISIT_FIELDS: readonly Field[] = [
  field('date and time', visitWhen, { verb: () => 'moved' }),
  field('stage', values => stageLabel(stageOf(values)), { verb: after => STAGE_VERBS[stageOf(after)] }),
  flag('confirmation', 'is_confirmed', 'Confirmed', 'Not confirmed', { verb: after => (after.is_confirmed === true ? 'confirmed' : 'no longer confirmed') }),
  person('practitioner', 'doctor_id'),
  field('visit type', words('visit_type')),
  field('length', values => (asText(values.duration_minutes) ? `${asText(values.duration_minutes)} minutes` : null)),
  field('reason for visit', text('chief_complaint')),
  field('diagnosis', text('diagnosis')),
  field('treatment plan', text('treatment_plan')),
  field('prescription', text('prescription')),
  field('notes', text('notes')),
  flag('follow-up', 'follow_up_required', 'Needed', 'Not needed'),
  field('follow-up date', day('follow_up_date'))
];

// ---- The patient file, vitals and medical aid ---------------------------------------------------------------------

const PATIENT_FIELDS: readonly Field[] = [
  field('title', text('title')),
  field('first name', text('first_name')),
  field('initials', text('initials')),
  field('surname', text('last_name')),
  field('ID number', text('id_number')),
  field('date of birth', day('date_of_birth')),
  field('gender', words('gender')),
  field('marital status', words('marital_status')),
  field('home language', words('home_language')),
  field('cell number', text('cell_number')),
  field('email address', text('email')),
  field('home address', text('home_address')),
  field('postal address', text('postal_address')),
  field('postal code', text('postal_code')),
  field('town', text('town')),
  field('region', text('region')),
  field('occupation', text('occupation')),
  field('employer', text('employer')),
  flag('SMS opt-out', 'sms_opt_out', 'Opted out of SMS', 'Receives SMS'),
  field('old file number', text('legacy_account_number')),
  field('OneHealth reference', text('system_patient_reference_number'))
];

const VITAL_FIELDS: readonly Field[] = [
  field('blood pressure', measure('blood_pressure', ' mmHg')),
  field('pulse', measure('pulse_rate', ' bpm')),
  field('temperature', measure('temperature', ' °C')),
  field('breathing rate', measure('respiratory_rate', ' /min')),
  field('oxygen saturation', measure('oxygen_saturation', '%')),
  field('weight', measure('weight', ' kg')),
  field('height', measure('height', ' cm')),
  field('BMI', measure('bmi', ''))
];

const MEDICAL_AID_FIELDS: readonly Field[] = [
  field('fund', text('provider'), { fund: true }),
  field('scheme', text('scheme')),
  field('plan', text('plan_type')),
  field('membership number', text('membership_number')),
  field('dependant code', text('dependant_code')),
  field('main member', text('main_member_name')),
  field("main member's ID number", text('main_member_id_number')),
  field('relationship to the main member', words('relationship_to_main'))
];

interface TableSpec {
  group: ChangeGroup;
  fields: readonly Field[];
  added: (values: AuditValues) => string;
  removed: (values: AuditValues) => string;
  /** A change: the fields that changed and, for a visit, what happened to it (as it was before) */
  changed: (labels: readonly string[], verbs: readonly string[], before: AuditValues) => string;
  /** A change whose earlier values are not in this history */
  updated: (values: AuditValues) => string;
}

const fieldsChanged = (labels: readonly string[]): string => `${capitalize(andList(labels))} changed`;

/** The audited tables (add one here when another table gets the audit trigger; others are not shown) */
const TABLES: Readonly<Record<string, TableSpec>> = {
  patients: {
    group: 'patient',
    fields: PATIENT_FIELDS,
    added: () => 'Patient registered',
    removed: () => 'Patient file deleted',
    changed: fieldsChanged,
    updated: () => 'Patient details updated'
  },
  visits: {
    group: 'visits',
    fields: VISIT_FIELDS,
    added: values => (visitDay(values) ? `Visit added for ${visitDay(values)}` : 'Visit added'),
    removed: values => `${visitSubject(values)} removed`,
    changed: (labels, verbs, before) => {
      const fields = labels.length > 0 ? `${andList(labels)} changed` : '';
      if (verbs.length === 0) return `${visitSubject(before)}: ${fields}`;
      return `${visitSubject(before)} ${andList(verbs)}${fields ? `; ${fields}` : ''}`;
    },
    updated: values => `${visitSubject(values)} updated`
  },
  medical_aid_details: {
    group: 'medicalAid',
    fields: MEDICAL_AID_FIELDS,
    added: () => 'Medical aid added',
    removed: () => 'Medical aid removed',
    changed: labels => `Medical aid: ${andList(labels)} changed`,
    updated: () => 'Medical aid updated'
  },
  vitals: {
    group: 'vitals',
    fields: VITAL_FIELDS,
    added: values => {
      const recorded = VITAL_FIELDS.filter(vital => vital.read(values, {}) !== null).map(vital => vital.label);
      return recorded.length > 0 ? `${capitalize(andList(recorded))} recorded` : 'Vital signs recorded';
    },
    removed: () => 'Vital signs removed',
    changed: fieldsChanged,
    updated: () => 'Vital signs updated'
  }
};

/** The table a filter group shows */
export const tableOfGroup = (group: ChangeGroup): string => CHANGE_GROUPS.find(info => info.key === group)?.table ?? '';

const visitIdOf = (row: AuditLogRow): string | null => {
  if (row.table_name === 'visits') return row.record_id;
  if (row.table_name === 'vitals') return asText(valuesOf(row).visit_id) || null;
  return null;
};

/** The fields of an added or removed record that hold something worth listing */
const listed = (fields: readonly Field[], values: AuditValues, names: Names, side: 'before' | 'after'): ChangeDetail[] =>
  fields.flatMap(item => {
    const shown = item.read(values, names);
    if (shown === null || shown === item.quiet) return [];
    return [{ label: capitalize(item.label), before: side === 'before' ? shown : null, after: side === 'after' ? shown : null, fund: item.fund }];
  });

/**
 * One audit row as an entry, or null when it is not shown: a table or action this screen does not describe, or a
 * change that changed nothing staff care about. `earlier` is the record as it was before a change (null: not known).
 */
export function describeChange(row: AuditLogRow, earlier: AuditValues | null, names: Names = {}): ChangeEntry | null {
  const spec = TABLES[row.table_name];
  if (!spec) return null;
  const values = valuesOf(row);
  const entry = { id: row.id, group: spec.group, at: row.created_at, userId: row.user_id, visitId: visitIdOf(row) };

  if (row.action === 'INSERT') {
    return { ...entry, kind: 'added', title: spec.added(values), details: listed(spec.fields, values, names, 'after'), note: null };
  }
  if (row.action === 'DELETE') {
    return { ...entry, kind: 'removed', title: spec.removed(values), details: listed(spec.fields, values, names, 'before'), note: null };
  }
  if (row.action !== 'UPDATE') return null;
  if (!earlier) return { ...entry, kind: 'changed', title: spec.updated(values), details: [], note: EARLIER_UNKNOWN };

  const compared = (item: Field, from: AuditValues) => (item.raw ? item.raw(from) : item.read(from, names) ?? '');
  const changed = spec.fields.filter(item => compared(item, earlier) !== compared(item, values));
  if (changed.length === 0) return null;
  const verbs = changed.flatMap(item => (item.verb ? [item.verb(values)] : []));
  const labels = changed.filter(item => !item.verb).map(item => item.label);
  return {
    ...entry,
    kind: 'changed',
    title: spec.changed(labels, verbs, earlier),
    details: changed.map(item => ({
      label: capitalize(item.label),
      before: item.read(earlier, names) ?? BLANK,
      after: item.read(values, names) ?? BLANK,
      fund: item.fund
    })),
    note: null
  };
}

const newestFirst = (a: AuditLogRow, b: AuditLogRow): number => timeOf(b.created_at) - timeOf(a.created_at) || b.id.localeCompare(a.id);

/**
 * The patient's history as entries, newest first. Rows of other patients are dropped (whatever the query returned),
 * and a change is compared only with this patient's own earlier entry of the record: the loaded one, else the one
 * looked up (`earlier`, by earlierKey; null when there is none). A medical aid change made by moving many patients to
 * another fund carries the move's reason (`fundMoves`, by fundMoveKey).
 */
export function describeHistory(input: {
  rows: readonly AuditLogRow[];
  patientId: string;
  visitIds: ReadonlySet<string>;
  earlier?: ReadonlyMap<string, AuditValues | null>;
  names?: Names;
  fundMoves?: ReadonlyMap<string, string>;
}): ChangeEntry[] {
  const own = input.rows.filter(row => belongsToPatient(row, input.patientId, input.visitIds)).sort(newestFirst);
  return own.flatMap(row => {
    const previous = row.action === 'UPDATE' ? previousEntry(own, row) : undefined;
    const earlier = previous ? valuesOf(previous) : input.earlier?.get(earlierKey(row)) ?? null;
    const entry = describeChange(row, earlier, input.names);
    if (!entry) return [];
    const reason = row.table_name === 'medical_aid_details' && row.record_id ? input.fundMoves?.get(fundMoveKey(row.record_id, row.created_at)) : undefined;
    return [reason ? { ...entry, reason } : entry];
  });
}
