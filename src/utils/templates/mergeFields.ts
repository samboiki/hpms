/**
 * The {{merge fields}} that letter, SMS and email templates share: one list (name, plain label, an invented example and
 * where each can be filled) and one way to fill a template.
 *
 * The names are the app's existing {{camelCase}} fields. The diary reminders, the automations and the SMS templates
 * practices already saved use {{patientName}}, {{practiceName}}, {{appointmentDate}}...
 * (supabase/functions/_shared/appointmentReminders.ts); a test keeps every reminder field in this list. The patient
 * lists keep their own {{first_name}} names, which their scheduled sender fills, and accept these names too: one
 * mapping in utils/patientLists/listMessages.ts (TEMPLATE_FIELD_NAMES), so a saved template pasted into a list works.
 *
 * A field without a value is never filled with a blank or a guess: it stays in the text as {{field}}, so the person
 * making the letter or message sees it and fills it in (a letter asks for it, a list leaves that patient out and says
 * why). Only the printed sick note, which has no step to ask, leaves an empty field out (blankMissingFields).
 */
import { fillPlaceholders, findPlaceholders } from '../../components/messages/messageText';
import { addDaysToKey, daysBetweenKeys, isValidDateKey } from '../billing/dates';
import { formatLetterDate } from '../clinical/letters';
import { ageOn } from '../patientLists/listDates';
import { formalPatientName } from '../patients/patientName';
import { isTemporaryIdNumber, patientFileStatus } from '../patients/temporaryPatient';

/** Where a template is used: letters (from a visit, the patient file or a list) or SMS and email (sent to a patient). */
export type TemplateUse = 'letter' | 'message';

export type MergeFieldGroup = 'patient' | 'visit' | 'sickNote' | 'appointments' | 'practice' | 'other';

export const MERGE_GROUP_LABELS: Readonly<Record<MergeFieldGroup, string>> = {
  patient: 'Patient',
  visit: 'Visit',
  sickNote: 'Sick note',
  appointments: 'Appointments',
  practice: 'Practice',
  other: 'Other'
};

const BOTH: readonly TemplateUse[] = ['letter', 'message'];
const LETTER: readonly TemplateUse[] = ['letter'];

// Examples are invented: they fill the live preview while a template is written
export const MERGE_FIELDS = [
  { name: 'patientTitle', label: 'Title', group: 'patient', example: 'Ms', uses: BOTH },
  { name: 'patientFirstName', label: 'First name', group: 'patient', example: 'Maria', uses: BOTH },
  { name: 'patientLastName', label: 'Surname', group: 'patient', example: 'Shikongo', uses: BOTH },
  { name: 'patientName', label: 'Full name', group: 'patient', example: 'Maria Shikongo', uses: BOTH },
  { name: 'patientFormalName', label: 'Title, initials and surname', group: 'patient', example: 'Ms M Shikongo', uses: BOTH },
  { name: 'patientIdNumber', label: 'ID number', group: 'patient', example: '85051400123', uses: LETTER },
  { name: 'patientDateOfBirth', label: 'Date of birth', group: 'patient', example: '14 May 1985', uses: LETTER },
  { name: 'patientAge', label: 'Age', group: 'patient', example: '41', uses: LETTER },
  { name: 'patientAddress', label: 'Postal address', group: 'patient', example: 'PO Box 1234, Windhoek 9000', uses: LETTER },
  { name: 'visitDate', label: 'Visit date', group: 'visit', example: '12 October 2026', uses: LETTER },
  { name: 'diagnosis', label: 'Diagnosis', group: 'visit', example: 'Acute bronchitis', uses: LETTER },
  // Never on file: typed each time a form or letter that uses it is made (a consent form names its procedure)
  { name: 'procedure', label: 'Procedure or treatment', group: 'visit', example: 'Removal of a skin lesion', uses: LETTER },
  { name: 'sickNoteFrom', label: 'First day off', group: 'sickNote', example: '12 October 2026', uses: LETTER },
  { name: 'sickNoteTo', label: 'Last day off', group: 'sickNote', example: '14 October 2026', uses: LETTER },
  { name: 'daysOff', label: 'Days off', group: 'sickNote', example: '3 days', uses: LETTER },
  { name: 'returnDate', label: 'Back at work or school on', group: 'sickNote', example: '15 October 2026', uses: LETTER },
  { name: 'sickNoteNumber', label: 'Sick note number', group: 'sickNote', example: '0042', uses: LETTER },
  { name: 'appointmentDate', label: 'Next appointment date', group: 'appointments', example: '20 October 2026', uses: BOTH },
  { name: 'appointmentTime', label: 'Next appointment time', group: 'appointments', example: '09:30', uses: BOTH },
  { name: 'lastVisitDate', label: 'Last visit date', group: 'appointments', example: '3 March 2026', uses: BOTH },
  // The room link of the next booking when it is a video consultation (visits.video_link)
  { name: 'videoLink', label: 'Video link', group: 'appointments', example: 'https://meet.jit.si/hpms-example-room', uses: BOTH },
  { name: 'practitionerName', label: 'Practitioner who signs', group: 'practice', example: 'Dr A Nangolo', uses: LETTER },
  { name: 'practiceName', label: 'Practice name', group: 'practice', example: 'Example Family Practice', uses: BOTH },
  { name: 'practicePhone', label: 'Practice phone', group: 'practice', example: '061 123 456', uses: BOTH },
  { name: 'practiceEmail', label: 'Practice email', group: 'practice', example: 'reception@example.com', uses: BOTH },
  { name: 'practiceAddress', label: 'Practice address', group: 'practice', example: '1 Example Street, Windhoek', uses: BOTH },
  { name: 'today', label: "Today's date", group: 'other', example: '12 October 2026', uses: BOTH }
] as const satisfies ReadonlyArray<{ name: string; label: string; group: MergeFieldGroup; example: string; uses: readonly TemplateUse[] }>;

