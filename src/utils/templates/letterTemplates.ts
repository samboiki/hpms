/**
 * A practice's letter templates (letter_templates, proposals/2026-10-12-letter-templates.sql): their kinds, the
 * examples a practice starts from, the checks the save function makes (the same limits, in the same words) and which
 * templates a patient list can fill.
 */
import { fieldsIn, singleBraceSlips, unknownFields, fieldLabel, type MergeFieldName } from './mergeFields';

/** 'consent': a consent form the patient signs on the screen (proposals/2026-10-13-patient-file-extras.sql) */
export type LetterTemplateKind = 'sick_note' | 'certificate' | 'referral' | 'recall' | 'letter' | 'consent';

export interface LetterKindInfo {
  kind: LetterTemplateKind;
  label: string;
  /** One plain sentence: where letters of this kind are made */
  hint: string;
  icon: string;
}

export const LETTER_KINDS: readonly LetterKindInfo[] = [
  {
    kind: 'sick_note',
    label: 'Sick note',
    hint: 'The wording of every sick note printed or emailed from a visit (one per practice).',
    icon: 'solar:health-bold-duotone'
  },
  { kind: 'certificate', label: 'Certificate', hint: 'Fitness, attendance and other certificates, from a visit or the patient file.', icon: 'solar:diploma-verified-bold-duotone' },
  { kind: 'referral', label: 'Referral letter', hint: 'A referral you send often, from a visit or the patient file.', icon: 'solar:file-send-bold-duotone' },
  { kind: 'recall', label: 'Recall letter', hint: 'For one patient, or everyone on a patient list (Messages > Lists).', icon: 'solar:calendar-mark-bold-duotone' },
  { kind: 'letter', label: 'Other letter', hint: 'Any other letter, from a visit, the patient file or a patient list.', icon: 'solar:document-text-bold-duotone' },
  {
    kind: 'consent',
    label: 'Consent form',
    hint: 'Signed on the screen by the patient (finger or mouse) from a visit or the patient file, and kept as a PDF on the file.',
    icon: 'solar:pen-new-square-bold-duotone'
  }
];

/**
 * Kinds made as letters (Write a letter, and a patient list's letters). A sick note is made on the visit's Sick note
 * tab and a consent form is signed on the screen (Consent forms), so neither is offered as a letter.
 */
export const isLetterKind = (kind: LetterTemplateKind): boolean => kind !== 'sick_note' && kind !== 'consent';

export const letterKindInfo = (kind: LetterTemplateKind): LetterKindInfo => LETTER_KINDS.find(info => info.kind === kind) ?? LETTER_KINDS[4];

export const isLetterTemplateKind = (value: unknown): value is LetterTemplateKind => LETTER_KINDS.some(info => info.kind === value);

export interface LetterTemplateDraft {
  kind: LetterTemplateKind;
  name: string;
  /** The big title on the letterhead */
  title: string;
  /** The "To" block, one line each (may hold fields) */
  recipient: string;
  /** The bold line above the greeting (may hold fields) */
  subject: string;
  /** "To whom it may concern" (may hold fields) */
  greeting: string;
  /** Paragraphs separated by a blank line, with fields */
  body: string;
}

export interface LetterTemplate extends LetterTemplateDraft {
  id: string;
  updatedAt: string | null;
}

/** The text of every part of a template, in the order they print. */
export const templateParts = (draft: Pick<LetterTemplateDraft, 'title' | 'recipient' | 'subject' | 'greeting' | 'body'>): string[] => [
  draft.title,
  draft.recipient,
  draft.subject,
  draft.greeting,
  draft.body
];

/** The same limits as save_letter_template, in the same words, plus fields that cannot be filled. */
export function checkLetterTemplate(draft: LetterTemplateDraft): string[] {
  const problems: string[] = [];
  const name = draft.name.trim();
  if (name.length < 1 || name.length > 80) problems.push('Give the template a name (up to 80 characters).');
  const title = draft.title.trim();
  if (title.length < 1 || title.length > 60) problems.push('Give the letter a title for the letterhead (up to 60 characters).');
  const body = draft.body.trim();
  if (body.length < 3 || body.length > 8000) problems.push('Write the letter (3 to 8,000 characters).');
  if (draft.recipient.trim().length > 300) problems.push('Keep the "To" lines to 300 characters.');
  if (draft.subject.trim().length > 200) problems.push('Keep the subject line to 200 characters.');
  if (draft.greeting.trim().length > 120) problems.push('Keep the greeting to 120 characters.');
  const text = templateParts(draft).join('\n');
  for (const field of unknownFields(text, 'letter')) problems.push(`{{${field}}} is not a field a letter can fill. Pick fields from the list.`);
  for (const slip of singleBraceSlips(text)) problems.push(`${slip} needs two braces on each side, like {{patientName}}.`);
  return problems;
}

/** Fields only a visit has: a list letter, made for many patients at once, cannot fill them. */
const VISIT_ONLY_FIELDS: readonly MergeFieldName[] = ['visitDate', 'diagnosis', 'procedure', 'sickNoteFrom', 'sickNoteTo', 'daysOff', 'returnDate', 'sickNoteNumber'];

