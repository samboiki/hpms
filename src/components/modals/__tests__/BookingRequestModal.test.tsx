import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// No signed-in user: the doctor/branch lookup stops before any query, so nothing reaches a database
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    from: () => {
      throw new Error('No database calls expected in this test');
    }
  }
}));
// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import BookingRequestModal from '../BookingRequestModal';

const patient = { id: 'patient-1', first_name: 'Test', last_name: 'Patient', cell_number: '+264810000000' };
const noop = () => {};

// Reception opens website booking requests from the scheduler, which passes its own appointment
// shape (date/time/type). Reading only scheduled_date/scheduled_time gave an invalid date, date-fns
// threw, and the booking could not be opened or confirmed.
describe('BookingRequestModal', () => {
  it('opens a booking request from the scheduler and shows its date and time day-first', () => {
    const appointment = { id: 'visit-1', patient_id: 'patient-1', patient, date: '2026-10-06', time: '14:30:00', type: 'follow-up' };
    render(<BookingRequestModal isOpen onClose={noop} onConfirm={noop} visit={appointment} />);

    expect(screen.getByText('6 October 2026 at 2:30 PM')).toBeTruthy();
    expect(screen.getByText('follow-up')).toBeTruthy();
  });

  it('still opens a booking that has no date or time, instead of crashing', () => {
    const appointment = { id: 'visit-1', patient_id: 'patient-1', patient, type: 'consultation' };
    render(<BookingRequestModal isOpen onClose={noop} onConfirm={noop} visit={appointment} />);

    expect(screen.getByText('Not set')).toBeTruthy();
  });

  it('reads raw visits that store the booking in scheduled_date and scheduled_time', () => {
    const visit = { id: 'visit-2', patient, scheduled_date: '2026-10-07', scheduled_time: '09:00', visit_type: 'consultation' };
    render(<BookingRequestModal isOpen onClose={noop} onConfirm={noop} visit={visit} />);

    expect(screen.getByText('7 October 2026 at 9:00 AM')).toBeTruthy();
  });
});
