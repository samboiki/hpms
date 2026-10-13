/**
 * A letter template merged for everyone on a patient list (Messages > Lists): one letter per patient, or the reason a
 * patient gets none. As with list messages, a field without a value is never printed blank or made up: that patient
 * is left out and the review says why ("no postal address on file").
 */
import { fieldLabel, mergeTemplate, type MergeFieldName, type MergeValues } from './mergeFields';
import type { LetterTemplateDraft } from './letterTemplates';

export interface ListLetterPatient {
  patientId: string;
  name: string;
  /** The patient's own fields (name, title, address, next booking...) */
  values: MergeValues;
}

export interface LetterParts {
  title: string;
  recipient: string;
  subject: string;
  greeting: string;
  body: string;
}

export interface PlannedLetter {
  patientId: string;
  name: string;
  parts: LetterParts;
}

export interface SkippedLetter {
  patientId: string;
  name: string;
  reason: string;
}

const REASONS: Partial<Record<MergeFieldName, string>> = {
  patientTitle: 'no title on file',
  patientIdNumber: 'no ID number on file',
  patientDateOfBirth: 'no date of birth on file',
  patientAge: 'no date of birth on file',
  patientAddress: 'no postal address on file',
  appointmentDate: 'no upcoming appointment',
  appointmentTime: 'no time on the next appointment',
  lastVisitDate: 'no completed visit',
  practitionerName: 'no name on your staff profile',
  practicePhone: "the practice's phone number is not set up",
  practiceEmail: "the practice's email address is not set up",
  practiceAddress: "the practice's address is not set up"
};

/** Why a patient gets no letter, in words: "no postal address on file" */
export function missingReason(name: string): string {
  return REASONS[name as MergeFieldName] ?? `no ${fieldLabel(name).toLowerCase()} on file`;
}

export function mergeLetterParts(template: Pick<LetterTemplateDraft, 'title' | 'recipient' | 'subject' | 'greeting' | 'body'>, values: MergeValues): { parts: LetterParts; missing: string[] } {
  const merged = {
    title: mergeTemplate(template.title, values),
    recipient: mergeTemplate(template.recipient, values),
    subject: mergeTemplate(template.subject, values),
    greeting: mergeTemplate(template.greeting, values),
    body: mergeTemplate(template.body, values)
  };
  const missing = [...new Set(Object.values(merged).flatMap(part => part.missing))];
  return {
    parts: { title: merged.title.text, recipient: merged.recipient.text, subject: merged.subject.text, greeting: merged.greeting.text, body: merged.body.text },
    missing
  };
}

/** One letter per patient, in the list's order; the others with the reason they get none. */
export function planListLetters(
  template: Pick<LetterTemplateDraft, 'title' | 'recipient' | 'subject' | 'greeting' | 'body'>,
  patients: readonly ListLetterPatient[],
  shared: MergeValues
): { letters: PlannedLetter[]; skipped: SkippedLetter[] } {
  const letters: PlannedLetter[] = [];
  const skipped: SkippedLetter[] = [];
  for (const patient of patients) {
    const { parts, missing } = mergeLetterParts(template, { ...shared, ...patient.values });
    if (missing.length > 0) {
      const reasons = [...new Set(missing.map(missingReason))];
      skipped.push({ patientId: patient.patientId, name: patient.name, reason: reasons.join('; ') });
    } else {
      letters.push({ patientId: patient.patientId, name: patient.name, parts });
    }
  }
  return { letters, skipped };
}