/** Whether a template can be merged for everyone on a patient list, and if not, why (in plain words). */
export function listLetterProblem(template: Pick<LetterTemplate, 'kind' | 'title' | 'recipient' | 'subject' | 'greeting' | 'body'>): string | null {
  if (template.kind === 'sick_note') return 'A sick note belongs to a visit, so it cannot be made for a list.';
  if (template.kind === 'consent') return 'A consent form is signed by each patient on the screen, so it cannot be made for a list.';
  const visitOnly = fieldsIn(templateParts(template).join('\n')).filter(name => (VISIT_ONLY_FIELDS as readonly string[]).includes(name));
  if (visitOnly.length === 0) return null;
  return `It uses ${visitOnly.map(fieldLabel).join(', ')}, which only a visit has. Use it from the visit instead.`;
}

/** Examples a practice starts from (nothing is saved until an administrator saves it). */
export const LETTER_TEMPLATE_EXAMPLES: readonly LetterTemplateDraft[] = [
  {
    kind: 'sick_note',
    name: 'Sick note',
    title: 'MEDICAL CERTIFICATE',
    recipient: '',
    subject: 'Sick note',
    greeting: 'To whom it may concern',
    body:
      'This is to certify that {{patientName}} was examined by me on {{visitDate}}.\n\n' +
      'In my opinion the patient is unfit for work or school from {{sickNoteFrom}} to {{sickNoteTo}} inclusive ({{daysOff}}), and may return on {{returnDate}}.'
  },
  {
    kind: 'certificate',
    name: 'Attendance certificate',
    title: 'CERTIFICATE OF ATTENDANCE',
    recipient: '',
    subject: 'Re: {{patientName}}',
    greeting: 'To whom it may concern',
    body: 'This is to confirm that {{patientName}} attended {{practiceName}} on {{visitDate}}.'
  },
  {
    kind: 'certificate',
    name: 'Fit to return to work',
    title: 'MEDICAL CERTIFICATE',
    recipient: '',
    subject: 'Re: {{patientName}}, ID {{patientIdNumber}}',
    greeting: 'To whom it may concern',
    body: 'This is to certify that I examined {{patientName}} on {{visitDate}}. In my opinion the patient is fit to return to work or school on {{returnDate}}.'
  },
  {
    kind: 'referral',
    name: 'Referral letter',
    title: 'REFERRAL LETTER',
    recipient: '',
    subject: 'Re: {{patientName}}, born {{patientDateOfBirth}}',
    greeting: 'Dear colleague',
    body:
      'Thank you for seeing {{patientName}}, whom I saw on {{visitDate}}.\n\n' +
      'Working diagnosis: {{diagnosis}}.\n\n' +
      'I would appreciate your assessment and management. Please contact me on {{practicePhone}} with any questions.'
  },
  {
    kind: 'recall',
    name: 'Check-up reminder',
    title: 'TIME FOR YOUR CHECK-UP',
    recipient: '{{patientFormalName}}',
    subject: '',
    greeting: 'Dear {{patientFormalName}}',
    body:
      'Our records show that your last visit to {{practiceName}} was on {{lastVisitDate}}, so it is time for your next check-up.\n\n' +
      'Please call us on {{practicePhone}} to make an appointment at a time that suits you. We look forward to seeing you.'
  },
  {
    kind: 'consent',
    name: 'Consent to treatment',
    title: 'CONSENT TO TREATMENT',
    recipient: '',
    subject: 'Patient: {{patientName}}',
    greeting: '',
    body:
      'I, the undersigned, consent to {{patientName}} being examined and treated by {{practitionerName}} and the staff of {{practiceName}}.\n\n' +
      'The examination and the treatment, with their benefits, their risks and the other options, were explained to me in a language I understand, and my questions were answered.\n\n' +
      'I understand that I may withdraw this consent at any time before the treatment.'
  },
  {
    kind: 'consent',
    name: 'Consent to a procedure',
    title: 'CONSENT TO A PROCEDURE',
    recipient: '',
    subject: 'Patient: {{patientName}}',
    greeting: '',
    body:
      'I, the undersigned, consent to the following procedure for {{patientName}}: {{procedure}}.\n\n' +
      '{{practitionerName}} explained why it is advised, what it involves, its risks and possible complications, and the other options, including not having it. I could ask questions and they were answered.\n\n' +
      'I agree to the local anaesthetic and other medicines the procedure needs, and I understand that I may withdraw this consent at any time before the procedure starts.'
  }
];

/** An empty template of a kind, with the usual title and greeting of that kind. */
export function blankLetterTemplate(kind: LetterTemplateKind): LetterTemplateDraft {
  const example = LETTER_TEMPLATE_EXAMPLES.find(item => item.kind === kind);
  return {
    kind,
    name: '',
    title: example?.title ?? 'LETTER',
    recipient: '',
    subject: '',
    greeting: example?.greeting ?? 'To whom it may concern',
    body: ''
  };
}
