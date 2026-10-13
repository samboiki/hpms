import { describe, expect, it } from 'vitest';
import {
  buildGeneralLetter,
  buildMergedLetter,
  buildReferralLetter,
  buildSickNote,
  formatLetterDate,
  validateGeneralLetter,
  validateReferral,
  type LetterContext,
  type ReferralInput
} from '../letters';

// Invented practice, practitioner and patient
const ctx: LetterContext = {
  practice: {
    name: 'Example Family Practice',
    address: '1 Example Street',
    city: 'Windhoek',
    country: 'Namibia',
    postalCode: null,
    contactPhone: '061 000 0000',
    contactEmail: 'reception@example.test',
    practiceNumber: '0000000',
    primaryColor: null
  },
  author: { name: 'Dr A Example', title: 'General practitioner', hpcnaNumber: 'MP 00000' },
  patient: { name: 'Ndapewa Shilongo', dateOfBirth: '1990-05-14', idNumber: '90051400123' },
  letterDate: '2026-10-07',
  visitDate: '2026-10-06',
  diagnosis: 'Uncontrolled hypertension I10',
  medicines: ['Amlodipine 10 mg, once daily'],
  allergies: ['Penicillin (severe: anaphylaxis)'],
  noKnownAllergies: false,
  problems: ['Essential (primary) hypertension (I10)']
};

const referral = (overrides: Partial<ReferralInput> = {}): ReferralInput => ({
  toName: 'Dr M Example',
  toPractice: 'Example Heart Clinic',
  toSpecialty: 'Cardiology',
  toEmail: '',
  urgency: 'routine',
  reason: 'Blood pressure not controlled on two medicines.',
  history: '',
  includeDiagnosis: true,
  includeMedicines: true,
  includeAllergies: true,
  includeProblems: true,
  validUntil: '',
  ...overrides
});

describe('formatLetterDate', () => {
  it('writes dates day first, as Namibian letters are dated', () => {
    expect(formatLetterDate('2026-10-07')).toBe('7 October 2026');
    expect(formatLetterDate('not a date')).toBe('');
  });
});

describe('buildReferralLetter', () => {
  it('addresses the colleague and states the reason, so the specialist knows why the patient came', () => {
    const letter = buildReferralLetter(referral(), ctx);
    expect(letter.salutation).toBe('Dear Dr M Example');
    expect(letter.recipientLines).toEqual(['Dr M Example', 'Cardiology', 'Example Heart Clinic']);
    expect(letter.subjectLine).toBe('Re: Ndapewa Shilongo (born 14 May 1990, ID 90051400123)');
    expect(letter.paragraphs).toEqual([
      'Thank you for seeing Ndapewa Shilongo, whom I saw on 6 October 2026.',
      'Reason for referral: Blood pressure not controlled on two medicines.'
    ]);
  });

  it('always carries the allergies and medicines when asked, because the receiving practitioner prescribes too', () => {
    const letter = buildReferralLetter(referral(), ctx);
    expect(letter.sections).toEqual([
      { heading: 'Working diagnosis', lines: ['Uncontrolled hypertension I10'] },
      { heading: 'Active problems', lines: ['Essential (primary) hypertension (I10)'] },
      { heading: 'Current medicines', lines: ['Amlodipine 10 mg, once daily'] },
      { heading: 'Allergies', lines: ['Penicillin (severe: anaphylaxis)'] }
    ]);
  });

  it('says "Allergies not recorded" rather than implying there are none', () => {
    const letter = buildReferralLetter(referral({ includeDiagnosis: false, includeProblems: false, includeMedicines: false }), { ...ctx, allergies: [] });
    expect(letter.sections).toEqual([{ heading: 'Allergies', lines: ['Allergies not recorded'] }]);
    const nka = buildReferralLetter(referral({ includeDiagnosis: false, includeProblems: false, includeMedicines: false }), { ...ctx, allergies: [], noKnownAllergies: true });
    expect(nka.sections[0].lines).toEqual(['No known allergies']);
  });

  it('keeps the diagnosis out of the email subject and body (emails pass through more hands than the letter)', () => {
    const letter = buildReferralLetter(referral(), ctx);
    expect(letter.email.subject).toBe('Referral: Ndapewa Shilongo');
    expect(letter.email.text).not.toMatch(/hypertension/i);
    expect(letter.email.html).not.toMatch(/hypertension/i);
  });

  it('notes urgency and validity when they are set', () => {
    const letter = buildReferralLetter(referral({ urgency: 'urgent', validUntil: '2027-01-07' }), ctx);
    expect(letter.paragraphs).toContain('Urgency: Urgent.');
    expect(letter.sections[letter.sections.length - 1]).toEqual({ heading: 'Referral valid until', lines: ['7 January 2027'] });
  });

  it('uses "Dear colleague" when the referral goes to a department rather than a named doctor', () => {
    expect(buildReferralLetter(referral({ toName: 'Physiotherapy department' }), ctx).salutation).toBe('Dear colleague');
  });

  it('names the file on the patient record and the PDF without spaces', () => {
    const letter = buildReferralLetter(referral(), ctx);
    expect(letter.recordTitle).toBe('Referral to Dr M Example (Cardiology)');
    expect(letter.fileName).toBe('referral-Ndapewa-Shilongo-2026-10-07.pdf');
  });
});

