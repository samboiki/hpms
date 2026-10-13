import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// An invented referral letter and sick note, each written from a visit
vi.mock('../../../services/patientLettersService', () => {
  class LettersNotSetUpError extends Error {}
  return {
    LettersNotSetUpError,
    listLetters: vi.fn(async () => [
      {
        id: 'letter-1',
        patientId: 'patient-1',
        visitId: 'visit-1',
        kind: 'referral',
        templateId: null,
        title: 'Referral letter',
        recipientName: null,
        recipientEmail: null,
        letterDate: '2026-10-06',
        validUntil: null,
        document: {},
        authorName: 'Example Practitioner',
        sentAt: null,
        sentTo: null,
        createdAt: '2026-10-06T08:00:00Z'
      }
    ]),
    listSickNotes: vi.fn(async () => [
      {
        id: 'note-1',
        visitId: 'visit-2',
        formNumber: '12',
        status: 'issued',
        fromDate: '2026-10-07',
        toDate: '2026-10-08',
        diagnosis: null,
        diagnosisCode: null,
        issueDate: '2026-10-07',
        doctorId: null,
        createdAt: '2026-10-07T08:00:00Z'
      }
    ])
  };
});
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'user-1' } }) }));
vi.mock('../LetterActions', () => ({ LetterActions: () => <span>Print or email</span> }));
vi.mock('../LetterComposer', () => ({ LetterComposer: () => null }));

import { VisitLettersPanel } from '../VisitLettersPanel';

afterEach(cleanup);

describe('letters and sick notes on the patient file', () => {
  // The rows knew their visit but did not link to it; the visit opens on its Letters tab, where they were written
  it('open the visit each one was written from', async () => {
    const onOpenVisit = vi.fn();
    render(<VisitLettersPanel practiceId="practice-1" patientId="patient-1" visitId={null} includeSickNotes onOpenVisit={onOpenVisit} />);
    expect(await screen.findByText('Referral letter')).toBeInTheDocument();
    const buttons = await screen.findAllByRole('button', { name: 'Open the visit' });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(onOpenVisit.mock.calls).toEqual([['visit-1'], ['visit-2']]);
  });

  it('on a visit itself there is no link to the visit', async () => {
    render(<VisitLettersPanel practiceId="practice-1" patientId="patient-1" visitId="visit-1" onOpenVisit={vi.fn()} />);
    expect(await screen.findByText('Referral letter')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open the visit' })).toBeNull();
  });
});
