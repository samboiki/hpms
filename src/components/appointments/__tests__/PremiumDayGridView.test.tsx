import { describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PremiumDayGridView } from '../PremiumDayGridView';
import { NO_PRACTITIONER_ID, NO_PRACTITIONER_NAME } from '../../../utils/diary/diaryPractitioners';
import type { OffHourSpan } from '../../../utils/diary/gridHours';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

// An invented Tuesday: Dr One works 08:00-17:00 with lunch 13:00-14:00; the grid shows 07:00-18:00
const DAY = new Date(2026, 9, 6);
const column = (id: string, name: string, role = 'doctor') => ({ id, email: '', user_metadata: { full_name: name, role } });
const DR_ONE = column('pr-1', 'Dr One');
const UNASSIGNED = column(NO_PRACTITIONER_ID, NO_PRACTITIONER_NAME, '');
const h = (hours: number) => hours * 60;
const OFF: OffHourSpan[] = [
  { start: h(7), end: h(8), kind: 'outside' },
  { start: h(13), end: h(14), kind: 'break' },
  { start: h(17), end: h(18), kind: 'outside' }
];
const booking = (id: string, doctorId: string, time: string) => ({
  id,
  patient_id: `pt-${id}`,
  doctor_id: doctorId,
  date: '2026-10-06',
  time,
  duration: 30,
  type: 'consultation' as const,
  status: 'scheduled' as const,
  patient: { first_name: 'Patient', last_name: id.toUpperCase() }
});

const renderGrid = (overrides: Partial<React.ComponentProps<typeof PremiumDayGridView>> = {}) => {
  const onTimeSlotClick = vi.fn();
  const onAppointmentClick = vi.fn();
  render(
    <PremiumDayGridView
      selectedDate={DAY}
      appointments={[]}
      doctors={[DR_ONE]}
      businessHours={{ start: '07:00', end: '18:00' }}
      slotDuration={30}
      offHours={new Map([['pr-1', OFF]])}
      hoursSummaries={new Map([['pr-1', '08:00-17:00, break 13:00-14:00']])}
      onTimeSlotClick={onTimeSlotClick}
      onAppointmentClick={onAppointmentClick}
      {...overrides}
    />
  );
  return { onTimeSlotClick, onAppointmentClick };
};

const columnOf = (name: string): HTMLElement => {
  const element = screen.getByText(name).closest('[class*="min-w-[200px]"]');
  if (!element) throw new Error(`no column for ${name}`);
  return element as HTMLElement;
};

describe('PremiumDayGridView', () => {
  it("writes the practitioner's hours under their name, so the shading is explained in words", () => {
    renderGrid();
    expect(screen.getByText('08:00-17:00, break 13:00-14:00')).toBeInTheDocument();
  });

  it('names the time the practitioner is not working for screen readers, not by shading alone', () => {
    renderGrid();
    expect(screen.getByText('Break, 13:00 to 14:00')).toHaveClass('sr-only');
    expect(screen.getByText('Outside working hours, 07:00 to 08:00')).toBeInTheDocument();
  });

  it('still lets reception book into a shaded slot: the booking form then shows the usual warning', () => {
    const { onTimeSlotClick } = renderGrid();
    fireEvent.click(screen.getAllByTitle('Break, 13:00 to 14:00')[0]);
    expect(onTimeSlotClick).toHaveBeenCalledTimes(1);
    const [time, practitionerId] = onTimeSlotClick.mock.calls[0];
    expect([(time as Date).getHours(), (time as Date).getMinutes(), practitionerId]).toEqual([13, 0, 'pr-1']);
  });

  it('opens a booking through onAppointmentClick (the visit actions), the same as its card', () => {
    const { onAppointmentClick } = renderGrid({ appointments: [booking('a', 'pr-1', '09:00')] });
    fireEvent.click(screen.getByText('Patient A'));
    expect(onAppointmentClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('shows a booking without a practitioner in its own column, where nothing new can be booked', () => {
    const { onTimeSlotClick } = renderGrid({
      doctors: [DR_ONE, UNASSIGNED],
      appointments: [booking('w', NO_PRACTITIONER_ID, '10:00')]
    });
    const unassigned = columnOf(NO_PRACTITIONER_NAME);
    expect(within(unassigned).getByText('Patient W')).toBeInTheDocument();
    expect(within(unassigned).getByText('Open a booking to assign it')).toBeInTheDocument();

    const firstSlot = (name: string) => columnOf(name).querySelector('[class*="h-[60px]"]') as HTMLElement;
    fireEvent.click(firstSlot(NO_PRACTITIONER_NAME));
    expect(onTimeSlotClick).not.toHaveBeenCalled();
    fireEvent.click(firstSlot('Dr One'));
    expect(onTimeSlotClick).toHaveBeenCalledTimes(1);
  });

  // The day grid's drag now lives in useBookingMove, shared with the week grid: this keeps its behaviour pinned
  it("moves a booking dragged into another practitioner's free time after the booking checks", async () => {
    const onAppointmentDrop = vi.fn().mockResolvedValue(true);
    const onCheckMove = vi.fn().mockResolvedValue([]);
    renderGrid({
      doctors: [DR_ONE, column('pr-2', 'Dr Two')],
      appointments: [booking('a', 'pr-1', '09:00')],
      onAppointmentDrop,
      onCheckMove
    });
    const transfer = { setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' };
    // Rows run from 07:00 in 30-minute steps: the seventh row of Dr Two's column is 10:00
    const tenOClock = columnOf('Dr Two').querySelectorAll('[class*="h-[60px]"]')[6] as HTMLElement;
    fireEvent.dragStart(screen.getByText('Patient A').closest('[draggable="true"]') as HTMLElement, { dataTransfer: transfer });
    fireEvent.dragOver(tenOClock, { dataTransfer: transfer });
    fireEvent.drop(tenOClock, { dataTransfer: transfer });
    await waitFor(() => expect(onAppointmentDrop).toHaveBeenCalledTimes(1));
    const [id, time, practitionerId] = onAppointmentDrop.mock.calls[0] as [string, Date, string];
    expect([id, time.getHours(), time.getMinutes(), practitionerId]).toEqual(['a', 10, 0, 'pr-2']);
    expect(onCheckMove).toHaveBeenCalledWith('a', time, 'pr-2');
  });

  // A cancelled booking frees its time, so the grid leaves it out; but the "Cancelled" filter, or a link to a cancelled
  // booking (the patient file, the diary report), showed an empty day without it
  it('draws cancelled bookings only when the diary asks for them, and they open like any booking', () => {
    const cancelled = { ...booking('c', 'pr-1', '11:00'), status: 'cancelled' as const };
    renderGrid({ appointments: [cancelled] });
    expect(screen.queryByText('Patient C')).toBeNull();
    cleanup();
    const { onAppointmentClick } = renderGrid({ appointments: [cancelled], showCancelled: true });
    fireEvent.click(screen.getByText('Patient C'));
    expect(onAppointmentClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
  });
});
