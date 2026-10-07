import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { loadSmsReplies, setSmsReplyHandled, sendSmsReplyAnswer, subscribeToSmsReplies } = vi.hoisted(() => ({
  loadSmsReplies: vi.fn(),
  setSmsReplyHandled: vi.fn(),
  sendSmsReplyAnswer: vi.fn(),
  subscribeToSmsReplies: vi.fn(() => () => {}),
}));

// No database, SMS gateway or icon CDN in unit tests; the formatting helpers stay real
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../services/communicationService', () => ({ communicationService: {}, getCommunicationErrorMessage: () => '' }));
vi.mock('../smsRepliesService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../smsRepliesService')>()),
  loadSmsReplies,
  setSmsReplyHandled,
  sendSmsReplyAnswer,
  subscribeToSmsReplies,
}));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { SmsRepliesInbox } from '../SmsRepliesInbox';
import type { SmsReply } from '../smsRepliesService';

const PRACTICE_ID = 'practice-1';

const reply = (overrides: Partial<SmsReply> = {}): SmsReply => ({
  id: 'reply-1',
  practiceId: PRACTICE_ID,
  patientId: 'patient-1',
  patientName: 'Maria Shikongo',
  visitId: 'visit-1',
  sourcePhone: '264811234567',
  message: 'Can I come at 11 instead?',
  originalMessage: 'Kalahari Medical: reminder for Fri 9 Oct at 10:30.',
  originalMessageType: 'appointment_reminder',
  intent: 'free_text',
  rating: null,
  actionTaken: 'Needs a person: the reply has no keyword the system acts on.',
  status: 'new',
  handledAt: null,
  handledByName: null,
  handledAutomatically: false,
  receivedAt: '2026-10-07T07:59:00.000Z',
  ...overrides,
});

const renderInbox = (onCount?: (count: number) => void) =>
  render(
    <MemoryRouter>
      <SmsRepliesInbox practiceId={PRACTICE_ID} onNeedsReplyCountChange={onCount} />
    </MemoryRouter>
  );

beforeEach(() => {
  loadSmsReplies.mockReset();
  setSmsReplyHandled.mockReset();
  sendSmsReplyAnswer.mockReset();
});

