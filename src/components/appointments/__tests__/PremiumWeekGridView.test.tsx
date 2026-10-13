import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PremiumWeekGridView } from '../PremiumWeekGridView';
import type { OffHourSpan } from '../../../utils/diary/gridHours';
import { minutesToTime, toDateKey } from '../../../utils/diary/diaryTime';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

// An invented week (Monday 5 to Sunday 11 October 2026): the practice works 08:00-17:00 on weekdays
const WEEK = [5, 6, 7, 8, 9, 10, 11].map((day) => new Date(2026, 9, day));
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const booking = (id: string, date: string, time: string) => ({
  id,
  patient_id: `pt-${id}`,
  doctor_id: 'pr-1',
  date,
  time,
  duration: 30,
  type: 'consultation' as const,
  status: 'scheduled' as const,
  patient: { first_name: 'Patient', last_name: id.toUpperCase() }
});

const renderWeek = (overrides: Partial<React.ComponentProps<typeof PremiumWeekGridView>> = {}) => {
  const onAppointmentClick = vi.fn();
  render(
    <PremiumWeekGridView
      weekDates={WEEK}
      appointments={[]}
      doctors={[]}
      hours={{ start: h(8), end: h(17) }}
      onAppointmentClick={onAppointmentClick}
      {...overrides}
    />
  );
  return { onAppointmentClick };
};

describe('PremiumWeekGridView', () => {
  it('shows the hours of the practice instead of a fixed day, so the week fits without scrolling past empty evenings', () => {
    renderWeek();
    expect(screen.getByText('8:00 AM')).toBeInTheDocument();
    expect(screen.getByText('4:30 PM')).toBeInTheDocument();
    expect(screen.queryByText('5:00 PM')).not.toBeInTheDocument();
  });

  it('adds rows for a booking outside the hours rather than hiding it (its slot would look free)', () => {
    renderWeek({ appointments: [booking('late', '2026-10-07', '18:15')] });
    expect(screen.getByText('6:00 PM')).toBeInTheDocument();
    expect(screen.getByText('Patient L.')).toBeInTheDocument();
  });

  it('shades a closed day and names it for screen readers', () => {
    const sunday: OffHourSpan[] = [{ start: h(8), end: h(17), kind: 'day_off' }];
    renderWeek({ offHours: new Map([['2026-10-11', sunday]]) });
    expect(screen.getByText('Not working today')).toHaveClass('sr-only');
  });

  it('opens a booking through onAppointmentClick (the visit actions), the same as its card', () => {
    const { onAppointmentClick } = renderWeek({ appointments: [booking('a', '2026-10-06', '09:00')] });
    fireEvent.click(screen.getByText('Patient A.'));
    expect(onAppointmentClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });
});

// Moving a booking to another day used to mean opening it and rebooking; the week grid now drags like the day grid,
// with the same checks and the same question before anything moves
describe('PremiumWeekGridView: dragging a booking', () => {
  afterEach(() => vi.restoreAllMocks());

  const dataTransfer = () => ({ setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' });
  const dragTo = (cardText: string, slot: string) => {
    const card = screen.getByText(cardText).closest('[draggable="true"]') as HTMLElement;
    const cell = document.querySelector(`[data-slot="${slot}"]`) as HTMLElement;
    const transfer = dataTransfer();
    fireEvent.dragStart(card, { dataTransfer: transfer });
    fireEvent.dragOver(cell, { dataTransfer: transfer });
    fireEvent.drop(cell, { dataTransfer: transfer });
  };
  const renderMovable = (appointments: Array<ReturnType<typeof booking>>, checks: string[] = []) => {
    const onAppointmentDrop = vi.fn().mockResolvedValue(true);
    const onCheckMove = vi.fn().mockResolvedValue(checks);
    renderWeek({ appointments, onAppointmentDrop, onCheckMove });
    return { onAppointmentDrop, onCheckMove };
  };

  it('moves a booking to another day and time after the checks, keeping its practitioner', async () => {
    const { onAppointmentDrop, onCheckMove } = renderMovable([booking('a', '2026-10-06', '09:00')]);
    dragTo('Patient A.', '2026-10-08-10:30');
    await waitFor(() => expect(onAppointmentDrop).toHaveBeenCalledTimes(1));
    const [id, time, practitionerId] = onAppointmentDrop.mock.calls[0] as [string, Date, string];
    expect([id, toDateKey(time), minutesToTime(time.getHours() * 60 + time.getMinutes()), practitionerId]).toEqual(['a', '2026-10-08', '10:30', 'pr-1']);
    expect(onCheckMove).toHaveBeenCalledWith('a', time, 'pr-1');
  });

  it('asks before moving when the checks find a clash, and leaves the booking when reception says no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onAppointmentDrop } = renderMovable([booking('a', '2026-10-06', '09:00')], ['Dr One already has a booking at 10:30.']);
    dragTo('Patient A.', '2026-10-08-10:30');
    await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Dr One already has a booking at 10:30.')));
    expect(onAppointmentDrop).not.toHaveBeenCalled();
  });

  it('keeps a visit that has started in its slot, as the day grid does', async () => {
    const { onAppointmentDrop, onCheckMove } = renderMovable([{ ...booking('a', '2026-10-06', '09:00'), status: 'in-progress' as never }]);
    dragTo('Patient A.', '2026-10-08-10:30');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onCheckMove).not.toHaveBeenCalled();
    expect(onAppointmentDrop).not.toHaveBeenCalled();
  });

  it('does not move a website request without a practitioner: it is opened and assigned instead', async () => {
    const { onAppointmentDrop } = renderMovable([{ ...booking('w', '2026-10-06', '09:00'), doctor_id: '' }]);
    dragTo('Patient W.', '2026-10-08-10:30');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onAppointmentDrop).not.toHaveBeenCalled();
  });

  it('cannot drag at all when the diary does not pass a way to save the move', () => {
    renderWeek({ appointments: [booking('a', '2026-10-06', '09:00')] });
    expect(screen.getByText('Patient A.').closest('[draggable="true"]')).toBeNull();
  });
});
