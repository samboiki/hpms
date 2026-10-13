import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StaffPortalRequest } from '../portalRequestsService';

// An invented request from the patient app to move a booking to another day
const REQUEST: StaffPortalRequest = {
  id: 'request-1',
  patientId: 'patient-1',
  patientName: 'Example Patient',
  kind: 'reschedule',
  visitId: 'visit-1',
  visitDate: '2026-10-14',
  visitTime: '09:30:00',
  preferredDate: '2026-10-16',
  preferredTime: null,
  message: null,
  status: 'pending',
  staffNote: null,
  handledAt: null,
  handledByName: null,
  createdAt: '2026-10-13T06:00:00Z'
};
vi.mock('../portalRequestsService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../portalRequestsService')>()),
  loadPortalRequests: vi.fn(async () => ({ state: 'ready', requests: [REQUEST], pendingCount: 1 })),
  answerPortalRequest: vi.fn()
}));

import { PortalRequestsInbox } from '../PortalRequestsInbox';

afterEach(cleanup);

describe('patient app requests link to the booking and the diary', () => {
  // "Book or move the appointment in the scheduler first" gave no way to the booking or the day the patient asked for
  it('a request to move a booking opens that booking and the diary on the day the patient would like', async () => {
    render(
      <MemoryRouter>
        <PortalRequestsInbox practiceId="practice-1" />
      </MemoryRouter>
    );
    expect(await screen.findByRole('link', { name: 'Open the booking' })).toHaveAttribute(
      'href',
      '/patients?patientId=patient-1&tab=encounters&visitId=visit-1&action=edit-visit'
    );
    expect(screen.getByRole('link', { name: /^Open the diary on/ })).toHaveAttribute('href', '/?diaryDate=2026-10-16');
  });
});
