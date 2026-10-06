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
  const text = fillPlaceholders(template, values).trim();
  const missing = findPlaceholders(text).map((placeholder) => placeholder.replace(/[{}\s]/g, ''));
  return { text, missing };
}

/** {{variables}} in a template that are not variables we can fill (usually a typo). */
export function findUnknownVariables(template: string): string[] {
  return findPlaceholders(template)
    .map((placeholder) => placeholder.replace(/[{}\s]/g, ''))
    .filter((name) => !KNOWN_VARIABLES.includes(name));
}

/** "no upcoming appointment", or for an unknown variable "{{frist_name}} is not a variable". */
export function describeMissingVariable(name: string): string {
  return KNOWN_VARIABLES.includes(name)
    ? MISSING_REASONS[name as ListTemplateVariable]
    : `{{${name}}} is not a variable that can be filled in`;
}
