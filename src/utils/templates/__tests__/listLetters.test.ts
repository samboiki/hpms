import { describe, expect, it } from 'vitest';
import { LETTER_TEMPLATE_EXAMPLES } from '../letterTemplates';
import { mergeLetterParts, missingReason, planListLetters } from '../listLetters';

// Invented patients and practice
const recall = LETTER_TEMPLATE_EXAMPLES.find(example => example.kind === 'recall');
if (!recall) throw new Error('The recall example is missing');

const shared = { practiceName: 'Example Family Practice', practicePhone: '061 000 000', today: '12 October 2026', practitionerName: 'Dr A Example' };

describe('planListLetters (a recall letter for everyone on a list)', () => {
  it('merges one letter per patient with their own name and last visit', () => {
    const { letters, skipped } = planListLetters(
      recall,
      [{ patientId: 'p1', name: 'Maria Testing', values: { patientFormalName: 'Mrs M Testing', lastVisitDate: '3 March 2026' } }],
      shared
    );
    expect(skipped).toEqual([]);
    expect(letters[0].parts.greeting).toBe('Dear Mrs M Testing');
    expect(letters[0].parts.recipient).toBe('Mrs M Testing');
    expect(letters[0].parts.body).toContain('your last visit to Example Family Practice was on 3 March 2026');
  });

  // A letter with a gap ("your last visit was on .") is worse than no letter: the patient is left out and the review says why
  it('leaves out a patient whose letter would have a gap, and says why in plain words', () => {
    const { letters, skipped } = planListLetters(recall, [{ patientId: 'p2', name: 'Kim Testing', values: { patientFormalName: 'Kim Testing' } }], shared);
    expect(letters).toEqual([]);
    expect(skipped).toEqual([{ patientId: 'p2', name: 'Kim Testing', reason: 'no completed visit' }]);
  });

  it("lets a patient's own value win over the shared one, and lists each reason once", () => {
    const template = { ...recall, body: '{{patientAddress}} {{patientAge}} {{patientDateOfBirth}}' };
    const { skipped } = planListLetters(template, [{ patientId: 'p3', name: 'Ana Testing', values: { patientFormalName: 'Ms A Testing' } }], shared);
    expect(skipped[0].reason).toBe('no postal address on file; no date of birth on file');
  });
});

describe('mergeLetterParts', () => {
  it('fills every part of the letter and lists what is still missing', () => {
    const { parts, missing } = mergeLetterParts({ title: 'RECALL', recipient: '{{patientName}}', subject: '', greeting: 'Dear {{patientName}}', body: 'See you on {{appointmentDate}}.' }, { patientName: 'Maria Testing' });
    expect(parts.greeting).toBe('Dear Maria Testing');
    expect(missing).toEqual(['appointmentDate']);
  });

  it('describes a missing field it has no special words for', () => {
    expect(missingReason('visitDate')).toBe('no visit date on file');
  });
});
