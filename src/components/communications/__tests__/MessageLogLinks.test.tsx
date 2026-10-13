import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MessageLogEntry } from '../messageLog';

// One invented appointment reminder, sent for a booking
const ENTRY: MessageLogEntry = {
  key: 'sms-1',
  id: '1',
  channel: 'sms',
  at: '2026-10-12T08:00:00Z',
  to: '+264811234567',
  recipientName: null,
  patientId: 'patient-1',
  summary: 'Reminder: your appointment tomorrow at 09:30',
  what: 'Appointment reminder',
  outcome: 'delivered',
  failureReason: null,
  invoiceId: null,
  visitId: 'visit-1',
  attachments: []
};
vi.mock('../messageLogService', () => ({
  loadMessageLog: vi.fn(async () => ({ entries: [ENTRY], more: false, patientNames: { 'patient-1': 'Example Patient' }, incomplete: false })),
  loadMessageBody: vi.fn(async () => ({ text: 'Reminder: your appointment tomorrow at 09:30', failureReason: null }))
}));
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { first_name: 'Example', last_name: 'Patient' }, error: null }) }) }) }) }
}));

import { MessageLogPanel } from '../MessageLogPanel';

afterEach(cleanup);

describe('the Message log links to what a message was about', () => {
  // A reminder or letter sent for a visit named no way to that visit
  it("a message sent for a booking opens that visit, and one patient's log leads back to their file", async () => {
    render(
      <MemoryRouter>
        <MessageLogPanel practiceId="practice-1" patientId="patient-1" onClearPatient={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { expanded: false, name: /Reminder: your appointment/ }));
    expect(await screen.findByRole('link', { name: 'Visit' })).toHaveAttribute(
      'href',
      '/patients?patientId=patient-1&tab=encounters&visitId=visit-1&action=edit-visit'
    );
    // Opened from a patient's file: the way back is a link, not only the browser's Back
    expect(screen.getByRole('link', { name: 'Patient file' })).toHaveAttribute('href', '/patients?patientId=patient-1&tab=overview');
  });
});