export type MergeField = (typeof MERGE_FIELDS)[number];
export type MergeFieldName = MergeField['name'];
export type MergeValues = Partial<Record<MergeFieldName, string | null>>;

/** Names older templates use for the same fields (the diary reminders call the practitioner {{doctorName}}). */
const FIELD_ALIASES: Readonly<Record<string, MergeFieldName>> = { doctorName: 'practitionerName', currentDate: 'today' };

const FIELD_BY_NAME = new Map<string, MergeField>(MERGE_FIELDS.map(field => [field.name, field]));

/** A field's own name for a name found in a text (an alias becomes the field it stands for). */
export const canonicalFieldName = (name: string): string => FIELD_ALIASES[name] ?? name;

export const isMergeFieldName = (name: string): name is MergeFieldName => FIELD_BY_NAME.has(name);

/** The fields a template for this use can contain, in the order the editor offers them. */
export const fieldsFor = (use: TemplateUse): MergeField[] => MERGE_FIELDS.filter(field => (field.uses as readonly TemplateUse[]).includes(use));

/** "Days off"; the name itself for a name that is not a field. */
export const fieldLabel = (name: string): string => FIELD_BY_NAME.get(canonicalFieldName(name))?.label ?? name;

/** "{{daysOff}}" */
export const fieldToken = (name: MergeFieldName): string => `{{${name}}}`;

const nameOf = (placeholder: string): string => canonicalFieldName(placeholder.replace(/[{}\s]/g, ''));

/** The fields a text uses, each once, in order (aliases as the field they stand for, unknown names as written). */
export function fieldsIn(text: string): string[] {
  return [...new Set(findPlaceholders(text).map(nameOf))];
}

/** Names in a text that are not fields of this use: a typo ({{patientNmae}}) or a letter field in an SMS. */
export function unknownFields(text: string, use: TemplateUse): string[] {
  const allowed = new Set<string>(fieldsFor(use).map(field => field.name));
  return fieldsIn(text).filter(name => !allowed.has(name));
}

/** Fields typed with single braces ("{patientName}"), a common slip: they would print as typed. */
export function singleBraceSlips(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/(?<!\{)\{\s*(\w+)\s*\}(?!\})/g)) {
    if (isMergeFieldName(canonicalFieldName(match[1]))) found.add(match[0]);
  }
  return [...found];
}

export interface MergeResult {
  text: string;
  /** Fields still in the text: no value for this patient, or not a field at all */
  missing: string[];
}

/** Fills every field that has a real value; the others stay as {{field}} and are listed in `missing`. */
export function mergeTemplate(text: string, values: MergeValues): MergeResult {
  const withAliases: Record<string, string | null | undefined> = { ...values };
  for (const [alias, name] of Object.entries(FIELD_ALIASES)) withAliases[alias] = values[name];
  const filled = fillPlaceholders(text, withAliases);
  return { text: filled, missing: fieldsIn(filled) };
}

/**
 * Takes out fields left without a value and tidies the spaces and brackets around them. Only for the printed sick
 * note, which is printed straight from the visit with no step to ask for a value.
 */
export function blankMissingFields(text: string): string {
  // A bracketed aside around an empty field goes with it: "(ID {{patientIdNumber}})" never prints as "(ID )"
  let result = text.replace(/\([^()]*\{\{\s*\w+\s*\}\}[^()]*\)/g, '');
  for (const placeholder of findPlaceholders(result)) result = result.split(placeholder).join('');
  return result
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+([,.;:)])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '');
}

/** Invented values of every field, for the live preview; real practice details can replace the invented ones. */
export function sampleMergeValues(overrides: MergeValues = {}): MergeValues {
  const sample: MergeValues = Object.fromEntries(MERGE_FIELDS.map(field => [field.name, field.example]));
  for (const [name, value] of Object.entries(overrides)) if (value) sample[name as MergeFieldName] = value;
  return sample;
}