describe('validateReferral', () => {
  it('needs a recipient and a reason before a letter can be made', () => {
    expect(validateReferral(referral({ toName: ' ', reason: '' }), ctx.letterDate)).toEqual([
      'Who is the patient referred to?',
      'Give the reason for the referral.'
    ]);
  });

  it('refuses a validity date before the letter and an incomplete email address', () => {
    expect(validateReferral(referral({ validUntil: '2026-10-01', toEmail: 'dr@' }), ctx.letterDate)).toEqual([
      'The email address is not complete.',
      'The referral cannot expire before the date of the letter.'
    ]);
  });
});

describe('buildGeneralLetter', () => {
  it('keeps the paragraphs the practitioner typed and addresses "to whom it may concern" when nobody is named', () => {
    const letter = buildGeneralLetter({ toName: '', toEmail: '', subject: 'Fit to fly', body: 'First paragraph\nstill first.\n\nSecond.' }, ctx);
    expect(letter.salutation).toBe('To whom it may concern');
    expect(letter.paragraphs).toEqual(['First paragraph still first.', 'Second.']);
    expect(letter.recordTitle).toBe('Fit to fly');
  });

  it('needs a subject and a body', () => {
    expect(validateGeneralLetter({ toName: '', toEmail: '', subject: '', body: '' })).toEqual(['Give the letter a subject.', 'Write the letter.']);
  });
});

