import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BookingWarningsPanel } from '../BookingWarningsPanel';
import { DiaryDayNotices } from '../DiaryDayNotices';
import { ReminderStatusIcon } from '../ReminderStatusIcon';
import { PremiumTimeRangePicker } from '../../../ui/PremiumTimeRangePicker';
import type { DiaryBlock } from '../../../../utils/diary/blockedTime';

const lunch: DiaryBlock = {
  id: 'b1',
  practiceId: 'p1',
  branchId: null,
  branchName: null,
  doctorId: 'pr-a',
  reason: 'Lunch',
  startDate: '2026-10-05',
  endDate: null,
  startMinutes: 13 * 60,
  endMinutes: 14 * 60,
  recurrence: 'weekdays'
};

describe('BookingWarningsPanel', () => {
  it('lets reception book anyway or go back: a clash is explained, never a dead end', () => {
    const onConfirm = vi.fn();
    const onChange = vi.fn();
    render(
      <BookingWarningsPanel
        warnings={[{ kind: 'doctor_overlap', message: 'N. Amupolo already has a booking at 09:00 that overlaps this time.' }]}
        confirmLabel="Book anyway"
        onConfirm={onConfirm}
        onChange={onChange}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('already has a booking at 09:00');
    fireEvent.click(screen.getByRole('button', { name: 'Book anyway' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change the booking' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('ReminderStatusIcon', () => {
  it('shows nothing without SMS activity, so practices that do not send SMS keep clean cards', () => {
    const { container } = render(<ReminderStatusIcon status={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('gives the full story as the accessible name, so it is not only a colour', () => {
    render(
      <ReminderStatusIcon
        showLabel
        status={{ tone: 'confirmed', label: 'Confirmed by SMS', detail: 'Patient confirmed by SMS on 6 Oct 2026, 09:14.', icon: 'solar:check-circle-bold-duotone' }}
      />
    );
    expect(screen.getByRole('img', { name: 'Patient confirmed by SMS on 6 Oct 2026, 09:14.' })).toHaveTextContent('Confirmed by SMS');
  });
});

describe('DiaryDayNotices', () => {
  it("names the holiday and each block of the day, so reception knows before the phone rings", () => {
    render(
      <DiaryDayNotices
        holiday={{ date: '2026-08-26', name: "Heroes' Day" }}
        blocks={[lunch]}
        practitionerName={() => 'N. Amupolo'}
      />
    );
    expect(screen.getByText(/public holiday/)).toHaveTextContent("Heroes' Day");
    expect(screen.getByText('N. Amupolo unavailable 13:00-14:00: Lunch')).toBeInTheDocument();
  });

  it('takes no space on an ordinary day', () => {
    const { container } = render(<DiaryDayNotices holiday={null} blocks={[]} practitionerName={() => null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PremiumTimeRangePicker', () => {
  it('keeps booked and blocked times selectable: saving asks first instead of silently refusing', () => {
    const onStartTimeChange = vi.fn();
    render(
      <PremiumTimeRangePicker
        startTime="08:00"
        endTime="08:30"
        onStartTimeChange={onStartTimeChange}
        onEndTimeChange={() => undefined}
        bookedTimes={['09:00']}
        blockedTimes={{ '13:00': 'Lunch' }}
        min="08:00"
        max="14:00"
      />
    );
    const booked = screen.getByRole('button', { name: /9:00 AM/ });
    const blocked = screen.getByRole('button', { name: /1:00 PM/ });
    expect(booked).toBeEnabled();
    expect(booked).toHaveAttribute('title', 'Already booked: you will be asked before double-booking');
    expect(blocked).toHaveAttribute('title', 'Blocked: Lunch. You will be asked before booking.');
    fireEvent.click(booked);
    expect(onStartTimeChange).toHaveBeenCalledWith('09:00');
  });
});
