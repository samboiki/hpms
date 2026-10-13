import { describe, expect, it } from 'vitest';
import {
  clFitDraftFrom,
  clFitFromRow,
  cornealCylinder,
  emptyClFitDraft,
  emptyHistoryDraft,
  emptyKEyeDraft,
  emptyKeratometryDraft,
  emptyOcularDraft,
  historyFromRow,
  historySummary,
  keratometryDraftFrom,
  keratometryFromRow,
  keratometrySummary,
  markPartNormal,
  ocularDraftFrom,
  ocularFromRow,
  parseKReading,
  parseRatio,
  partSummary,
  toggleChoice,
  validateClFit,
  validateHistory,
  validateKEye,
  validateKeratometry,
  validateOcular,
  SYMPTOMS
} from '../examParts';
import { emptyExamDraft, examDraftFrom, validateExamDraft } from '../exam';
import { toExam } from '../records';

const TODAY = '2026-10-13';

// Business rule: the case history is what the optometrist asks before testing anything; a fund, a colleague or a
// later visit relies on it being kept in the same words every time (fixed choices, short texts the database accepts)
describe('the case history', () => {
  it('keeps ticked symptoms in one fixed order, so the same history saved twice is the same', () => {
    const first = toggleChoice([], 'headaches', SYMPTOMS);
    const both = toggleChoice(first, 'blur_distance', SYMPTOMS);
    expect(both).toEqual(['blur_distance', 'headaches']);
    expect(toggleChoice(both, 'headaches', SYMPTOMS)).toEqual(['blur_distance']);
  });

  it('sends empty lists and texts as nothing, and says when a text is too long', () => {
    const empty = validateHistory(emptyHistoryDraft());
    expect(empty).toMatchObject({ ok: true, filled: false, payload: { history_symptoms: null, history_reason: null } });
    const long = validateHistory({ ...emptyHistoryDraft(), reason: 'x'.repeat(201) });
    expect(long).toMatchObject({ ok: false, errors: { reason: expect.stringContaining('200') } });
  });

  it('reads what the database stored and leaves out choices it does not know', () => {
    const history = historyFromRow({ history_reason: ' New glasses ', history_symptoms: ['blur_near', 'made_up'], history_health: ['diabetes'] });
    expect(history).toMatchObject({ reason: 'New glasses', symptoms: ['blur_near'], health: ['diabetes'], family: [] });
    expect(historySummary(history)).toBe('New glasses, blurred near vision');
  });
});

// Business rule: keratometry decides the contact-lens base curve and shows corneal astigmatism; keratometers show
// dioptres or a radius in mm, and a reading typed in either must be stored as the same power
describe('keratometry', () => {
  it('reads dioptres and millimetres, which never overlap', () => {
    expect(parseKReading('43.25')).toEqual({ ok: true, dioptres: 43.25, fromMm: false });
    expect(parseKReading('7,80 mm')).toEqual({ ok: true, dioptres: 43.27, fromMm: true });
    expect(parseKReading('7.8')).toEqual({ ok: true, dioptres: 43.27, fromMm: true });
    expect(parseKReading('')).toEqual({ ok: true, dioptres: null, fromMm: false });
    expect(parseKReading('25')).toEqual({ ok: false });
    expect(parseKReading('flat')).toEqual({ ok: false });
  });

  it('needs all four boxes of an eye, the flat reading the lower one', () => {
    expect(validateKEye(emptyKEyeDraft())).toEqual({ ok: true, reading: null });
    expect(validateKEye({ flat: '43', flatAxis: '180', steep: '', steepAxis: '' })).toMatchObject({ ok: false, errors: { steep: expect.any(String), steepAxis: expect.any(String) } });
    expect(validateKEye({ flat: '45', flatAxis: '90', steep: '43', steepAxis: '180' })).toMatchObject({ ok: false, errors: { flat: expect.stringContaining('swap') } });
    expect(validateKEye({ flat: '43', flatAxis: '181', steep: '44', steepAxis: '90' })).toMatchObject({ ok: false, errors: { flatAxis: expect.any(String) } });
  });

  it('works out the corneal cylinder and writes both eyes in one line', () => {
    const checked = validateKeratometry({ ...emptyKeratometryDraft(), right: { flat: '43.25', flatAxis: '180', steep: '44.50', steepAxis: '90' } });
    expect(checked).toMatchObject({ ok: true, filled: true, payload: { k_r_flat: 43.25, k_r_steep_axis: 90, k_l_flat: null } });
    const record = keratometryFromRow({ k_r_flat: '43.25', k_r_flat_axis: 180, k_r_steep: '44.50', k_r_steep_axis: 90 });
    expect(record.right && cornealCylinder(record.right)).toEqual({ power: 1.25, axis: 90 });
    expect(keratometrySummary(record)).toBe('R 43.25 @ 180 / 44.50 @ 90');
    // Opening the saved exam gives back what was typed, so saving it again changes nothing
    expect(keratometryDraftFrom(record).right).toEqual({ flat: '43.25', flatAxis: '180', steep: '44.50', steepAxis: '90' });
  });
});

