import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LoadedLetterContext } from '../../../services/patientLettersService';

const letters = vi.hoisted(() => ({ loadLetterContext: vi.fn() }));
vi.mock('../../../services/patientLettersService', () => letters);
const templatesService = vi.hoisted(() => ({ loadLetterTemplates: vi.fn() }));
vi.mock('../../../services/letterTemplatesService', () => templatesService);
const consents = vi.hoisted(() => ({ recordConsent: vi.fn(), loadVisitPractitionerName: vi.fn() }));
const { NotSetUp } = vi.hoisted(() => ({ NotSetUp: class NotSetUp extends Error {} }));
vi.mock('../../../services/patientConsentsService', () => ({ ...consents, ConsentsNotSetUpError: NotSetUp }));
vi.mock('../../letters/letterPdf', () => ({ openPdf: vi.fn(), renderLetterPdf: vi.fn() }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'user-1', practice_id: 'practice-1' } }) }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// Icons load their drawings later; the tests do not need them
vi.mock('@iconify/react', () => ({ Icon: () => null }));
// jsdom cannot draw on a canvas: a stand-in pad "signs" with one tap
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
vi.mock('../SignaturePad', () => ({
  SignaturePad: ({ onChange }: { onChange: (image: string | null) => void }) => (
    <button type="button" onClick={() => onChange(PNG)}>
      Sign (stand-in pad)
    </button>
  )
}));

import { ConsentDialog } from '../ConsentDialog';

// Invented practice, practitioner and patient
const loaded: LoadedLetterContext = {
  context: {
    practice: { name: 'Example Family Practice', address: null, city: 'Windhoek', country: 'Namibia', postalCode: null, contactPhone: null, contactEmail: null, practiceNumber: null, primaryColor: null },
    author: { name: 'Sister B Example', title: 'Nurse', hpcnaNumber: null },
    patient: { name: 'Maria Example', dateOfBirth: '1990-05-14', idNumber: null },
    letterDate: '2026-10-13'
  },
  patientEmail: null,
  merge: { patientName: 'Maria Example', practiceName: 'Example Family Practice', practitionerName: 'Sister B Example' }
};

const procedureConsent = {
  id: 'template-1',
  kind: 'consent' as const,
  name: 'Consent to a procedure',
  title: 'CONSENT TO A PROCEDURE',
  recipient: '',
  subject: 'Patient: {{patientName}}',
  greeting: '',
  body: 'I consent to {{procedure}} for {{patientName}}, explained by {{practitionerName}}.',
  updatedAt: null
};

afterEach(() => cleanup());
beforeEach(() => {
  letters.loadLetterContext.mockReset().mockResolvedValue(loaded);
  templatesService.loadLetterTemplates.mockReset().mockResolvedValue([
    procedureConsent,
    { ...procedureConsent, id: 'template-2', kind: 'certificate', name: 'Attendance certificate' }
  ]);
  consents.recordConsent.mockReset().mockResolvedValue('consent-1');
  consents.loadVisitPractitionerName.mockReset().mockResolvedValue('Dr A Example');
});

const open = () => render(<ConsentDialog open onClose={vi.fn()} practiceId="practice-1" patientId="patient-1" visitId="visit-1" />);

describe('getting consent signed on the screen', () => {
  it('offers only consent forms, and names the visit practitioner who treats (the signed-in nurse witnesses)', async () => {
    open();
    const select = await screen.findByLabelText('Consent form');
    expect(Array.from((select as HTMLSelectElement).options).map(option => option.text)).toEqual(['Choose a consent form...', 'Consent to a procedure']);
    fireEvent.change(select, { target: { value: 'template-1' } });
    expect((screen.getByLabelText('Practitioner who treats') as HTMLInputElement).value).toBe('Dr A Example');
  });

  it('asks for the procedure before the patient can sign, so nobody signs a form with a blank', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Consent form'), { target: { value: 'template-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to signing' }));
    expect(await screen.findByText('Fill in procedure or treatment first.')).toBeTruthy();
    expect(screen.queryByText('Sign (stand-in pad)')).toBeNull();
  });

  it('keeps the form only once it is signed, with the signature, who signed, the visit and the template', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Consent form'), { target: { value: 'template-1' } });
    fireEvent.change(screen.getByLabelText('Procedure or treatment'), { target: { value: 'removal of a skin lesion' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to signing' }));
    const save = await screen.findByRole('button', { name: 'Save signed form' });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText('Sign (stand-in pad)'));
    fireEvent.click(save);
    await waitFor(() => expect(consents.recordConsent).toHaveBeenCalledTimes(1));
    const kept = consents.recordConsent.mock.calls[0][0];
    expect(kept).toMatchObject({ practiceId: 'practice-1', patientId: 'patient-1', visitId: 'visit-1', templateId: 'template-1', signedBy: 'patient', signerName: 'Maria Example' });
    expect(kept.document.signatureImage).toBe(PNG);
    expect(kept.document.paragraphs[0]).toBe('I consent to removal of a skin lesion for Maria Example, explained by Dr A Example.');
    expect(kept.document.signatureLines[0]).toBe('Maria Example');
    expect(kept.document.signatureLines[3]).toBe('Witness: Sister B Example, Nurse');
    expect(await screen.findByText('Consent form signed')).toBeTruthy();
  });

  it('asks for the name of a parent or guardian who signs for the patient', async () => {
    open();
    fireEvent.change(await screen.findByLabelText('Consent form'), { target: { value: 'template-1' } });
    fireEvent.change(screen.getByLabelText('Procedure or treatment'), { target: { value: 'stitches' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to signing' }));
    fireEvent.click(await screen.findByRole('radio', { name: 'A parent or guardian' }));
    fireEvent.click(screen.getByText('Sign (stand-in pad)'));
    fireEvent.click(screen.getByRole('button', { name: 'Save signed form' }));
    expect(await screen.findByText('Give the name of the person who signs.')).toBeTruthy();
    expect(consents.recordConsent).not.toHaveBeenCalled();
  });
});
