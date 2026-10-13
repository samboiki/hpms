/**
 * The Notes section on the patient file: what each role sees and may do, the lock, the credit-control notes linked
 * (not copied), and opening the file at a note from the dashboard's follow-ups.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { PatientNote } from '../patientNotes';
import type { ContactNote } from '../../../../services/ledger/creditControl';

const auth = vi.hoisted(() => ({ user: { id: 'me', role: 'doctor' } as { id: string; role: string } }));
const service = vi.hoisted(() => ({
  loadPatientNotes: vi.fn(),
  loadCreditControlNotes: vi.fn(),
  saveNote: vi.fn(),
  isNotesNotSetUp: vi.fn(() => false),
  notesErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback),
  addAddendum: vi.fn(),
  changeFollowUp: vi.fn(),
  setFollowUpDone: vi.fn()
}));

vi.mock('../../../../stores/authStore', () => ({ useAuthStore: (selector: (state: { user: typeof auth.user }) => unknown) => selector({ user: auth.user }) }));
vi.mock('../../../../services/patientNotesService', () => service);
const staffList = vi.hoisted(() => ({
  value: [] as Array<{ id: string; full_name: string; role: string; is_active: boolean; hpcsa_number?: string | null }>
}));
vi.mock('../../../../services/invoiceContextService', () => ({ loadPracticeStaff: () => Promise.resolve(staffList.value) }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PatientNotesPanel } from '../PatientNotesPanel';

const note = (overrides: Partial<PatientNote>): PatientNote => ({
  id: 'n1',
  patientId: 'p1',
  type: 'general',
  header: 'Prefers mornings',
  body: 'Book before 10:00',
  followUpOn: null,
  followUpUserId: null,
  followUpDoneAt: null,
  followUpDoneBy: null,
  lockedAt: null,
  lockedBy: null,
  createdBy: 'me',
  createdAt: '2026-10-08T08:00:00+00:00',
  editedBy: null,
  editedAt: null,
  addenda: [],
  ...overrides
});

const scrollIntoView = vi.fn();
const onOpenAccount = vi.fn();
const onOpenEncounters = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'me', role: 'doctor' };
  staffList.value = [
    { id: 'me', full_name: 'Anna Shikongo', role: 'doctor', is_active: true },
    { id: 'rec', full_name: 'Rita Ndapewa', role: 'receptionist', is_active: true }
  ];
  service.isNotesNotSetUp.mockReturnValue(false);
  service.loadCreditControlNotes.mockResolvedValue([]);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

const renderPanel = (focusNoteId: string | null = null) =>
  render(<PatientNotesPanel practiceId="practice-1" patientId="p1" focusNoteId={focusNoteId} onOpenAccount={onOpenAccount} onOpenEncounters={onOpenEncounters} />);

describe('Notes on the patient file', () => {
  // A locked note is the record: the only ways to change it are a dated addendum or moving its follow-up
  it('offers an addendum on a locked note, never a change', async () => {
    service.loadPatientNotes.mockResolvedValue([note({ id: 'n1', type: 'clinical', header: 'Results discussed', lockedAt: '2026-10-08T09:00:00Z', lockedBy: 'me' })]);
    renderPanel();
    const card = (await screen.findByText('Results discussed')).closest('li') as HTMLElement;
    expect(within(card).getByText('Locked')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: /Add addendum/ })).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /^Change$/ })).toBeNull();
  });

  // Reception must not be able to write (or pick) a clinical note: the choice is not even offered
  it('gives reception no clinical choice when writing a note', async () => {
    auth.user = { id: 'rec', role: 'receptionist' };
    service.loadPatientNotes.mockResolvedValue([]);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Add note/ }));
    const kinds = within(screen.getByRole('group', { name: 'Kind of note' })).getAllByRole('radio').map(radio => radio.getAttribute('value'));
    expect(kinds).toEqual(['account', 'contact', 'general']);
    expect(screen.getByRole('radio', { name: /General/ })).toBeChecked();
  });

  // The owner-practitioner is often the administrator: with a registration number on their staff record they read
  // and write clinical notes like any practitioner; an administrator without one does not
  it('gives an administrator who is a registered practitioner the clinical notes', async () => {
    auth.user = { id: 'me', role: 'admin' };
    staffList.value = [{ id: 'me', full_name: 'Owner Practitioner', role: 'admin', is_active: true, hpcsa_number: 'MP 12345' }];
    service.loadPatientNotes.mockResolvedValue([note({ id: 'c1', type: 'clinical', header: 'Results discussed' })]);
    renderPanel();
    expect(await screen.findByText('Results discussed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Add note/ }));
    expect(screen.getByRole('radio', { name: /Clinical/ })).toBeChecked();
  });

  it('keeps clinical notes from an administrator without a registration number', async () => {
    auth.user = { id: 'me', role: 'admin' };
    staffList.value = [{ id: 'me', full_name: 'Office Manager', role: 'admin', is_active: true, hpcsa_number: null }];
    service.loadPatientNotes.mockResolvedValue([note({ id: 'c1', type: 'clinical', header: 'Results discussed' }), note({ id: 'g1', header: 'Prefers mornings' })]);
    renderPanel();
    expect(await screen.findByText('Prefers mornings')).toBeInTheDocument();
    expect(screen.queryByText('Results discussed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add note/ }));
    expect(screen.queryByRole('radio', { name: /Clinical/ })).toBeNull();
  });

  // A practitioner's note is clinical and locked unless they choose otherwise; the header may be left blank
  it('saves a practitioner\'s quick note as a locked clinical note', async () => {
    service.loadPatientNotes.mockResolvedValue([]);
    service.saveNote.mockResolvedValue('new-id');
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: /Add note/ }));
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Discussed the blood results; repeat in 3 months' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(service.saveNote).toHaveBeenCalledTimes(1));
    expect(service.saveNote).toHaveBeenCalledWith({
      noteId: null,
      patientId: 'p1',
      draft: expect.objectContaining({ type: 'clinical', lock: true, header: '', body: 'Discussed the blood results; repeat in 3 months', followUpOn: '' })
    });
  });

  // Credit-control notes stay in credit control: listed read-only, each opening the account where they are kept
  it('shows credit-control notes read-only, opening the account', async () => {
    auth.user = { id: 'rec', role: 'receptionist' };
    service.loadPatientNotes.mockResolvedValue([]);
    const credit: ContactNote = { id: 'c1', patientId: 'p1', channel: 'call', note: 'Promised to pay on Friday', createdBy: 'rec', createdAt: '2026-10-08T10:00:00+00:00' };
    service.loadCreditControlNotes.mockResolvedValue([credit]);
    renderPanel();
    const card = (await screen.findByText('Promised to pay on Friday')).closest('li') as HTMLElement;
    expect(within(card).getByText('Credit control')).toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Change|Add addendum/ })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: /Open account/ }));
    expect(onOpenAccount).toHaveBeenCalledTimes(1);
  });

  // From the dashboard's follow-ups the file opens at the note: shown even when older than the first three, in view
  // and outlined
  it('brings a note opened from a follow-up into view, outlined', async () => {
    service.loadPatientNotes.mockResolvedValue(
      ['a', 'b', 'c', 'd', 'target'].map((id, index) => note({ id, header: `Note ${id}`, createdAt: `2026-10-0${8 - index}T08:00:00+00:00` }))
    );
    renderPanel('target');
    const card = (await screen.findByText('Note target')).closest('li') as HTMLElement;
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    expect(card.className).toContain('ring-2');
    expect(card).toHaveFocus();
  });

  // Before the database has the notes tables, the file says so plainly and offers nothing that would fail
  it('says notes are not set up yet, with nothing to click', async () => {
    service.loadPatientNotes.mockRejectedValue(new Error('missing'));
    service.isNotesNotSetUp.mockReturnValue(true);
    renderPanel();
    expect(await screen.findByText('Patient notes are not set up in this database yet.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add note/ })).toBeNull();
  });

  // Switching patients quickly: a slow answer for the previous patient must never show on the next patient's file
  it('never shows the previous patient\'s notes on the next file', async () => {
    let finishFirst: (notes: PatientNote[]) => void = () => undefined;
    service.loadPatientNotes
      .mockImplementationOnce(() => new Promise<PatientNote[]>(resolve => { finishFirst = resolve; }))
      .mockResolvedValueOnce([note({ id: 'b1', patientId: 'p2', header: 'Second patient note' })]);
    const { rerender } = renderPanel();
    rerender(<PatientNotesPanel practiceId="practice-1" patientId="p2" onOpenAccount={onOpenAccount} onOpenEncounters={onOpenEncounters} />);
    expect(await screen.findByText('Second patient note')).toBeInTheDocument();
    await act(async () => {
      finishFirst([note({ id: 'a1', header: 'First patient note' })]);
    });
    expect(screen.queryByText('First patient note')).toBeNull();
    expect(screen.getByText('Second patient note')).toBeInTheDocument();
  });

  // Visit notes stay with the visits: the section links there instead of copying them
  it('links to the visit notes in Encounters', async () => {
    service.loadPatientNotes.mockResolvedValue([]);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Encounters' }));
    expect(onOpenEncounters).toHaveBeenCalledTimes(1);
  });
});
