import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { PatientBookingsLoad } from '../../../../services/bookingLinksService';

// One invented past booking with its invoice, seen by an invented practitioner
const LOAD: PatientBookingsLoad = {
  state: 'ready',
  data: {
    upcoming: [],
    past: [
      {
        id: 'visit-1',
        date: '2026-10-06',
        time: '09:00',
        practitionerId: 'practitioner-1',
        stage: 'done' as never,
        stageLabel: 'Done',
        invoice: { id: 'inv-1', visitId: 'visit-1', number: 'INV-000007', paymentStatus: 'pending' }
      }
    ],
    reminderStatuses: new Map()
  }
};
vi.mock('../../../../services/bookingLinksService', () => ({ loadPatientBookings: vi.fn(async () => LOAD) }));
vi.mock('../../../../services/invoiceContextService', () => ({
  loadPracticeStaff: vi.fn(async () => [{ id: 'practitioner-1', full_name: 'Example Practitioner', role: 'doctor', is_active: true }])
}));

import { PatientBookingsPanel } from '../PatientBookingsPanel';
import { loadPatientBookings } from '../../../../services/bookingLinksService';

// The same invented booking, cancelled
const CANCELLED: PatientBookingsLoad = {
  state: 'ready',
  data: {
    upcoming: [],
    past: [
      { id: 'visit-2', date: '2026-10-06', time: '09:00', practitionerId: 'practitioner-1', stage: 'cancelled', stageLabel: 'Cancelled', invoice: null }
    ],
    reminderStatuses: new Map()
  }
};

afterEach(cleanup);

const renderPanel = (props: Partial<React.ComponentProps<typeof PatientBookingsPanel>> = {}) =>
  render(
    <MemoryRouter>
      <PatientBookingsPanel practiceId="practice-1" patientId="patient-1" {...props} />
    </MemoryRouter>
  );

describe("the patient file's bookings", () => {
  // Inside the file, Visit and Invoice were links back into the same file's address: the second time a link was
  // followed nothing changed in the address, so nothing opened
  it('opens the visit and the Billing tab in place, every time', async () => {
    const onOpenVisit = vi.fn();
    const onOpenBilling = vi.fn();
    renderPanel({ onOpenVisit, onOpenBilling });
    fireEvent.click(await screen.findByText(/Past bookings/));
    const visit = screen.getByRole('button', { name: /Open the visit of/ });
    fireEvent.click(visit);
    fireEvent.click(visit);
    expect(onOpenVisit).toHaveBeenNthCalledWith(2, 'visit-1');
    fireEvent.click(screen.getByRole('button', { name: 'Open invoice INV-000007' }));
    expect(onOpenBilling).toHaveBeenCalledTimes(1);
  });

  it('outside the file the same rows link to the visit and the invoices', async () => {
    renderPanel();
    fireEvent.click(await screen.findByText(/Past bookings/));
    expect(screen.getByRole('link', { name: /Open the visit of/ })).toHaveAttribute(
      'href',
      '/patients?patientId=patient-1&tab=encounters&visitId=visit-1&action=edit-visit'
    );
  });

  // The file never passed the practitioners' names, so no booking said who it was with
  it('says who each booking is with', async () => {
    renderPanel();
    expect(await screen.findByText(/Done · Example Practitioner/)).toBeInTheDocument();
  });

  // A doctor's diary opens on their own column and the time grid leaves cancelled bookings out, so the day alone could
  // open a diary without this booking in it
  it("opens the booking's day with its practitioner's column, and the cancelled bookings for a cancelled one", async () => {
    renderPanel();
    fireEvent.click(await screen.findByText(/Past bookings/));
    expect(screen.getByRole('link', { name: /in the diary$/ })).toHaveAttribute('href', '/?diaryDate=2026-10-06&diaryPractitioner=practitioner-1');
    cleanup();
    vi.mocked(loadPatientBookings).mockResolvedValueOnce(CANCELLED);
    renderPanel();
    fireEvent.click(await screen.findByText(/Past bookings/));
    expect(screen.getByRole('link', { name: /in the diary$/ })).toHaveAttribute(
      'href',
      '/?diaryDate=2026-10-06&diaryPractitioner=practitioner-1&diaryShow=cancelled'
    );
  });
});