// ---------------------------------------------------------------------------------------------------
// The values of the fields, from what the patient file, the visit and the practice hold
// ---------------------------------------------------------------------------------------------------

export interface PatientMergeSource {
  title?: string | null;
  initials?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  idNumber?: string | null;
  dateOfBirth?: string | null;
  postalAddress?: string | null;
  postalCode?: string | null;
  homeAddress?: string | null;
  /** patients.town (the town picker keeps it in its own field) */
  town?: string | null;
}

const present = (value: string | null | undefined): string | null => (value && value.trim() ? value.replace(/\s+/g, ' ').trim() : null);

/**
 * The patient's fields. A file opened with a name and cell number only has a temporary ID number and a placeholder
 * birthday: neither is ever printed as the patient's.
 */
export function patientMergeValues(patient: PatientMergeSource, todayKey: string): MergeValues {
  const firstName = present(patient.firstName);
  const lastName = present(patient.lastName);
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
  const idNumber = present(patient.idNumber);
  const dateOfBirth = patientFileStatus({ id_number: patient.idNumber, date_of_birth: patient.dateOfBirth }).dateOfBirth;
  const age = dateOfBirth ? ageOn(dateOfBirth, todayKey) : null;
  const postal = present(patient.postalAddress);
  // The town picker keeps the town in its own field: it goes on the address ("PO Box 1234, Windhoek 9000") unless it was
  // typed there already, or a label and a letter go out without a town
  const town = present(patient.town);
  const withTown = (line: string | null, code: string | null): string | null =>
    line ? [town && !line.toLowerCase().includes(town.toLowerCase()) ? `${line}, ${town}` : line, code].filter(Boolean).join(' ') : null;
  const address = postal ? withTown(postal, present(patient.postalCode)) : withTown(present(patient.homeAddress), null);
  return {
    patientTitle: present(patient.title),
    patientFirstName: firstName,
    patientLastName: lastName,
    patientName: fullName,
    patientFormalName:
      formalPatientName({ title: patient.title, initials: patient.initials, first_name: firstName, last_name: lastName }) ?? fullName,
    patientIdNumber: idNumber && !isTemporaryIdNumber(idNumber) ? idNumber : null,
    patientDateOfBirth: formatLetterDate(dateOfBirth?.slice(0, 10)) || null,
    patientAge: age !== null && age >= 0 ? String(age) : null,
    patientAddress: address
  };
}

export interface PracticeMergeSource {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
}

export function practiceMergeValues(practice: PracticeMergeSource): MergeValues {
  const address = [present(practice.address), present(practice.city)].filter(Boolean).join(', ') || null;
  return {
    practiceName: present(practice.name),
    practicePhone: present(practice.phone),
    practiceEmail: present(practice.email),
    practiceAddress: address
  };
}

export interface AppointmentMergeSource {
  /** The next booking from today on (patient list facts), yyyy-MM-dd */
  nextBookingOn?: string | null;
  /** "09:30" */
  nextBookingTime?: string | null;
  lastCompletedVisitOn?: string | null;
  /** The next booking's room link when it is a video consultation; left out by a caller that did not read it */
  nextBookingVideoLink?: string | null;
}

export function appointmentMergeValues(source: AppointmentMergeSource | null | undefined): MergeValues {
  const next = source?.nextBookingOn ?? null;
  const time = present(source?.nextBookingTime ?? null);
  const values: MergeValues = {
    appointmentDate: formatLetterDate(next) || null,
    appointmentTime: next && time ? time.slice(0, 5) : null,
    lastVisitDate: formatLetterDate(source?.lastCompletedVisitOn ?? null) || null
  };
  // Only a caller that read the next booking's room link says whether it has one (only a secure link is used)
  if (source && source.nextBookingVideoLink !== undefined) {
    const link = present(source.nextBookingVideoLink);
    values.videoLink = next && link && /^https:\/\/\S+$/.test(link) ? link : null;
  }
  return values;
}

export interface SickNoteMergeSource {
  fromDate: string;
  toDate: string;
  formNumber?: string | null;
}

/** The sick note's days, as the built-in sick note counts them: both days included, back the day after. */
export function sickNoteMergeValues(note: SickNoteMergeSource | null | undefined): MergeValues {
  if (!note || !isValidDateKey(note.fromDate) || !isValidDateKey(note.toDate) || note.toDate < note.fromDate) return {};
  const days = daysBetweenKeys(note.fromDate, note.toDate) + 1;
  return {
    sickNoteFrom: formatLetterDate(note.fromDate),
    sickNoteTo: formatLetterDate(note.toDate),
    daysOff: `${days} ${days === 1 ? 'day' : 'days'}`,
    returnDate: formatLetterDate(addDaysToKey(note.toDate, 1)),
    sickNoteNumber: present(note.formNumber ?? null)
  };
}
