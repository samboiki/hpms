import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
// The real gateway is never called in tests
vi.mock('../../../../services/communicationService', () => ({
  communicationService: { sendSMS: vi.fn() },
  getCommunicationErrorMessage: (_channel: string, error?: string) => error ?? 'Failed to send SMS'
}));

import { supabase } from '../../../../lib/supabase';
import { communicationService } from '../../../../services/communicationService';
import { ASKED_FOR_NO_SMS_MESSAGE, sendWaitingListOffer } from '../../../../services/waitingListService';
import { OFFER_SMS_TYPE, type WaitingListEntry } from '../../../../utils/diary/waitingList';
import { FreeTimeRow } from '../WaitingListParts';

// Invented patient and practice
const entry = (smsOptOut: boolean): WaitingListEntry => ({
  id: 'w1',
  patient: { id: 'p1', firstName: 'Maria', lastName: 'Example', cellNumber: '0810000001', smsOptOut },
  practitionerId: 'pr-a',
  appointmentTypeId: null,
  lengthMinutes: 15,
  days: [],
  from: null,
  to: null,
  until: '2026-10-31',
  current: null,
  note: null,
  status: 'waiting',
  offer: null,
  bookedVisitId: null,
  createdAt: '2026-10-01T08:00:00Z'
});
const slot = { practitionerId: 'pr-a', date: '2026-10-14', time: '10:30', lengthMinutes: 30 };
const send = (smsOptOut: boolean) => sendWaitingListOffer({ practiceId: 'practice-1', entry: entry(smsOptOut), slot, message: 'An earlier time came free' });

const sendSMS = vi.mocked(communicationService.sendSMS);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as never);
});

// A patient who replied STOP asked for no SMS: an offer of an earlier time must never reach them by SMS
describe('offering a time by SMS to a patient who asked for no SMS', () => {
  it('never reaches the gateway for a patient who replied STOP', async () => {
    expect(await send(true)).toEqual({ ok: false, message: ASKED_FOR_NO_SMS_MESSAGE });
    expect(sendSMS).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('is sent as a waitlist offer, the type the gateway refuses to a number that replied STOP', async () => {
    sendSMS.mockResolvedValue({ success: true, logId: 'log-1' } as never);
    expect(await send(false)).toEqual({ ok: true, recorded: true });
    expect(sendSMS).toHaveBeenCalledWith(expect.objectContaining({ messageType: OFFER_SMS_TYPE, recipientPhone: '+264810000001' }));
  });

  it('says so in plain words when the gateway refuses the number (it replied STOP from another patient file), and notes no offer', async () => {
    sendSMS.mockResolvedValue({
      success: false,
      error: 'Not sent: this patient replied STOP to opt out of non-essential SMS. Appointment, results and other essential messages can still be sent.'
    } as never);
    expect(await send(false)).toEqual({ ok: false, message: ASKED_FOR_NO_SMS_MESSAGE });
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe('a free time for a waiting patient', () => {
  const renderRow = (smsOffer: 'can_offer' | 'asked_for_no_sms' | 'no_cell_number') =>
    render(
      <ul>
        <FreeTimeRow slot={slot} practitionerLabel={() => 'Dr A Example'} smsOffer={smsOffer} onOffer={vi.fn()} onBook={vi.fn()} />
      </ul>
    );

  it('shows "Asked for no SMS" in place of Offer by SMS for a patient who replied STOP, and can still be booked', () => {
    renderRow('asked_for_no_sms');
    expect(screen.getByText('Asked for no SMS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Offer by SMS/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Book/ })).toBeEnabled();
  });

  it('offers by SMS otherwise, and only with a number that can take one', () => {
    renderRow('can_offer');
    expect(screen.getByRole('button', { name: /Offer by SMS/ })).toBeEnabled();
    expect(screen.queryByText('Asked for no SMS')).not.toBeInTheDocument();
  });

  it('keeps Offer by SMS but unavailable without a number', () => {
    renderRow('no_cell_number');
    expect(screen.getByRole('button', { name: /Offer by SMS/ })).toBeDisabled();
  });
});
