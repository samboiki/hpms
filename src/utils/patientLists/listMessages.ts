/**
 * The text of patient-list messages: the {{variables}} staff can use and their values for one
 * patient. Variables use the app's {{double_brace}} style (see components/messages/messageText.ts).
 * A variable without a real value is never sent blank or made up: the patient is skipped and
 * the preview says why (e.g. "no upcoming appointment").
 *
 * Explicit .ts imports so the scheduled sender (Deno) can run it; messageText.ts needs date-fns,
 * which the edge function maps in its deno.json.
 */
import { fillPlaceholders, findPlaceholders, formatMessageDate } from '../../components/messages/messageText.ts';
import { formatNad } from '../billing/money.ts';
import { ageOn, currentBirthday } from './listDates.ts';
import type { PatientFacts } from './listRules.ts';

export const LIST_TEMPLATE_VARIABLES = [
  { key: 'first_name', label: 'First name', example: 'Maria' },
  { key: 'last_name', label: 'Surname', example: 'Shikongo' },
  { key: 'full_name', label: 'Full name', example: 'Maria Shikongo' },
  { key: 'practice_name', label: 'Practice name', example: 'Your practice' },
  { key: 'practice_phone', label: 'Practice phone', example: '061 123 456' },
  { key: 'appointment_date', label: 'Next appointment date', example: '14 October 2026' },
  { key: 'appointment_time', label: 'Next appointment time', example: '09:30' },
  { key: 'age', label: 'Age on birthday', example: '40' },
  { key: 'last_visit_date', label: 'Last visit date', example: '3 March 2026' },
  { key: 'balance', label: 'Amount owed', example: 'N$ 450.00' },
  { key: 'missed_date', label: 'Missed appointment date', example: '1 October 2026' }
] as const;

export type ListTemplateVariable = (typeof LIST_TEMPLATE_VARIABLES)[number]['key'];
export type MessageValues = Record<ListTemplateVariable, string | null>;

const KNOWN_VARIABLES: readonly string[] = LIST_TEMPLATE_VARIABLES.map((variable) => variable.key);

/**
 * The names the practice's saved SMS templates and the diary reminders use for the same details
 * ({{patientFirstName}}, src/utils/templates/mergeFields.ts), so a template pasted into a list message is filled as
 * written. The one place the two name sets meet: the editor's buttons add the list names above, and both work. A
 * template detail the list facts do not hold (null) is refused with that reason instead of skipping every patient.
 */
const TEMPLATE_FIELD_NAMES: ReadonlyMap<string, ListTemplateVariable | null> = new Map<string, ListTemplateVariable | null>([
  ['patientFirstName', 'first_name'],
  ['patientLastName', 'last_name'],
  ['patientName', 'full_name'],
  ['practiceName', 'practice_name'],
  ['practicePhone', 'practice_phone'],
  ['appointmentDate', 'appointment_date'],
  ['appointmentTime', 'appointment_time'],
  ['lastVisitDate', 'last_visit_date'],
  ['patientTitle', null],
  ['patientFormalName', null],
  ['practiceEmail', null],
  ['practiceAddress', null],
  ['practitionerName', null],
  ['doctorName', null],
  ['videoLink', null],
  ['today', null],
  ['currentDate', null]
]);

/** Every template name the mapping knows, filled or not (a test keeps it in step with the templates and reminders). */
export const LIST_TEMPLATE_FIELD_NAMES: readonly string[] = [...TEMPLATE_FIELD_NAMES.keys()];

/** The list variable a {{name}} stands for: a list name, or a template's name for the same detail; else null. */
export function listVariableFor(name: string): ListTemplateVariable | null {
  if (KNOWN_VARIABLES.includes(name)) return name as ListTemplateVariable;
  return TEMPLATE_FIELD_NAMES.get(name) ?? null;
}

/** Why a variable has no value for a patient, in words for the preview. */
const MISSING_REASONS: Record<ListTemplateVariable, string> = {
  first_name: 'no first name on file',
  last_name: 'no surname on file',
  full_name: 'no name on file',
  practice_name: 'the practice name is not set up',
  practice_phone: 'the practice phone number is not set up',
  appointment_date: 'no upcoming appointment',
  appointment_time: 'no time on the next appointment',
  age: 'no date of birth on file',
  last_visit_date: 'no completed visit',
  balance: 'nothing owed',
  missed_date: 'no missed appointment'
};

export interface PracticeDetails {
  name: string | null;
  phone: string | null;
  /** practices.practice_type ('dental', ...): the ready-made treatment recall depends on it */
  practiceType?: string | null;
}

/** A date key written day-month-year for patients: "7 October 2026". */
export function formatMessageDateKey(dateKey: string | null): string | null {
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return formatMessageDate(new Date(year, month - 1, day));
}

/** The values of every variable for one patient on `todayKey` (Windhoek date). */
export function buildMessageValues(facts: PatientFacts, practice: PracticeDetails, todayKey: string): MessageValues {
  const birthday = currentBirthday(facts.dateOfBirth, todayKey);
  const age = birthday ? ageOn(facts.dateOfBirth, birthday) : null;
  const fullName = `${facts.firstName} ${facts.lastName}`.trim();
  return {
    first_name: facts.firstName || null,
    last_name: facts.lastName || null,
    full_name: fullName || null,
    practice_name: practice.name?.trim() || null,
    practice_phone: practice.phone?.trim() || null,
    appointment_date: formatMessageDateKey(facts.nextBookingOn),
    appointment_time: facts.nextBookingOn ? facts.nextBookingTime : null,
    age: age !== null && age > 0 ? String(age) : null,
    last_visit_date: formatMessageDateKey(facts.lastCompletedVisitOn),
    balance: facts.balanceDue > 0 ? formatNad(facts.balanceDue) : null,
    missed_date: formatMessageDateKey(facts.lastNoShowOn)
  };
}

export interface RenderedMessage {
  text: string;
  /** Variables still in the text: no value for this patient, or not a variable we know */
  missing: string[];
}

export function renderListMessage(template: string, values: MessageValues): RenderedMessage {
  // A template's names for the same details ({{patientFirstName}}) get the same values
  const withTemplateNames: Record<string, string | null> = { ...values };
  for (const [name, variable] of TEMPLATE_FIELD_NAMES) if (variable) withTemplateNames[name] = values[variable];
  const text = fillPlaceholders(template, withTemplateNames).trim();
  const missing = findPlaceholders(text).map((placeholder) => placeholder.replace(/[{}\s]/g, ''));
  return { text, missing };
}

/** {{variables}} in a template that a list cannot fill: usually a typo, or a template detail lists do not hold. */
export function findUnknownVariables(template: string): string[] {
  return findPlaceholders(template)
    .map((placeholder) => placeholder.replace(/[{}\s]/g, ''))
    .filter((name) => listVariableFor(name) === null);
}

/** "no upcoming appointment", or for a name a list cannot fill why ("{{frist_name}} is not a variable ..."). */
export function describeMissingVariable(name: string): string {
  const variable = listVariableFor(name);
  if (variable) return MISSING_REASONS[variable];
  return TEMPLATE_FIELD_NAMES.has(name)
    ? `{{${name}}} cannot be filled in a list message`
    : `{{${name}}} is not a variable that can be filled in`;
}
