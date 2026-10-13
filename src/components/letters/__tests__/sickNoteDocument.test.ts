/**
 * The visit's sick note in the practice's own wording (its sick note template): still the one sick note of the visit
 * (leave_forms), with this note's days, and only the diagnosis written on the sick note (an employer is not entitled
 * to the visit's). Nothing is read from a database here.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../services/patientLettersService', () => ({ loadLetterContext: vi.fn() }));
vi.mock('../../../services/letterTemplatesService', () => ({ loadSickNoteTemplate: vi.fn() }));

import { sickNoteWording } from '../sickNoteDocument';
import type { LetterTemplate } from '../../../utils/templates/letterTemplates';

const template: LetterTemplate = {
  id: 'sick-1',
  kind: 'sick_note',
  name: 'Sick note',
  title: 'MEDICAL CERTIFICATE',
  recipient: '',
  subject: 'Sick note no {{sickNoteNumber}}',
  greeting: 'To whom it may concern',
  body: '{{patientName}} (ID {{patientIdNumber}}) is unfit for work from {{sickNoteFrom}} to {{sickNoteTo}} ({{daysOff}}). Diagnosis: {{diagnosis}}.',
  updatedAt: null
};

// Invented record values, as loadLetterContext reads them for the visit (another note of the visit: 5 days)
const record = { patientName: 'Ndapewa Shilongo', patientIdNumber: null, sickNoteFrom: '1 October 2026', daysOff: '5 days', diagnosis: 'Hypertension I10' };

describe('sickNoteWording', () => {
  it("fills this note's own days, never another sick note's of the same visit", () => {
    const wording = sickNoteWording(template, { formNumber: '0042', fromDate: '2026-10-06', toDate: '2026-10-08', diagnosis: null, diagnosisCode: null }, record);
    expect(wording.subject).toBe('Sick note no 0042');
    expect(wording.body).toContain('from 6 October 2026 to 8 October 2026 (3 days)');
  });

  it("shows only the diagnosis written on the sick note, never the visit's", () => {
    const without = sickNoteWording(template, { formNumber: null, fromDate: '2026-10-06', toDate: '2026-10-06', diagnosis: null, diagnosisCode: null }, record);
    expect(without.body).not.toMatch(/Hypertension/);
    const withNote = sickNoteWording(template, { formNumber: null, fromDate: '2026-10-06', toDate: '2026-10-06', diagnosis: 'Influenza', diagnosisCode: 'J11.1' }, record);
    expect(withNote.body).toContain('Diagnosis: Influenza (J11.1).');
    expect(withNote.showsDiagnosis).toBe(true);
  });

  it('leaves out what the file does not hold, since the note prints straight from the visit', () => {
    const wording = sickNoteWording(template, { formNumber: null, fromDate: '2026-10-06', toDate: '2026-10-06', diagnosis: null, diagnosisCode: null }, record);
    expect(wording.body).not.toContain('{{');
    // No "(ID )" for a file without an ID number
    expect(wording.body.startsWith('Ndapewa Shilongo is unfit for work')).toBe(true);
    expect(wording.subject).toBe('Sick note no');
  });
});
