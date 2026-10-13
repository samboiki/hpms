/**
 * The visit's eye exam form: vision without and with the patient's own glasses, the refraction (the new spectacle
 * prescription), eye pressure with how and when it was measured, visual fields, a contact-lens fitting and notes,
 * and the full exam's parts (case history, keratometry, ocular health, the contact-lens fit: examParts.ts). The
 * database checks the same (optometry_exams and optometry_prescriptions in proposals/2026-10-08-optometry.sql and
 * proposals/2026-10-13-optometry-frames-and-exam.sql). Pure; tested in __tests__/exam.test.ts.
 */
import { isValidDateKey } from '../billing/dates';
import { normaliseVisualAcuity } from './visualAcuity';
import { defaultValidUntil, emptyRxDraft, isEmptyRxDraft, parsePlainNumber, rxDraftFrom, validateRxDraft, type Rx, type RxDraft, type RxDraftErrors } from './prescription';
import { IOP_METHODS, rxJson, type ExamRecord, type FieldsResult, type IopMethod, type PrescriptionRecord } from './records';
import {
  CL_FIT_KEYS,
  clFitDraftFrom,
  emptyClFitDraft,
  emptyHistoryDraft,
  emptyKeratometryDraft,
  emptyOcularDraft,
  historyDraftFrom,
  keratometryDraftFrom,
  ocularDraftFrom,
  validateClFit,
  validateHistory,
  validateKeratometry,
  validateOcular,
  type ClFitDraft,
  type ClFitErrors,
  type HistoryDraft,
  type HistoryErrors,
  type KeratometryDraft,
  type KeratometryErrors,
  type OcularDraft,
  type OcularErrors
} from './examParts';

export const IOP_LIMITS = { min: 1, max: 80 } as const;

type VaField = 'vaUnaidedRight' | 'vaUnaidedLeft' | 'vaAidedRight' | 'vaAidedLeft';

export interface ExamDraft {
  vaUnaidedRight: string;
  vaUnaidedLeft: string;
  vaAidedRight: string;
  vaAidedLeft: string;
  refraction: RxDraft;
  validUntil: string;
  iopRight: string;
  iopLeft: string;
  iopMethod: IopMethod | '';
  /** "09:30" */
  iopTime: string;
  fieldsResult: FieldsResult | '';
  fieldsNote: string;
  clFitted: boolean;
  contactLens: RxDraft;
  lensName: string;
  clValidUntil: string;
  clFittingNote: string;
  notes: string;
  history: HistoryDraft;
  keratometry: KeratometryDraft;
  ocular: OcularDraft;
  clFit: ClFitDraft;
}

export interface ExamDraftErrors extends Partial<Record<VaField | 'validUntil' | 'iopRight' | 'iopLeft' | 'iopMethod' | 'iopTime' | 'fieldsNote' | 'lensName' | 'clValidUntil' | 'clFittingNote' | 'notes', string>> {
  refraction?: RxDraftErrors;
  contactLens?: RxDraftErrors;
  history?: HistoryErrors;
  keratometry?: KeratometryErrors;
  ocular?: OcularErrors;
  clFit?: ClFitErrors;
}

export function emptyExamDraft(today: string): ExamDraft {
  return {
    vaUnaidedRight: '',
    vaUnaidedLeft: '',
    vaAidedRight: '',
    vaAidedLeft: '',
    refraction: emptyRxDraft(),
    validUntil: defaultValidUntil('spectacles', today),
    iopRight: '',
    iopLeft: '',
    iopMethod: '',
    iopTime: '',
    fieldsResult: '',
    fieldsNote: '',
    clFitted: false,
    contactLens: emptyRxDraft(),
    lensName: '',
    clValidUntil: defaultValidUntil('contact_lenses', today),
    clFittingNote: '',
    notes: '',
    history: emptyHistoryDraft(),
    keratometry: emptyKeratometryDraft(),
    ocular: emptyOcularDraft(),
    clFit: emptyClFitDraft()
  };
}