// Reception works this list between patients: it must say plainly what each patient wants, what the
// system already did, and let staff answer or close an item in one or two taps.
describe('SmsRepliesInbox', () => {
  it('says two-way SMS is not switched on yet instead of showing a database error', async () => {
    loadSmsReplies.mockResolvedValue({ state: 'not_enabled' });
    renderInbox();

    expect(await screen.findByText('Two-way SMS is not switched on yet')).toBeInTheDocument();
    expect(screen.queryByText(/Could not load/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Needs reply/ })).not.toBeInTheDocument();
  });

  it('shows who replied, what they answered, what it was about and what the system did', async () => {
    const onCount = vi.fn();
    loadSmsReplies.mockResolvedValue({
      state: 'ready',
      needsReplyCount: 1,
      replies: [
        reply(),
        reply({
          id: 'reply-2',
          patientId: null,
          patientName: null,
          sourcePhone: '264857654321',
          message: 'Ja',
          intent: 'confirm',
          status: 'handled',
          handledAutomatically: true,
          actionTaken: 'Appointment on Fri 9 Oct at 10:30 confirmed. Automatic answer sent.',
        }),
      ],
    });
    renderInbox(onCount);

    expect(await screen.findByRole('heading', { name: 'Maria Shikongo' })).toBeInTheDocument();
    expect(screen.getByText('Can I come at 11 instead?')).toBeInTheDocument();
    expect(screen.getAllByText(/In reply to \(appointment reminder\):/)).toHaveLength(2);
    expect(screen.getByText('Confirms appointment')).toBeInTheDocument();
    expect(screen.getByText(/Appointment on Fri 9 Oct at 10:30 confirmed/)).toBeInTheDocument();
    expect(screen.getByText('Handled automatically')).toBeInTheDocument();
    // An unknown sender is shown by number, readable
    expect(screen.getByRole('heading', { name: '+264 85 765 4321' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open patient/ })).toHaveAttribute('href', '/patients?patientId=patient-1');
    expect(loadSmsReplies).toHaveBeenCalledWith(PRACTICE_ID, 'needs_reply');
    expect(onCount).toHaveBeenCalledWith(1);
  });

  it('marks a reply handled and reloads the list', async () => {
    loadSmsReplies.mockResolvedValue({ state: 'ready', needsReplyCount: 1, replies: [reply()] });
    setSmsReplyHandled.mockResolvedValue({ ok: true });
    renderInbox();

    fireEvent.click(await screen.findByRole('button', { name: /Mark handled/ }));
    await waitFor(() => expect(setSmsReplyHandled).toHaveBeenCalledWith('reply-1', true));
    await waitFor(() => expect(loadSmsReplies).toHaveBeenCalledTimes(2));
  });

  it('sends a quick reply through the SMS service, and only once something is typed', async () => {
    loadSmsReplies.mockResolvedValue({ state: 'ready', needsReplyCount: 1, replies: [reply()] });
    sendSmsReplyAnswer.mockResolvedValue({ ok: true, markedHandled: true });
    renderInbox();

    fireEvent.click(await screen.findByRole('button', { name: /^Reply$/ }));
    const box = screen.getByLabelText('Reply to Maria Shikongo by SMS');
    const send = screen.getByRole('button', { name: /Send SMS/ });
    expect(send).toBeDisabled();
    expect(screen.getByText(/Goes to \+264 81 123 4567/)).toBeInTheDocument();

    fireEvent.change(box, { target: { value: 'Yes, 11:00 is fine.' } });
    expect(send).toBeEnabled();
    fireEvent.click(send);

    await waitFor(() => expect(sendSmsReplyAnswer).toHaveBeenCalledWith(expect.objectContaining({ id: 'reply-1' }), 'Yes, 11:00 is fine.'));
    await waitFor(() => expect(screen.queryByLabelText('Reply to Maria Shikongo by SMS')).not.toBeInTheDocument());
  });

  it('keeps the typed answer when sending fails, so staff can try again', async () => {
    loadSmsReplies.mockResolvedValue({ state: 'ready', needsReplyCount: 1, replies: [reply()] });
    sendSmsReplyAnswer.mockResolvedValue({ ok: false, message: 'SMS limit reached for this billing period.' });
    renderInbox();

    fireEvent.click(await screen.findByRole('button', { name: /^Reply$/ }));
    fireEvent.change(screen.getByLabelText('Reply to Maria Shikongo by SMS'), { target: { value: 'See you Friday' } });
    fireEvent.click(screen.getByRole('button', { name: /Send SMS/ }));

    await waitFor(() => expect(sendSmsReplyAnswer).toHaveBeenCalled());
    expect(screen.getByLabelText('Reply to Maria Shikongo by SMS')).toHaveValue('See you Friday');
  });

  it('switches between Needs reply, Handled and All', async () => {
    loadSmsReplies.mockResolvedValue({ state: 'ready', needsReplyCount: 0, replies: [] });
    renderInbox();

    expect(await screen.findByText('Nothing needs a reply')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Handled' }));
    await waitFor(() => expect(loadSmsReplies).toHaveBeenLastCalledWith(PRACTICE_ID, 'handled'));
    expect(screen.getByRole('button', { name: 'Handled' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('offers Try again when replies cannot be loaded', async () => {
    loadSmsReplies.mockResolvedValueOnce({ state: 'error', message: 'Network request failed' });
    loadSmsReplies.mockResolvedValue({ state: 'ready', needsReplyCount: 0, replies: [] });
    renderInbox();

    expect(await screen.findByText('Could not load SMS replies')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByText('Nothing needs a reply')).toBeInTheDocument();
  });
});
