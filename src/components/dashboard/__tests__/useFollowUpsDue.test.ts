/**
 * The data behind the dashboard's "To Dos": the follow-ups due, the number for the signed-in person, and what happens
 * when one is marked done or before the notes tables exist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { DueFollowUp } from '../../patients/notes/patientNotes';

const service = vi.hoisted(() => ({
  loadFollowUpsDue: vi.fn(),
  setFollowUpDone: vi.fn(),
  isNotesNotSetUp: vi.fn(() => false),
  notesErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback)
}));

vi.mock('../../../stores/authStore', () => ({ useAuthStore: (selector: (state: { user: { id: string } }) => unknown) => selector({ user: { id: 'me' } }) }));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../../../services/patientNotesService', () => service);
vi.mock('../../../services/invoiceContextService', () => ({ loadPracticeStaff: vi.fn().mockResolvedValue([]) }));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useFollowUpsDue } from '../useFollowUpsDue';

const windhoekToday = () => new Date(Date.now() + 120 * 60_000).toISOString().slice(0, 10);

const due = (noteId: string, followUpUserId: string | null): DueFollowUp => ({
  noteId,
  patientId: 'p1',
  patientName: 'Test Patient',
  type: 'general',
  header: 'Call back',
  followUpOn: windhoekToday(),
  followUpUserId
});

beforeEach(() => {
  vi.clearAllMocks();
  service.isNotesNotSetUp.mockReturnValue(false);
});

describe('the follow-ups behind To Dos', () => {
  // "Today" is the practice's day in Windhoek, and the number counts what this person should do (not colleagues')
  it('asks for what is due by the Windhoek day and counts my own and anyone\'s', async () => {
    service.loadFollowUpsDue.mockResolvedValue([due('mine', 'me'), due('anyone', null), due('colleague', 'other')]);
    const { result } = renderHook(() => useFollowUpsDue());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(service.loadFollowUpsDue).toHaveBeenCalledWith('practice-1', windhoekToday());
    expect(result.current.dueForMe).toBe(2);
    expect(result.current.items.map(item => item.noteId)).toEqual(['mine', 'anyone', 'colleague']);
  });

  // Done is done for everyone: it leaves the list at once and the number drops
  it('takes a follow-up off the list once it is marked done', async () => {
    service.loadFollowUpsDue.mockResolvedValue([due('mine', 'me'), due('anyone', null)]);
    service.setFollowUpDone.mockResolvedValue(undefined);
    const { result } = renderHook(() => useFollowUpsDue());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(() => result.current.markDone('mine'));
    expect(service.setFollowUpDone).toHaveBeenCalledWith('mine', true);
    expect(result.current.items.map(item => item.noteId)).toEqual(['anyone']);
    expect(result.current.dueForMe).toBe(1);
  });

  // Before the notes tables exist the dashboard must not show an error: To Dos says it is not set up
  it('reports "not set up" instead of an error before the notes tables exist', async () => {
    service.loadFollowUpsDue.mockRejectedValue(new Error('missing'));
    service.isNotesNotSetUp.mockReturnValue(true);
    const { result } = renderHook(() => useFollowUpsDue());
    await waitFor(() => expect(result.current.status).toBe('not_set_up'));
    expect(result.current.error).toBeNull();
  });
});
