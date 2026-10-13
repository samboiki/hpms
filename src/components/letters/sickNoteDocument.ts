import { buildSickNote, type LetterDocument, type SickNoteInput, type SickNoteWording } from '../../utils/clinical/letters';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { loadLetterContext } from '../../services/patientLettersService';
import { loadSickNoteTemplate } from '../../services/letterTemplatesService';
import { blankMissingFields, fieldsIn, mergeTemplate, sickNoteMergeValues, type MergeValues } from '../../utils/templates/mergeFields';
import type { LetterTemplate } from '../../utils/templates/letterTemplates';

export interface SickNoteSource extends SickNoteInput {
  /** The practitioner on the sick note (leave_forms.doctor_id); else the signed-in user */
  doctorId: string | null;
  /** leave_forms.issue_date: the date the note was issued */
  issueDate: string | null;
}

/**
 * The practice's sick note template merged for one sick note. The values are this note's own: its days, and the
 * diagnosis only as written on the sick note (an employer is not entitled to the visit's). A field without a value is
 * left out, because the note is printed straight from the visit with no step to ask for it.
 */
export function sickNoteWording(template: LetterTemplate, note: SickNoteInput, recordValues: MergeValues): SickNoteWording {
  const diagnosis = [note.diagnosis?.trim(), note.diagnosisCode?.trim() ? `(${note.diagnosisCode.trim()})` : null].filter(Boolean).join(' ') || null;
  // Only this note's days: never another sick note's of the same visit
  const noDays: MergeValues = { sickNoteFrom: null, sickNoteTo: null, daysOff: null, returnDate: null, sickNoteNumber: null };
  const values: MergeValues = { ...recordValues, ...noDays, ...sickNoteMergeValues(note), diagnosis };
  const fill = (text: string) => blankMissingFields(mergeTemplate(text, values).text).trim();
  return {
    title: fill(template.title),
    subject: fill(template.subject),
    greeting: fill(template.greeting),
    body: fill(template.body),
    showsDiagnosis: fieldsIn(template.body).includes('diagnosis')
  };
}

/**
 * The visit's sick note on the practice letterhead, read fresh when it is printed or emailed: in the practice's own
 * wording when it keeps a sick note template (Messages > Templates), otherwise in the built-in wording.
 */
export async function buildSickNoteDocument(params: {
  practiceId: string;
  patientId: string;
  visitId: string | null;
  signedInUserId: string;
  note: SickNoteSource;
}): Promise<LetterDocument> {
  const { note } = params;
  const issued = note.issueDate ? note.issueDate.slice(0, 10) : null;
  const [{ context, merge }, template] = await Promise.all([
    loadLetterContext({
      practiceId: params.practiceId,
      patientId: params.patientId,
      visitId: params.visitId,
      authorId: note.doctorId ?? params.signedInUserId,
      letterDate: issued && /^\d{4}-\d{2}-\d{2}$/.test(issued) ? issued : windhoekClock(new Date()).dateKey
    }),
    loadSickNoteTemplate(params.practiceId)
  ]);
  return buildSickNote(note, context, template ? sickNoteWording(template, note, merge) : null);
}
