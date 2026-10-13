import { describe, expect, it } from 'vitest';
import { emptyExamDraft, examDraftFrom, validateExamDraft, type ExamDraft } from '../exam';
import { toExam, toPrescription } from '../records';

const TODAY = '2026-10-08';
const draft = (values: Partial<ExamDraft>): ExamDraft => ({ ...emptyExamDraft(TODAY), ...values });
const errorsOf = (values: Partial<ExamDraft>) => {
  const result = validateExamDraft(draft(values), { hasSavedExam: false });
  return result.ok ? {} : result.errors;
};

// Business rule: an eye exam is a clinical record a fund or a colleague may rely on; a pressure without its method
// and time cannot be compared with the next one, and an empty exam is not a record at all
describe('the visit\'s eye exam', () => {
  it('does not save an empty exam', () => {
    expect(errorsOf({}).notes).toMatch(/at least one part/);
    expect(validateExamDraft(draft({}), { hasSavedExam: true }).ok).toBe(true);
  });

  it('needs the method and the time with a pressure', () => {
    expect(errorsOf({ iopRight: '14' })).toMatchObject({ iopMethod: expect.any(String), iopTime: expect.any(String) });
    expect(errorsOf({ iopRight: '14', iopMethod: 'non_contact', iopTime: '9:30' }).iopTime).toBeDefined();
    expect(errorsOf({ iopRight: '81', iopMethod: 'non_contact', iopTime: '09:30' }).iopRight).toBeDefined();
    const ok = validateExamDraft(draft({ iopRight: '14', iopLeft: '15,5', iopMethod: 'rebound', iopTime: '09:30' }), { hasSavedExam: false });
    expect(ok.ok && ok.payload).toMatchObject({ iop_r: 14, iop_l: 15.5, iop_method: 'rebound', iop_time: '09:30' });
  });

  it('keeps vision in one written form', () => {
    const result = validateExamDraft(draft({ vaUnaidedRight: '6/18', vaAidedLeft: 'cf' }), { hasSavedExam: false });
    expect(result.ok && result.payload).toMatchObject({ va_unaided_r: '6/18', va_aided_l: 'CF', va_unaided_l: null });
    expect(errorsOf({ vaUnaidedRight: 'blurry' }).vaUnaidedRight).toBeDefined();
  });

  it('sends the refraction as the new prescription, and nothing when its boxes are empty', () => {
    const withRx = validateExamDraft(
      draft({ refraction: { right: { ...emptyExamDraft(TODAY).refraction.right, sphere: '-1.25', cylinder: '-0.5', axis: '90' }, left: { ...emptyExamDraft(TODAY).refraction.left, sphere: 'pl' } } }),
      { hasSavedExam: false }
    );
    expect(withRx.ok && withRx.refraction?.right).toMatchObject({ sphere: -1.25, cylinder: -0.5, axis: 90 });
    expect(withRx.ok && (withRx.payload.refraction as { valid_until: string }).valid_until).toBe('2028-10-08');
    const withoutRx = validateExamDraft(draft({ notes: 'Routine check' }), { hasSavedExam: false });
    expect(withoutRx.ok && withoutRx.payload.refraction).toBeNull();
  });

  it('sends a contact-lens fit only when "fitted" is on', () => {
    const lens = { ...emptyExamDraft(TODAY).contactLens, right: { ...emptyExamDraft(TODAY).contactLens.right, sphere: '-2', baseCurve: '8.6', diameter: '14.2' }, left: { ...emptyExamDraft(TODAY).contactLens.left, sphere: '-2' } };
    const off = validateExamDraft(draft({ contactLens: lens, notes: 'x' }), { hasSavedExam: false });
    expect(off.ok && off.payload.contact_lens_rx).toBeNull();
    const on = validateExamDraft(draft({ clFitted: true, contactLens: lens, lensName: 'Monthly lens' }), { hasSavedExam: false });
    expect(on.ok && on.payload.contact_lens_rx).toMatchObject({ lens_name: 'Monthly lens', valid_until: '2027-10-08' });
  });

  it('opens a saved exam with its prescriptions, so saving it unchanged sends the same values back', () => {
    const exam = toExam({ id: 'e1', visit_id: 'v1', examined_on: TODAY, va_unaided_r: '6/12', iop_r: '14.0', iop_method: 'applanation', iop_time: '09:30:00', fields_result: 'normal' });
    const rx = toPrescription({ id: 'r1', exam_id: 'e1', kind: 'spectacles', prescribed_on: TODAY, valid_until: '2028-10-08', r_sphere: '-1.00', l_sphere: '-0.75', l_add: '1.50' });
    const result = validateExamDraft(examDraftFrom(exam, [rx], TODAY), { hasSavedExam: true });
    expect(result.ok && result.payload).toMatchObject({ va_unaided_r: '6/12', iop_r: 14, iop_time: '09:30', fields_result: 'normal' });
    expect(result.ok && result.payload.refraction).toMatchObject({ right: { sphere: -1, add: null }, left: { sphere: -0.75, add: 1.5 }, valid_until: '2028-10-08' });
  });
});
