import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const service = vi.hoisted(() => ({ loadPrivateNotes: vi.fn(), savePrivateNote: vi.fn(), deletePrivateNote: vi.fn() }));
vi.mock('../../../../services/privateNotesService', async () => {
  const actual = await vi.importActual<typeof import('../../../../services/privateNotesService')>('../../../../services/privateNotesService');
  return { ...actual, ...service };
});
const staff = vi.hoisted(() => ({ loadPracticeStaff: vi.fn() }));
vi.mock('../../../../services/invoiceContextService', () => staff);
const auth = vi.hoisted(() => ({ user: { id: 'user-1', role: 'doctor' as string } }));
vi.mock('../../../../stores/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: auth.user }) }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { PrivateNotesPanel } from '../PrivateNotesPanel';

afterEach(() => cleanup());
beforeEach(() => {
  Object.values(service).forEach(fn => fn.mockReset());
  service.loadPrivateNotes.mockResolvedValue([]);
  service.savePrivateNote.mockResolvedValue('note-1');
  auth.user = { id: 'user-1', role: 'doctor' };
  staff.loadPracticeStaff.mockReset().mockResolvedValue([{ id: 'user-1', role: 'doctor', is_active: true, hpcsa_number: null }]);
});

describe('My private notes on the patient file', () => {
  it('tells the practitioner the notes are theirs alone, and saves a new one through the author-stamping function', async () => {
    render(<PrivateNotesPanel practiceId="practice-1" patientId="patient-1" />);
    expect(await screen.findByText(/Only you can read these/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add private note/ }));
    fireEvent.change(screen.getByLabelText('New private note'), { target: { value: 'Invented reminder' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(service.savePrivateNote).toHaveBeenCalledWith('patient-1', null, 'Invented reminder'));
  });

  it('stays out of the way of a receptionist, who keeps no private notes', async () => {
    auth.user = { id: 'user-2', role: 'receptionist' };
    staff.loadPracticeStaff.mockResolvedValue([{ id: 'user-2', role: 'receptionist', is_active: true, hpcsa_number: null }]);
    const { container } = render(<PrivateNotesPanel practiceId="practice-1" patientId="patient-1" />);
    await waitFor(() => expect(service.loadPrivateNotes).toHaveBeenCalled());
    await waitFor(() => expect(staff.loadPracticeStaff).toHaveBeenCalled());
    expect(container.textContent).toBe('');
  });

  it('counts an administrator with a practitioner registration number as a practitioner, as clinical notes do', async () => {
    auth.user = { id: 'user-3', role: 'admin' };
    staff.loadPracticeStaff.mockResolvedValue([{ id: 'user-3', role: 'admin', is_active: true, hpcsa_number: 'MP 00000' }]);
    render(<PrivateNotesPanel practiceId="practice-1" patientId="patient-1" />);
    expect(await screen.findByRole('button', { name: /Add private note/ })).toBeTruthy();
  });

  it("still shows a former practitioner's own notes, to read or delete, without letting them write new ones", async () => {
    auth.user = { id: 'user-2', role: 'receptionist' };
    staff.loadPracticeStaff.mockResolvedValue([{ id: 'user-2', role: 'receptionist', is_active: true, hpcsa_number: null }]);
    service.loadPrivateNotes.mockResolvedValue([{ id: 'n1', body: 'Invented old note', createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-01T08:00:00Z' }]);
    render(<PrivateNotesPanel practiceId="practice-1" patientId="patient-1" />);
    expect(await screen.findByText('Invented old note')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add private note/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Delete/ })).toBeTruthy();
  });
});
