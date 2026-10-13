import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { DiaryStatus } from '../../../utils/diary/diaryStatuses';

vi.mock('../../../services/patientFileService', () => ({ loadPatientFileStatus: vi.fn().mockResolvedValue({ incomplete: false, missing: [] }) }));
vi.mock('../../forms/CompletePatientFileModal', () => ({ default: () => null }));
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

// An invented practice's statuses for a booked visit
const NO_ANSWER: DiaryStatus = { id: 's-call', name: 'Called, no answer', colour: 'red', stage: 'scheduled', isActive: true };
const CONFIRMED: DiaryStatus = { id: 's-conf', name: 'Confirmed by phone', colour: 'green', stage: 'scheduled', isActive: true };
const booking = { id: 'visit-1', status: 'scheduled', is_checked_in: false, patient: { first_name: 'Test', last_name: 'Patient' } };

const open = (props: Partial<React.ComponentProps<typeof VisitActionModal>> = {}) =>
  render(<VisitActionModal isOpen onClose={vi.fn()} visit={booking} visitStatus="scheduled" {...props} />);

// B3: reception records "Called, no answer" in one tap, without moving the visit to another stage
describe("VisitActionModal: the practice's own statuses", () => {
  it('offers the stage itself and the statuses for it, marking the one the booking has', () => {
    open({ statusChoices: [NO_ANSWER, CONFIRMED], currentStatus: NO_ANSWER, onSetStatus: vi.fn() });
    const group = screen.getByRole('group', { name: 'Booking status' });
    const buttons = within(group).getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(['Scheduled', 'Called, no answer', 'Confirmed by phone']);
    expect(within(group).getByRole('button', { name: 'Called, no answer' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Scheduled' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('gives the booking the chosen status, and takes it off again with the stage', () => {
    const onSetStatus = vi.fn();
    const { unmount } = open({ statusChoices: [NO_ANSWER, CONFIRMED], currentStatus: null, onSetStatus });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmed by phone' }));
    expect(onSetStatus).toHaveBeenCalledWith('s-conf');
    unmount();

    const clear = vi.fn();
    open({ statusChoices: [NO_ANSWER], currentStatus: NO_ANSWER, onSetStatus: clear });
    fireEvent.click(screen.getByRole('button', { name: 'Scheduled' }));
    expect(clear).toHaveBeenCalledWith(null);
  });

  it('saves nothing when the status the booking already has is chosen again', () => {
    const onSetStatus = vi.fn();
    open({ statusChoices: [NO_ANSWER], currentStatus: NO_ANSWER, onSetStatus });
    fireEvent.click(screen.getByRole('button', { name: 'Called, no answer' }));
    expect(onSetStatus).not.toHaveBeenCalled();
  });

  // A practice without statuses for this stage sees the visit actions as before: no empty "Status" row
  it('shows no status row when the practice has none for this stage', () => {
    open({ statusChoices: [], onSetStatus: vi.fn() });
    expect(screen.queryByRole('group', { name: 'Booking status' })).toBeNull();
  });
});
