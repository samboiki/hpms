import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LetterDocument } from '../../../utils/clinical/letters';

const { openLetterPdf, emailLetter } = vi.hoisted(() => ({ openLetterPdf: vi.fn(), emailLetter: vi.fn() }));
vi.mock('../letterPdf', () => ({ openLetterPdf }));
vi.mock('../../../services/patientLettersService', () => ({ emailLetter, isEmailAddress: () => true }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { LetterActions } from '../LetterActions';

const letter = { title: 'REFERRAL LETTER' } as unknown as LetterDocument;
const renderActions = (onPrint?: () => Promise<void>) => {
  const getDocument = vi.fn(async () => letter);
  render(<LetterActions getDocument={getDocument} practiceId="practice-1" patientId="patient-1" visitId="visit-1" onPrint={onPrint} />);
  return getDocument;
};

describe('LetterActions: Print', () => {
  // A letter (a referral, a general letter) prints in the letters layout
  it('prints the letter itself when nothing else is given', async () => {
    const getDocument = renderActions();
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(openLetterPdf).toHaveBeenCalledWith(letter));
    expect(getDocument).toHaveBeenCalledTimes(1);
  });

  // An issued sick note prints the owner's own leave form (owner, 15 Oct 2026), not the letter
  it('prints what the screen hands it instead of the letter', async () => {
    openLetterPdf.mockClear();
    const onPrint = vi.fn(async () => undefined);
    const getDocument = renderActions(onPrint);
    fireEvent.click(screen.getByRole('button', { name: 'Print' }));
    await waitFor(() => expect(onPrint).toHaveBeenCalledTimes(1));
    expect(openLetterPdf).not.toHaveBeenCalled();
    expect(getDocument).not.toHaveBeenCalled();
  });
});

describe('LetterActions: Email', () => {
  const send = async (emailPdf?: () => Promise<string>) => {
    emailLetter.mockReset();
    emailLetter.mockResolvedValue({ ok: true, message: 'Emailed to employer@example.test.' });
    const getDocument = vi.fn(async () => letter);
    render(<LetterActions getDocument={getDocument} practiceId="practice-1" patientId="patient-1" visitId="visit-1" emailPdf={emailPdf} />);
    fireEvent.click(screen.getByRole('button', { name: 'Email' }));
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: 'employer@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(emailLetter).toHaveBeenCalledTimes(1));
    return emailLetter.mock.calls[0][0];
  };

  // An emailed sick note is the owner's leave form, the same as the printed one (owner, 15 Oct 2026)
  it('attaches the PDF the screen hands it, with the letter as the message', async () => {
    const request = await send(async () => 'TEVBVkUgRk9STQ==');
    expect(request).toMatchObject({ document: letter, to: 'employer@example.test', pdfBase64: 'TEVBVkUgRk9STQ==' });
  });

  it("attaches the letter's own PDF otherwise", async () => {
    const request = await send();
    expect(request.pdfBase64).toBeUndefined();
  });
});
