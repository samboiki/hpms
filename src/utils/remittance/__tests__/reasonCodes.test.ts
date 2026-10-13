/**
 * Reason codes decide who pays. The tests protect the rules that cost money or trust when wrong:
 * a 202 line may never reach a patient, an unknown code is never guessed into a patient charge, and
 * an informational note on a paid line is not treated as a rejection.
 */
import { describe, expect, it } from 'vitest';
import { classifyLineReasons, classifyReason, patientMayBeBilled } from '../reasonCodes';

describe('fund reason codes', () => {
  it('lets 202 (member not liable) decide a line even when a patient-liable code is printed with it', () => {
    const { primary } = classifyLineReasons('methealth', ['246', '202'], [], {}, false);
    expect(primary).toMatchObject({ code: '202', category: 'write_off', source: 'catalogue' });
    expect(patientMayBeBilled('write_off')).toBe(false);
  });

  it('never lets a line that was already paid be billed to the patient', () => {
    expect(classifyReason('methealth', '18')).toMatchObject({ category: 'duplicate' });
    expect(classifyReason('medscheme', '23')).toMatchObject({ category: 'duplicate' });
    expect(patientMayBeBilled('duplicate')).toBe(false);
    expect(patientMayBeBilled('patient_liable')).toBe(true);
  });

  it("reads codes per administrator: Medscheme's 23 is a duplicate, Methealth has no 23", () => {
    expect(classifyReason('medscheme', '23').category).toBe('duplicate');
    expect(classifyReason('methealth', '23').source).toBe('unknown');
  });

  it("classifies an unknown code from the fund's wording, marked as a suggestion, and sends a code without wording to a person", () => {
    expect(classifyReason('methealth', '301', 'SERVICE NOT COVERED BY OPTION')).toMatchObject({ category: 'patient_liable', source: 'wording' });
    expect(classifyReason('methealth', '302', 'PRE-AUTHORISATION REQUIRED')).toMatchObject({ category: 'fixable', source: 'wording' });
    expect(classifyReason('methealth', '999')).toMatchObject({ category: 'review', source: 'unknown' });
  });

  it('puts an unknown reason before a patient charge: a person decides when the line also carries a known code', () => {
    const { primary } = classifyLineReasons('medscheme', ['514', '777'], [], {}, false);
    expect(primary?.category).toBe('review');
  });

  it('ignores "no ICD-10 code" (5302) on a line that was paid, but treats it as the reason on a line that was not', () => {
    expect(classifyLineReasons('medscheme', ['505', '5302'], [], {}, true).primary).toBeNull();
    expect(classifyLineReasons('medscheme', ['5302'], [], {}, false).primary).toMatchObject({ category: 'fixable' });
  });

  it('classifies the NHP acknowledgement messages, which have no codes', () => {
    const classify = (text: string) => classifyLineReasons('medscheme', [], [text], {}, false).primary?.category;
    expect(classify('Claim line submitted without diagnosis codes')).toBe('fixable');
    expect(classify('Tooth number(s) required.')).toBe('fixable');
    expect(classify('This patient is not registered as a beneficiary of the member')).toBe('fixable');
    expect(classify("Patient matched more than one of the member's beneficiaries.")).toBe('fixable');
    expect(classify('Service not covered by plan')).toBe('patient_liable');
    expect(classify('Claim has been held for manual intervention')).toBe('hold');
  });

  it('works for any discipline: a GP line rejected for missing authorisation is fixable, not dental-specific', () => {
    expect(classifyReason('medscheme', null, 'Authorisation number required for this procedure').category).toBe('fixable');
  });
});
