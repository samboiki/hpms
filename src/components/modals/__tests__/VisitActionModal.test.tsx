import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Only completed visits look up their invoices; none of these tests should reach a database
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => {
      throw new Error('No database calls expected in this test');
    }
  }
}));
// Iconify would try to download icon data over the network
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import VisitActionModal from '../VisitActionModal';

const noop = () => {};
const booking = (overrides: Record<string, unknown> = {}) => ({
  id: 'visit-1',
  status: 'scheduled',
  is_checked_in: false,
  patient: { first_name: 'Test', last_name: 'Patient' },
  ...overrides
});

// A receptionist who books the wrong patient or slot needs the booking gone, not left as a cancellation.
// Only administrators get that action (the scheduler passes onDelete for them alone), and only until the
// patient checks in: from then on the visit holds clinical records and is cancelled or completed instead.
describe('VisitActionModal: Delete Booking', () => {
  it('lets an administrator delete a booking before the patient checks in', () => {
    const onDelete = vi.fn();
    render(<VisitActionModal isOpen onClose={noop} visit={booking()} visitStatus="scheduled" onDelete={onDelete} />);

    fireEvent.click(screen.getByText('Delete Booking'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('is not offered when the scheduler gives no delete handler (staff who are not administrators)', () => {
    render(<VisitActionModal isOpen onClose={noop} visit={booking()} visitStatus="scheduled" onCancel={noop} />);

    expect(screen.queryByText('Delete Booking')).toBeNull();
    expect(screen.getByText('Cancel Visit')).toBeTruthy();
  });

  it('is not offered once the patient has checked in', () => {
    render(
      <VisitActionModal isOpen onClose={noop} visit={booking({ is_checked_in: true })} visitStatus="scheduled" isCheckedIn onDelete={noop} />
    );

    expect(screen.queryByText('Delete Booking')).toBeNull();
  });

  it('is not offered for a visit under way or finished', () => {
    const { unmount } = render(
      <VisitActionModal isOpen onClose={noop} visit={booking({ status: 'in-progress' })} visitStatus="in-progress" onDelete={noop} />
    );
    expect(screen.queryByText('Delete Booking')).toBeNull();
    unmount();

    render(<VisitActionModal isOpen onClose={noop} visit={booking({ status: 'completed' })} visitStatus="completed" onDelete={noop} />);
    expect(screen.queryByText('Delete Booking')).toBeNull();
  });

  it('can still remove a cancelled booking that was made by mistake', () => {
    render(
      <VisitActionModal isOpen onClose={noop} visit={booking({ status: 'cancelled', is_cancelled: true })} visitStatus="cancelled" onDelete={noop} />
    );

    expect(screen.getByText('Delete Booking')).toBeTruthy();
  });
});
