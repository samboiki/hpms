/**
 * Typed notes on the patient file and the follow-ups they carry (proposals/2026-10-08-patient-notes.sql; parity rows
 * C1 and B22).
 *
 * Business rules:
 * - Every note has a kind: clinical, account, call or SMS, general. Clinical notes are for every clinician: doctors and
 *   nurses (isClinician) and anyone with a practitioner registration number, whatever their role (in small practices
 *   the owner-practitioner is usually the administrator). Account notes are for staff with billing rights
 *   (canRaiseInvoices), the other two for all staff. The same rule decides who reads a note, who writes one and who
 *   can be asked to follow it up. The database applies it too (patient_note_types_for_staff); a unit test compares
 *   the two.
 * - A note has a short header. Left blank, the start of the note is used, so a note is written in seconds.
 * - A locked note never changes: later changes are dated addenda under it, and the lock is never taken off. Clinical
 *   notes start locked (a clinical record is not rewritten afterwards); staff may untick it before saving.
 * - A follow-up is a day and, optionally, who follows up (otherwise anyone who sees the note). It is due on that day
 *   in Windhoek and stays due until someone marks it done.
 * - Credit-control notes (Billing > Promises and notes) are listed with the account notes, read-only: they stay in
 *   credit control and are never copied.
 *
 * Pure (no database, no React), so the rules are tested directly.
 */
import { canRaiseInvoices, isClinician } from '../../../utils/billing/invoiceRights';
import { addDaysToKey, addMonthsToKey, daysBetweenKeys, formatServiceDate, isValidDateKey } from '../../../utils/billing/dates';
import { STAFF_ROLE_LABELS, formatStaffName } from '../../settings/UserManagement/staffUtils';
import type { ContactNote } from '../../../services/ledger/creditControl';

export type NoteType = 'clinical' | 'account' | 'contact' | 'general';

/** In the order staff see them */
export const NOTE_TYPES: readonly NoteType[] = ['clinical', 'account', 'contact', 'general'];

export const NOTE_TYPE_LABELS: Readonly<Record<NoteType, string>> = {
  clinical: 'Clinical',
  account: 'Account',
  contact: 'Call or SMS',
  general: 'General'
};

export const HEADER_MAX = 80;
export const BODY_MAX = 4000;
/** A header taken from the note itself stays short enough to read at a glance */
const AUTO_HEADER_MAX = 60;

export interface NoteUser {
  role?: string | null;
  is_active?: boolean | null;
  /** The practitioner registration number (HPCNA) on the staff record */
  hpcsa_number?: string | null;
}

/** A registered practitioner by their staff record, whatever their role (a blank number does not count). */
export const hasPractitionerNumber = (user: Pick<NoteUser, 'hpcsa_number'> | null | undefined): boolean => Boolean(user?.hpcsa_number?.trim());

/** The kinds of note this staff member reads and writes; none for a switched-off account or an unknown role. */
export function noteTypesFor(user: NoteUser | null | undefined): NoteType[] {
  if (!user || user.is_active === false) return [];
  const role = (user.role ?? '').trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(STAFF_ROLE_LABELS, role)) return [];
  const member = { role, is_active: true };
  const clinician = isClinician(member) || hasPractitionerNumber(user);
  return NOTE_TYPES.filter(type => (type === 'clinical' ? clinician : type === 'account' ? canRaiseInvoices(member) : true));
}

/** Why this person cannot write this kind of note, in the database's words; null when they can. */
export function noteTypeProblem(type: NoteType, allowed: readonly NoteType[]): string | null {
  if (allowed.includes(type)) return null;
  return type === 'clinical' ? 'Only practitioners and nurses can write clinical notes.' : 'Only staff with billing rights can write account notes.';
}

/** The kind a new note starts as: clinical for practitioners and nurses, otherwise general. */
export const defaultNoteType = (allowed: readonly NoteType[]): NoteType => (allowed.includes('clinical') ? 'clinical' : 'general');

/** Clinical notes start locked; the others start open to changes. */
export const defaultLockFor = (type: NoteType): boolean => type === 'clinical';

