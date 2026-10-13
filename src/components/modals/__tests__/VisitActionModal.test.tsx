import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// Whether the patient's file is complete (a booking made with a name and cell only is not)
const fileService = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('../../../services/patientFileService', () => ({ loadPatientFileStatus: fileService.load }));
// The completion form reads and saves the patient; here it only has to open
vi.mock('../../forms/CompletePatientFileModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>Completion form open</div> : null)
}));

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

// B8: the next booking is usually made from this one (a follow-up after the visit, a rebooking after a no-show), so
// "Book Again" and "Copy" are offered at every stage and hand over to the diary, which opens the booking form
describe('VisitActionModal: Book Again and Copy', () => {
  it('offers Book Again after a finished visit, so the follow-up is booked from it in one tap', () => {
    const onBookAgain = vi.fn();
    const onClose = vi.fn();
    render(
      <VisitActionModal isOpen onClose={onClose} visit={booking({ status: 'completed' })} visitStatus="completed" onBookAgain={onBookAgain} onCopy={noop} />
    );

    fireEvent.click(screen.getByText('Book Again'));

    expect(onBookAgain).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('offers Copy for a booking still to come, and closes so reception can choose the free time', () => {
    const onCopy = vi.fn();
    const onClose = vi.fn();
    render(<VisitActionModal isOpen onClose={onClose} visit={booking()} visitStatus="scheduled" onBookAgain={noop} onCopy={onCopy} />);

    fireEvent.click(screen.getByText('Copy'));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows neither where the screen cannot book (no handlers passed), rather than buttons that do nothing', () => {
    render(<VisitActionModal isOpen onClose={noop} visit={booking()} visitStatus="scheduled" onCancel={noop} />);

    expect(screen.queryByText('Book Again')).toBeNull();
    expect(screen.queryByText('Copy')).toBeNull();
  });
});

// A9: a caller booked with a name and cell only arrives; reception is prompted to complete the file (ID number, date of
// birth, gender, medical aid) with one tap, because medical aid claims wait until the file is complete.
describe('VisitActionModal: completing a new patient file on arrival', () => {
  it('prompts reception to complete a file booked with a name and cell, and opens the form in one tap', async () => {
    fileService.load.mockResolvedValue({ incomplete: true, missing: ['ID number', 'date of birth', 'gender'], dateOfBirth: null, gender: null });
    render(<VisitActionModal isOpen onClose={noop} visit={booking({ patient_id: 'patient-9' })} visitStatus="scheduled" onCheckIn={noop} />);

    expect(await screen.findByText('New patient: complete the file')).toBeTruthy();
    expect(screen.getByText(/Still needed: ID number, date of birth and gender/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Complete file' }));
    expect(screen.getByText('Completion form open')).toBeTruthy();
  });

  it('says nothing about a complete file', async () => {
    fileService.load.mockResolvedValue({ incomplete: false, missing: [], dateOfBirth: '1990-05-14', gender: 'female' });
    render(<VisitActionModal isOpen onClose={noop} visit={booking({ patient_id: 'patient-9' })} visitStatus="scheduled" onCheckIn={noop} />);

    await waitFor(() => expect(fileService.load).toHaveBeenCalledWith('patient-9'));
    // Let the answer arrive before checking that no prompt followed it
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(screen.queryByText('New patient: complete the file')).toBeNull();
  });
});