/** The form for a saved exam and the prescriptions recorded at it. */
export function examDraftFrom(exam: ExamRecord | null, prescriptions: readonly PrescriptionRecord[], today: string): ExamDraft {
  const empty = emptyExamDraft(today);
  if (!exam) return empty;
  const spectacles = prescriptions.find(rx => rx.kind === 'spectacles' && !rx.voidedAt) ?? null;
  const contact = prescriptions.find(rx => rx.kind === 'contact_lenses' && !rx.voidedAt) ?? null;
  const number = (value: number | null) => (value === null ? '' : String(value));
  return {
    ...empty,
    vaUnaidedRight: exam.vaUnaided.right ?? '',
    vaUnaidedLeft: exam.vaUnaided.left ?? '',
    vaAidedRight: exam.vaAided.right ?? '',
    vaAidedLeft: exam.vaAided.left ?? '',
    refraction: rxDraftFrom(spectacles),
    validUntil: spectacles?.validUntil ?? empty.validUntil,
    iopRight: number(exam.iopRight),
    iopLeft: number(exam.iopLeft),
    iopMethod: exam.iopMethod ?? '',
    iopTime: exam.iopTime ?? '',
    fieldsResult: exam.fieldsResult ?? '',
    fieldsNote: exam.fieldsNote ?? '',
    clFitted: contact !== null || Boolean(exam.clFittingNote) || exam.clFit.lensType !== null,
    contactLens: rxDraftFrom(contact),
    lensName: contact?.lensName ?? '',
    clValidUntil: contact?.validUntil ?? empty.clValidUntil,
    clFittingNote: exam.clFittingNote ?? '',
    notes: exam.notes ?? '',
    history: historyDraftFrom(exam.history),
    keratometry: keratometryDraftFrom(exam.keratometry),
    ocular: ocularDraftFrom(exam.ocular),
    clFit: clFitDraftFrom(exam.clFit)
  };
}

const isTenth = (value: number): boolean => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9;

/**
 * Checks the exam and builds the optometry_save_exam payload (without the visit). An empty refraction or contact-lens
 * box saves the exam without that prescription; a pressure needs its method and the time it was measured, because
 * pressure changes through the day and between methods. `full`: the database keeps the full exam's parts (case
 * history, keratometry, ocular health, the contact-lens fit); without it they are neither checked nor sent.
 */
