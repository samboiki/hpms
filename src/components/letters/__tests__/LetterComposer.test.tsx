import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LoadedLetterContext } from '../../../services/patientLettersService';

const lettersService = vi.hoisted(() => ({
  loadLetterContext: vi.fn(),
  createLetter: vi.fn(),
  emailLetter: vi.fn()
}));
const { NotKept } = vi.hoisted(() => ({ NotKept: class NotKept extends Error {} }));

vi.mock('../../../services/patientLettersService', () => ({
  ...lettersService,
  LettersNotSetUpError: NotKept,
  isEmailAddress: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}));
const pdf = vi.hoisted(() => ({ openLetterPdf: vi.fn() }));
vi.mock('../letterPdf', () => pdf);
// The practice's letter templates (never read from a real database in tests)
const templatesService = vi.hoisted(() => ({ loadLetterTemplates: vi.fn() }));
vi.mock('../../../services/letterTemplatesService', () => templatesService);
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'user-1', practice_id: 'practice-1' } }) }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { LetterComposer } from '../LetterComposer';

// Invented practice, practitioner and patient
const loaded: LoadedLetterContext = {
  context: {
    practice: { name: 'Example Family Practice', address: null, city: 'Windhoek', country: 'Namibia', postalCode: null, contactPhone: null, contactEmail: null, practiceNumber: null, primaryColor: null },
    author: { name: 'Dr A Example', title: null, hpcnaNumber: null },
    patient: { name: 'Ndapewa Shilongo', dateOfBirth: '1990-05-14', idNumber: null },
    letterDate: '2026-10-07',
    visitDate: '2026-10-07',
    diagnosis: 'Hypertension I10',
    medicines: ['Amlodipine 10 mg, once daily'],
    allergies: ['Penicillin (severe)'],
    noKnownAllergies: false,
    problems: []
  },
  patientEmail: 'patient@example.test',
  merge: { patientName: 'Ndapewa Shilongo', patientFormalName: 'Ms N Shilongo', visitDate: '7 October 2026', practiceName: 'Example Family Practice' }
};

// An invented practice template: the return date is not on file for this visit, so the letter asks for it
const fitToReturn = {
  id: 'template-1',
  kind: 'certificate' as const,
  name: 'Fit to return to work',
  title: 'MEDICAL CERTIFICATE',
  recipient: '',
  subject: 'Re: {{patientName}}',
  greeting: 'To whom it may concern',
  body: 'I saw {{patientName}} on {{visitDate}}. Fit to return on {{returnDate}}.',
  updatedAt: null
};

afterEach(() => cleanup());
beforeEach(() => {
  Object.values(lettersService).forEach(fn => fn.mockReset());
  pdf.openLetterPdf.mockReset();
  lettersService.loadLetterContext.mockResolvedValue(loaded);
  templatesService.loadLetterTemplates.mockReset();
  templatesService.loadLetterTemplates.mockResolvedValue([fitToReturn, { ...fitToReturn, id: 'template-2', kind: 'sick_note', name: 'Sick note' }]);
});

const writeReferral = async () => {
  render(<LetterComposer open onClose={vi.fn()} practiceId="practice-1" patientId="patient-1" visitId="visit-1" />);
  fireEvent.change(await screen.findByLabelText('Refer to'), { target: { value: 'Dr M Example' } });
  fireEvent.change(screen.getByLabelText(/Their email/), { target: { value: 'specialist@example.test' } });
  fireEvent.change(screen.getByLabelText('Reason for referral'), { target: { value: 'Blood pressure not controlled.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Make letter' }));
};

describe('LetterComposer', () => {
  it('will not make a referral without a recipient and a reason', async () => {
    render(<LetterComposer open onClose={vi.fn()} practiceId="practice-1" patientId="patient-1" visitId="visit-1" />);
    await screen.findByLabelText('Refer to');
    fireEvent.click(screen.getByRole('button', { name: 'Make letter' }));
    expect(await screen.findByText('Who is the patient referred to?')).toBeInTheDocument();
    expect(lettersService.createLetter).not.toHaveBeenCalled();
  });

  it('keeps the referral on the patient file with the visit, then prints it on the letterhead', async () => {
    lettersService.createLetter.mockImplementation(async (input: { document: unknown }) => ({ id: 'letter-1', document: input.document }));
    await writeReferral();
    expect(await screen.findByText('Referral letter ready')).toBeInTheDocument();
    const saved = lettersService.createLetter.mock.calls[0][0];
    expect(saved).toMatchObject({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1', kind: 'referral', recipientEmail: 'specialist@example.test' });
    expect(saved.document.paragraphs).toContain('Reason for referral: Blood pressure not controlled.');
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(pdf.openLetterPdf).toHaveBeenCalledWith(saved.document));
  });

  it('emails the letter to the specialist by default, through the practice email gateway', async () => {
    lettersService.createLetter.mockImplementation(async (input: { document: unknown }) => ({ id: 'letter-1', document: input.document }));
    lettersService.emailLetter.mockResolvedValue({ ok: true, message: 'Emailed to specialist@example.test.' });
    await writeReferral();
    fireEvent.click(await screen.findByRole('button', { name: 'Email' }));
    expect(screen.getByLabelText('Send to')).toHaveValue('specialist@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(lettersService.emailLetter).toHaveBeenCalledWith(expect.objectContaining({ to: 'specialist@example.test', letterId: 'letter-1', patientId: 'patient-1' }))
    );
  });

  it('still lets the letter be printed before letters are kept on the file, and says so', async () => {
    lettersService.createLetter.mockRejectedValue(new NotKept('not set up'));
    await writeReferral();
    // Plain words: no update or file name a practice cannot act on
    expect(await screen.findByText(/not kept on the patient file yet \(OneHealth support switches this on\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeEnabled();
  });

  // C15: a practice's certificate is filled in from the file and the visit; what the file does not hold is asked for,
  // never printed blank, and the letter kept on the file names its template
  it('makes a letter from a template, asking only for what the file does not hold', async () => {
    lettersService.createLetter.mockImplementation(async (input: { document: unknown }) => ({ id: 'letter-2', document: input.document }));
    render(<LetterComposer open onClose={vi.fn()} practiceId="practice-1" patientId="patient-1" visitId="visit-1" initialKind="template" />);
    const select = await screen.findByLabelText('Template');
    // The sick note template is made on the visit's Sick note tab, never here (one sick note, no second copy)
    expect(screen.queryByRole('option', { name: /Sick note/ })).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'template-1' } });
    expect(screen.getByLabelText('Letter')).toHaveValue('I saw Ndapewa Shilongo on 7 October 2026. Fit to return on {{returnDate}}.');

    fireEvent.click(screen.getByRole('button', { name: 'Make letter' }));
    expect(await screen.findByText(/Fill in back at work or school on before making the letter/)).toBeInTheDocument();
    expect(lettersService.createLetter).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Back at work or school on'), { target: { value: '9 October 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make letter' }));
    await screen.findByText('Letter ready');
    const saved = lettersService.createLetter.mock.calls[0][0];
    expect(saved).toMatchObject({ templateId: 'template-1', kind: 'letter', visitId: 'visit-1' });
    expect(saved.document.title).toBe('MEDICAL CERTIFICATE');
    expect(saved.document.subjectLine).toBe('Re: Ndapewa Shilongo');
    expect(saved.document.paragraphs).toEqual(['I saw Ndapewa Shilongo on 7 October 2026. Fit to return on 9 October 2026.']);
    expect(saved.document.recordTitle).toBe('Fit to return to work');
  });
});