// Business rule: an "abnormal" finding without a description cannot be followed up at the next visit or in a
// referral; "all normal" must be one tap because most eyes are healthy
describe('ocular health', () => {
  it('marks every part of the front of the eye normal in one go, keeping what was already recorded', () => {
    const draft = emptyOcularDraft();
    draft.findings.cornea = { right: 'abnormal', left: '', note: 'Old scar' };
    const marked = markPartNormal(draft, 'front');
    expect(marked.findings.lids).toEqual({ right: 'normal', left: 'normal', note: '' });
    expect(marked.findings.cornea).toEqual({ right: 'abnormal', left: 'normal', note: 'Old scar' });
    expect(marked.findings.macula).toEqual({ right: '', left: '', note: '' });
    expect(partSummary(marked.findings, 'front')).toBe('Abnormal: cornea (R)');
    expect(partSummary(marked.findings, 'back')).toBe('Not examined');
  });

  it('asks what was seen with an abnormal finding and checks the cup-to-disc ratio', () => {
    const draft = emptyOcularDraft();
    draft.findings.disc = { right: 'abnormal', left: 'normal', note: '' };
    expect(validateOcular({ ...draft, cdRight: '1.2' })).toMatchObject({ ok: false, errors: { findings: { disc: expect.any(String) }, cdRight: expect.any(String) } });
    draft.findings.disc.note = 'Notched rim, refer';
    const ok = validateOcular({ ...draft, cdRight: '.65', cdLeft: '0,3', fundusMethod: 'slit_lamp', dilated: true });
    expect(ok).toMatchObject({
      ok: true,
      payload: { ocular_health: { disc: { r: 'abnormal', l: 'normal', note: 'Notched rim, refer' } }, cd_ratio_r: 0.65, cd_ratio_l: 0.3, fundus_method: 'slit_lamp', dilated: true }
    });
  });

  it('reads the stored findings back into the form unchanged', () => {
    const stored = ocularFromRow({ ocular_health: { lens: { r: 'abnormal', note: 'Early cataract' }, unknown: { r: 'normal' } }, cd_ratio_r: '0.30', dilated: false });
    expect(stored.findings).toEqual({ lens: { right: 'abnormal', left: null, note: 'Early cataract' } });
    const draft = ocularDraftFrom(stored);
    expect(draft.findings.lens).toEqual({ right: 'abnormal', left: '', note: 'Early cataract' });
    expect(draft.cdRight).toBe('0.30');
    expect(parseRatio('abc')).toEqual({ ok: false });
  });
});