const tidy = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** The header a note is saved with: what was typed, else the start of its first line, cut at a word. */
export function headerFor(header: string, body: string): string {
  const typed = tidy(header);
  if (typed) return typed;
  const firstLine = body.split(/\r?\n/).map(tidy).find(Boolean) ?? '';
  if (firstLine.length <= AUTO_HEADER_MAX) return firstLine;
  const cut = firstLine.slice(0, AUTO_HEADER_MAX - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace >= 20 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export interface NoteDraft {
  type: NoteType;
  header: string;
  body: string;
  /** yyyy-MM-dd, or '' for no follow-up */
  followUpOn: string;
  /** null = anyone who sees the note */
  followUpUserId: string | null;
  lock: boolean;
}

/**
 * Why the draft cannot be saved, in plain words; null when it can. A new follow-up day must be today or later (an
 * earlier day would be overdue the moment it is saved); a day already on the note may stay as it is.
 */
export function noteDraftProblem(
  draft: NoteDraft,
  allowed: readonly NoteType[],
  todayKey: string,
  savedFollowUpOn: string | null = null
): string | null {
  const typeProblem = noteTypeProblem(draft.type, allowed);
  if (typeProblem) return typeProblem;
  const body = draft.body.trim();
  if (!body) return 'Write the note first.';
  if (body.length > BODY_MAX) return 'Keep the note to 4,000 characters.';
  if (headerFor(draft.header, draft.body).length > HEADER_MAX) return `Keep the header to ${HEADER_MAX} characters.`;
  if (draft.followUpOn) {
    if (!isValidDateKey(draft.followUpOn)) return 'Choose the follow-up date.';
    if (draft.followUpOn < todayKey && draft.followUpOn !== savedFollowUpOn) return 'Choose today or a later day for the follow-up.';
  } else if (draft.followUpUserId) {
    return 'Choose the follow-up date.';
  }
  return null;
}

/** Quick follow-up days offered next to the date: tomorrow, in a week, in a month. */
export function followUpShortcuts(todayKey: string): Array<{ label: string; value: string }> {
  return [
    { label: 'Tomorrow', value: addDaysToKey(todayKey, 1) },
    { label: 'In a week', value: addDaysToKey(todayKey, 7) },
    { label: 'In a month', value: addMonthsToKey(todayKey, 1) }
  ];
}

export interface StaffLike {
  id: string;
  full_name?: string | null;
  role?: string | null;
  is_active?: boolean | null;
  hpcsa_number?: string | null;
}

/**
 * Who can be asked to follow up a note of this kind: active staff whose role sees it, by name (the database refuses
 * anyone else, so a clinical follow-up never lands with someone who cannot open the note).
 */
export function followUpCandidates<T extends StaffLike>(staff: readonly T[], type: NoteType): T[] {
  return staff
    .filter(member => member.is_active !== false && noteTypesFor(member).includes(type))
    .sort((a, b) => formatStaffName(a).localeCompare(formatStaffName(b)));
}

/** Who follows up by default: the writer when they may, otherwise anyone (''). */
export function defaultFollowUpPerson(staff: readonly StaffLike[], type: NoteType, myUserId: string | null): string {
  return myUserId && followUpCandidates(staff, type).some(member => member.id === myUserId) ? myUserId : '';
}

/** A staff member's name as the practice knows it ("Dr. ..." for doctors); "you" for the signed-in user. */
export function staffLabel(id: string | null, staffById: ReadonlyMap<string, StaffLike>, myUserId: string | null | undefined): string {
  if (!id) return 'Not recorded';
  if (id === myUserId) return 'You';
  const member = staffById.get(id);
  return member ? formatStaffName(member) : 'A former staff member';
}

export interface NoteAddendum {
  id: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
}

export interface PatientNote {
  id: string;
  patientId: string;
  type: NoteType;
  header: string;
  body: string;
  followUpOn: string | null;
  followUpUserId: string | null;
  followUpDoneAt: string | null;
  followUpDoneBy: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  createdBy: string | null;
  createdAt: string;
  editedBy: string | null;
  editedAt: string | null;
  /** Oldest first */
  addenda: NoteAddendum[];
}

/** Staff who see a note may change it until it is locked; a locked note takes addenda (and its follow-up moves). */
export const canEditNote = (note: Pick<PatientNote, 'type' | 'lockedAt'>, visible: readonly NoteType[]): boolean =>
  note.lockedAt === null && visible.includes(note.type);

export type FollowUpState = 'none' | 'done' | 'overdue' | 'today' | 'upcoming';

export interface FollowUpStatus {
  state: FollowUpState;
  /** "Due today", "2 days overdue", "Follow up 12 Oct 2026", "Followed up"; empty without a follow-up */
  label: string;
}

/** Where a note's follow-up stands on the given Windhoek day. */
export function followUpStatus(note: Pick<PatientNote, 'followUpOn' | 'followUpDoneAt'>, todayKey: string): FollowUpStatus {
  if (!note.followUpOn || !isValidDateKey(note.followUpOn)) return { state: 'none', label: '' };
  if (note.followUpDoneAt) return { state: 'done', label: 'Followed up' };
  const late = daysBetweenKeys(note.followUpOn, todayKey);
  if (late > 0) return { state: 'overdue', label: late === 1 ? '1 day overdue' : `${late} days overdue` };
  if (late === 0) return { state: 'today', label: 'Due today' };
  return { state: 'upcoming', label: `Follow up ${formatServiceDate(note.followUpOn)}` };
}

export type NoteFilter = 'all' | NoteType;

export type NoteListItem =
  | { kind: 'note'; id: string; type: NoteType; at: string; note: PatientNote }
  | { kind: 'credit_control'; id: string; type: 'account'; at: string; note: ContactNote };

const time = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * The patient's notes and credit-control notes, newest first, as this person may see them, for one filter. Credit-
 * control notes count as account notes: only staff who see account notes see them.
 */
export function buildNoteList(
  notes: readonly PatientNote[],
  creditNotes: readonly ContactNote[],
  filter: NoteFilter,
  visible: readonly NoteType[]
): NoteListItem[] {
  const items: NoteListItem[] = [
    ...notes.filter(note => visible.includes(note.type)).map(note => ({ kind: 'note' as const, id: note.id, type: note.type, at: note.createdAt, note })),
    ...(visible.includes('account')
      ? creditNotes.map(note => ({ kind: 'credit_control' as const, id: `cc-${note.id}`, type: 'account' as const, at: note.createdAt, note }))
      : [])
  ];
  return items
    .filter(item => filter === 'all' || item.type === filter)
    .sort((a, b) => time(b.at) - time(a.at) || b.id.localeCompare(a.id));
}

/** How many items each filter shows (the counts on the filter buttons). */
export function noteCounts(notes: readonly PatientNote[], creditNotes: readonly ContactNote[], visible: readonly NoteType[]): Record<NoteFilter, number> {
  const all = buildNoteList(notes, creditNotes, 'all', visible);
  const counts: Record<NoteFilter, number> = { all: all.length, clinical: 0, account: 0, contact: 0, general: 0 };
  all.forEach(item => {
    counts[item.type] += 1;
  });
  return counts;
}

export interface DueFollowUp {
  noteId: string;
  patientId: string;
  patientName: string;
  type: NoteType;
  header: string;
  /** yyyy-MM-dd */
  followUpOn: string;
  /** null = anyone who sees the note */
  followUpUserId: string | null;
}

export type FollowUpGroup = 'mine' | 'anyone' | 'others';

export const followUpGroup = (item: Pick<DueFollowUp, 'followUpUserId'>, myUserId: string | null | undefined): FollowUpGroup =>
  !item.followUpUserId ? 'anyone' : item.followUpUserId === myUserId ? 'mine' : 'others';

const GROUP_RANK: Readonly<Record<FollowUpGroup, number>> = { mine: 0, anyone: 1, others: 2 };

/**
 * The follow-ups due today and overdue: the signed-in person's own first, then those anyone may do, then those of
 * colleagues; in each, the longest overdue first.
 */
export function dueFollowUps(items: readonly DueFollowUp[], myUserId: string | null | undefined, todayKey: string): DueFollowUp[] {
  return items
    .filter(item => isValidDateKey(item.followUpOn) && item.followUpOn <= todayKey)
    .sort(
      (a, b) =>
        GROUP_RANK[followUpGroup(a, myUserId)] - GROUP_RANK[followUpGroup(b, myUserId)] ||
        a.followUpOn.localeCompare(b.followUpOn) ||
        a.patientName.localeCompare(b.patientName)
    );
}

/** The number on the dashboard's "To Dos": follow-ups due for this person (their own and anyone's). */
export const dueForMeCount = (items: readonly DueFollowUp[], myUserId: string | null | undefined, todayKey: string): number =>
  dueFollowUps(items, myUserId, todayKey).filter(item => followUpGroup(item, myUserId) !== 'others').length;

/** The element of a note in the Notes section (a link to the note scrolls to it). */
export const noteElementId = (noteId: string): string => `patient-note-${noteId}`;

/**
 * The patient file at a note: the Overview, where the Notes section scrolls to it. From the dashboard the file offers
 * "Back to dashboard" (returnTo), so the next follow-up is one tap away.
 */
export function noteLink(patientId: string, noteId: string, options: { returnToDashboard?: boolean } = {}): string {
  const params = new URLSearchParams({ patientId, tab: 'overview', noteId });
  if (options.returnToDashboard) params.set('returnTo', 'dashboard');
  return `/patients?${params.toString()}`;
}