describe('buildSickNote', () => {
  it('counts the days inclusively and gives the day the patient may return', () => {
    const note = buildSickNote({ formNumber: '0042', fromDate: '2026-10-06', toDate: '2026-10-08', diagnosis: null, diagnosisCode: null }, ctx);
    expect(note.reference).toBe('No 0042');
    expect(note.paragraphs[1]).toBe(
      'In my opinion the patient is unfit for work or school from 6 October 2026 to 8 October 2026 inclusive (3 days), and may return on 9 October 2026.'
    );
  });

  it('shows no diagnosis unless the practitioner wrote one on the sick note (an employer is not entitled to it)', () => {
    const without = buildSickNote({ formNumber: null, fromDate: '2026-10-06', toDate: '2026-10-06', diagnosis: null, diagnosisCode: null }, ctx);
    expect(without.sections).toEqual([]);
    expect(JSON.stringify(without)).not.toMatch(/hypertension/i);
    const withDiagnosis = buildSickNote({ formNumber: null, fromDate: '2026-10-06', toDate: '2026-10-06', diagnosis: 'Influenza', diagnosisCode: 'J11.1' }, ctx);
    expect(withDiagnosis.sections[0].lines).toEqual(['Influenza (J11.1)']);
  });

  it("prints in the practice's own wording when it keeps a sick note template, keeping the number and the record title", () => {
    const wording = {
      title: 'CERTIFICATE OF ILLNESS',
      subject: '',
      greeting: 'To the employer',
      body: 'Ndapewa Shilongo was ill from 6 October 2026 to 8 October 2026.\n\nShe may return on 9 October 2026.',
      showsDiagnosis: false
    };
    const note = buildSickNote({ formNumber: '0042', fromDate: '2026-10-06', toDate: '2026-10-08', diagnosis: null, diagnosisCode: null }, ctx, wording);
    expect(note.title).toBe('CERTIFICATE OF ILLNESS');
    expect(note.salutation).toBe('To the employer');
    expect(note.subjectLine).toBe('');
    expect(note.paragraphs).toEqual(['Ndapewa Shilongo was ill from 6 October 2026 to 8 October 2026.', 'She may return on 9 October 2026.']);
    // Still the same sick note: its number, its file name and its line on the patient file
    expect(note.reference).toBe('No 0042');
    expect(note.recordTitle).toBe('Sick note, 3 days');
  });

  it('adds the diagnosis written on the sick note once: below a wording without it, never twice', () => {
    const input = { formNumber: null, fromDate: '2026-10-06', toDate: '2026-10-06', diagnosis: 'Influenza', diagnosisCode: null };
    const base = { title: 'MEDICAL CERTIFICATE', subject: 'Sick note', greeting: 'To whom it may concern' };
    expect(buildSickNote(input, ctx, { ...base, body: 'Unfit for work today.', showsDiagnosis: false }).sections).toHaveLength(1);
    expect(buildSickNote(input, ctx, { ...base, body: 'Unfit for work today with Influenza.', showsDiagnosis: true }).sections).toEqual([]);
  });
});

describe('buildMergedLetter', () => {
  const merged = {
    kind: 'letter' as const,
    name: 'Fit to return to work',
    title: 'MEDICAL CERTIFICATE',
    recipient: 'Ms N Shilongo\nPO Box 1, Windhoek',
    subject: 'Re: Ndapewa Shilongo',
    greeting: 'To whom it may concern',
    body: 'This is to certify that Ndapewa Shilongo\nwas seen on 6 October 2026.\n\nShe may return to work on 9 October 2026.'
  };

  it('prints the merged template on the letterhead, signed by the practitioner, one paragraph per blank line', () => {
    const letter = buildMergedLetter(merged, ctx);
    expect(letter.title).toBe('MEDICAL CERTIFICATE');
    expect(letter.recipientLines).toEqual(['Ms N Shilongo', 'PO Box 1, Windhoek']);
    expect(letter.paragraphs).toEqual(['This is to certify that Ndapewa Shilongo was seen on 6 October 2026.', 'She may return to work on 9 October 2026.']);
    expect(letter.signatureLines[0]).toBe('Dr A Example');
    expect(letter.dateText).toBe('7 October 2026');
  });

  it("keeps the template's name on the patient file and in the email, and no diagnosis in the email", () => {
    const letter = buildMergedLetter({ ...merged, body: 'Diagnosis: uncontrolled hypertension.' }, ctx);
    expect(letter.recordTitle).toBe('Fit to return to work');
    expect(letter.fileName).toBe('fit-to-return-to-work-Ndapewa-Shilongo-2026-10-07.pdf');
    expect(letter.email.subject).toBe('Fit to return to work: Ndapewa Shilongo');
    expect(`${letter.email.subject} ${letter.email.text}`).not.toMatch(/hypertension/i);
  });

  it('leaves out a subject line or greeting the template does not have', () => {
    const letter = buildMergedLetter({ ...merged, subject: '  ', greeting: '' }, ctx);
    expect(letter.subjectLine).toBe('');
    expect(letter.salutation).toBe('');
  });
});