// Business rule: a contact-lens fit is judged per eye (how the lens sits, moves and feels); the over-refraction and
// the vision through the lens decide whether the lens power is right
describe('the contact-lens fit', () => {
  it('keeps only the aspects that were judged and checks the over-refraction', () => {
    const draft = { ...emptyClFitDraft(), lensType: 'toric' as const, overRight: '+0.25', vaRight: '6/6' };
    draft.right.movement = 'tight';
    const checked = validateClFit(draft);
    expect(checked).toMatchObject({ ok: true, payload: { cl_lens_type: 'toric', cl_fit: { r: { movement: 'tight' } }, cl_over_r: 0.25, cl_va_r: '6/6', cl_va_l: null } });
    expect(validateClFit({ ...emptyClFitDraft(), overLeft: '+0.30' })).toMatchObject({ ok: false, errors: { overLeft: expect.any(String) } });
  });

  it('reads a stored fit back into the form', () => {
    const fit = clFitFromRow({ cl_lens_type: 'soft', cl_fit: { l: { comfort: 'poor', made_up: 'x' } }, cl_over_l: '-0.50' });
    expect(fit.left).toEqual({ comfort: 'poor' });
    expect(clFitDraftFrom(fit)).toMatchObject({ lensType: 'soft', overLeft: '-0.50', left: { comfort: 'poor', movement: '' } });
  });
});

// Business rule: the full exam is only sent once the database keeps it; until then an exam saves exactly as before,
// and an exam saved by an older screen must not wipe parts recorded on a newer one
describe('the full exam in the visit', () => {
  it('sends the full parts only when the database keeps them', () => {
    const draft = { ...emptyExamDraft(TODAY), notes: 'Routine', history: { ...emptyHistoryDraft(), reason: 'Headaches' } };
    const before = validateExamDraft(draft, { hasSavedExam: false });
    expect(before.ok && 'history_reason' in before.payload).toBe(false);
    const after = validateExamDraft(draft, { hasSavedExam: false, full: true });
    expect(after.ok && after.payload.history_reason).toBe('Headaches');
  });

  it('counts a case history alone as an exam worth saving', () => {
    const draft = { ...emptyExamDraft(TODAY), history: { ...emptyHistoryDraft(), symptoms: ['dry_eyes' as const] } };
    expect(validateExamDraft(draft, { hasSavedExam: false }).ok).toBe(false);
    expect(validateExamDraft(draft, { hasSavedExam: false, full: true }).ok).toBe(true);
  });

  it('clears the fit when contact lenses are no longer fitted at this visit', () => {
    const draft = { ...emptyExamDraft(TODAY), notes: 'x', clFitted: false, clFit: { ...emptyClFitDraft(), lensType: 'soft' as const } };
    const result = validateExamDraft(draft, { hasSavedExam: true, full: true });
    expect(result.ok && result.payload).toMatchObject({ cl_lens_type: null, cl_fit: null, cl_va_r: null });
  });

  it('shows the parts as errors under their own sections', () => {
    const draft = { ...emptyExamDraft(TODAY), keratometry: { ...emptyKeratometryDraft(), left: { flat: '43', flatAxis: '', steep: '44', steepAxis: '90' } } };
    expect(validateExamDraft(draft, { hasSavedExam: false, full: true })).toMatchObject({ ok: false, errors: { keratometry: { left: { flatAxis: expect.any(String) } } } });
  });

  it('opens a saved full exam so that saving it unchanged sends the same values', () => {
    const exam = toExam({
      id: 'e1', visit_id: 'v1', examined_on: TODAY, history_reason: 'Routine', history_symptoms: ['blur_near'], k_l_flat: '42.00',
      k_l_flat_axis: 5, k_l_steep: '42.75', k_l_steep_axis: 95, ocular_health: { macula: { r: 'normal', l: 'normal' } }, cd_ratio_l: '0.40',
      cl_lens_type: 'rgp', cl_va_r: '6/6'
    });
    const draft = examDraftFrom(exam, [], TODAY);
    expect(draft.clFitted).toBe(true);
    const result = validateExamDraft(draft, { hasSavedExam: true, full: true });
    expect(result.ok && result.payload).toMatchObject({
      history_reason: 'Routine', history_symptoms: ['blur_near'], k_l_flat: 42, k_l_steep_axis: 95,
      ocular_health: { macula: { r: 'normal', l: 'normal' } }, cd_ratio_l: 0.4, cl_lens_type: 'rgp', cl_va_r: '6/6'
    });
  });
});