export function validateExamDraft(
  draft: ExamDraft,
  options: { hasSavedExam: boolean; full?: boolean }
): { ok: true; payload: Record<string, unknown>; refraction: Rx | null } | { ok: false; errors: ExamDraftErrors } {
  const errors: ExamDraftErrors = {};
  const full = options.full === true;
  const history = full ? validateHistory(draft.history) : null;
  if (history && !history.ok) errors.history = history.errors;
  const keratometry = full ? validateKeratometry(draft.keratometry) : null;
  if (keratometry && !keratometry.ok) errors.keratometry = keratometry.errors;
  const ocular = full ? validateOcular(draft.ocular) : null;
  if (ocular && !ocular.ok) errors.ocular = ocular.errors;
  const clFit = full && draft.clFitted ? validateClFit(draft.clFit) : null;
  if (clFit && !clFit.ok) errors.clFit = clFit.errors;
  const va: Partial<Record<VaField, string | null>> = {};
  for (const field of ['vaUnaidedRight', 'vaUnaidedLeft', 'vaAidedRight', 'vaAidedLeft'] as const) {
    const text = draft[field].trim();
    va[field] = text ? normaliseVisualAcuity(text) : null;
    if (text && va[field] === null) errors[field] = 'E.g. 6/6, 6/9+2, 20/20, 1.0, CF, HM, LP or NLP.';
  }

  let refraction: Rx | null = null;
  if (!isEmptyRxDraft(draft.refraction)) {
    const checked = validateRxDraft(draft.refraction, 'spectacles');
    if (checked.ok) refraction = checked.rx;
    else errors.refraction = checked.errors;
    if (draft.validUntil && !isValidDateKey(draft.validUntil)) errors.validUntil = 'Choose a date.';
  }

  const pressure = (field: 'iopRight' | 'iopLeft'): number | null => {
    const parsed = parsePlainNumber(draft[field], 1);
    if (!parsed.ok || (parsed.value !== null && (parsed.value < IOP_LIMITS.min || parsed.value > IOP_LIMITS.max || !isTenth(parsed.value)))) {
      errors[field] = `Pressure: ${IOP_LIMITS.min} to ${IOP_LIMITS.max} mmHg.`;
      return null;
    }
    return parsed.value;
  };
  const iopRight = pressure('iopRight');
  const iopLeft = pressure('iopLeft');
  const measured = iopRight !== null || iopLeft !== null;
  if (measured && !draft.iopMethod) errors.iopMethod = 'How was the pressure measured?';
  if (draft.iopMethod && !IOP_METHODS.includes(draft.iopMethod)) errors.iopMethod = 'Choose the method.';
  if (measured && !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.iopTime)) errors.iopTime = 'The time it was measured, e.g. 09:30.';

  let contactLens: Rx | null = null;
  if (draft.clFitted && !isEmptyRxDraft(draft.contactLens)) {
    const checked = validateRxDraft(draft.contactLens, 'contact_lenses');
    if (checked.ok) contactLens = checked.rx;
    else errors.contactLens = checked.errors;
    if (draft.lensName.trim().length > 80) errors.lensName = 'Keep the lens name to 80 characters.';
    if (draft.clValidUntil && !isValidDateKey(draft.clValidUntil)) errors.clValidUntil = 'Choose a date.';
  }
  if (draft.fieldsNote.trim().length > 300) errors.fieldsNote = 'Keep the note to 300 characters.';
  if (draft.clFittingNote.trim().length > 500) errors.clFittingNote = 'Keep the fitting note to 500 characters.';
  if (draft.notes.trim().length > 1000) errors.notes = 'Keep the notes to 1000 characters.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const parts = [history, keratometry, ocular, clFit].flatMap(part => (part && part.ok ? [part] : []));
  const anything =
    Object.values(va).some(Boolean) || refraction !== null || measured || draft.fieldsResult !== '' || contactLens !== null ||
    draft.clFittingNote.trim() !== '' || draft.notes.trim() !== '' || parts.some(part => part.filled);
  if (!anything && !options.hasSavedExam) return { ok: false, errors: { notes: 'Fill in at least one part of the exam.' } };

  // A fit taken off (contact lenses not fitted) clears what was recorded about it
  const noFit = full && !draft.clFitted ? Object.fromEntries(CL_FIT_KEYS.map(key => [key, null])) : {};
  return {
    ok: true,
    refraction,
    payload: {
      ...Object.assign({}, ...parts.map(part => part.payload)),
      ...noFit,
      va_unaided_r: va.vaUnaidedRight ?? null,
      va_unaided_l: va.vaUnaidedLeft ?? null,
      va_aided_r: va.vaAidedRight ?? null,
      va_aided_l: va.vaAidedLeft ?? null,
      iop_r: iopRight,
      iop_l: iopLeft,
      iop_method: measured ? draft.iopMethod : null,
      iop_time: measured ? draft.iopTime : null,
      fields_result: draft.fieldsResult || null,
      fields_note: draft.fieldsResult ? draft.fieldsNote.trim() || null : null,
      cl_fitting_note: draft.clFitted ? draft.clFittingNote.trim() || null : null,
      notes: draft.notes.trim() || null,
      refraction: refraction ? rxJson(refraction, { validUntil: draft.validUntil }) : null,
      contact_lens_rx: contactLens ? rxJson(contactLens, { validUntil: draft.clValidUntil, lensName: draft.lensName }) : null
    }
  };
}
