import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PremiumDayGridView } from '../PremiumDayGridView';
import { PremiumWeekGridView } from '../PremiumWeekGridView';
import { slotForTime } from '../weekGridSlots';
import type { DiaryStatus } from '../../../utils/diary/diaryStatuses';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

// An invented Tuesday: Dr Fifteen sees patients every 15 minutes, Dr Twenty every 20; the grid shows 08:00-09:00
const DAY = new Date(2026, 9, 6);
const column = (id: string, name: string) => ({ id, email: '', user_metadata: { full_name: name, role: 'doctor' } });
const WAITING: DiaryStatus = { id: 's-xray', name: 'Waiting for X-ray', colour: 'amber', stage: 'checked-in', isActive: true };
const booking = (id: string, doctorId: string, time: string, date = '2026-10-06') => ({
  id,
  patient_id: `pt-${id}`,
  doctor_id: doctorId,
  date,
  time,
  duration: 20,
  type: 'consultation' as const,
  status: 'scheduled' as const,
  patient: { first_name: 'Patient', last_name: id.toUpperCase() }
});

const columnOf = (name: string): HTMLElement => screen.getByText(name).closest('[class*="min-w-[200px]"]') as HTMLElement;

describe('PremiumDayGridView: each practitioner at their own diary slot (B6)', () => {
  const renderDay = (onTimeSlotClick = vi.fn()) =>
    render(
      <PremiumDayGridView
        selectedDate={DAY}
        appointments={[booking('a', 'pr-20', '08:20')]}
        doctors={[column('pr-15', 'Dr Fifteen'), column('pr-20', 'Dr Twenty')]}
        businessHours={{ start: '08:00', end: '09:00' }}
        slotDuration={15}
        columnSlotMinutes={new Map([['pr-15', 15], ['pr-20', 20]])}
        bookingStatuses={new Map([['a', WAITING]])}
        onTimeSlotClick={onTimeSlotClick}
      />
    );

  it("draws rows at the shortest slot and each column's own slots, so a 20-minute practitioner is booked on the hour, :20 and :40", () => {
    const onTimeSlotClick = vi.fn();
    renderDay(onTimeSlotClick);
    // The time column has four 15-minute rows
    expect(screen.getAllByText(/^8:\d{2} AM$/).map((label) => label.textContent)).toEqual(['8:00 AM', '8:15 AM', '8:30 AM', '8:45 AM']);
    const fifteen = columnOf('Dr Fifteen').querySelectorAll('[class*="border-dotted"][class*="relative"]');
    const twenty = Array.from(columnOf('Dr Twenty').querySelectorAll<HTMLElement>('[style*="height"]')).filter((cell) => cell.className.includes('border-b'));
    expect(fifteen.length).toBeGreaterThanOrEqual(4);
    // 08:00, 08:20 (booked) and 08:40, each 80 px (20 minutes at 60 px per 15)
    expect(twenty.map((cell) => cell.style.height)).toEqual(['80px', '80px', '80px']);
    fireEvent.click(twenty[2]);
    expect(onTimeSlotClick).toHaveBeenCalledWith(new Date(2026, 9, 6, 8, 40), 'pr-20');
  });

  it("shows the practice's own status on the card in words", () => {
    renderDay();
    expect(within(columnOf('Dr Twenty')).getByText('Waiting for X-ray')).toBeInTheDocument();
  });
});

describe('PremiumWeekGridView: rows at the diary slot (B6)', () => {
  const WEEK = [5, 6, 7, 8, 9, 10, 11].map((day) => new Date(2026, 9, day));

  it('puts a 08:15 booking in the 08:15 row when the rows are 15 minutes, and keeps the half-hour scale', () => {
    render(
      <PremiumWeekGridView
        weekDates={WEEK}
        appointments={[booking('b', 'pr-15', '08:15', '2026-10-07')]}
        doctors={[]}
        hours={{ start: 8 * 60, end: 9 * 60 }}
        slotMinutes={15}
        bookingStatuses={new Map([['b', WAITING]])}
      />
    );
    const row = document.querySelector('[data-slot="2026-10-07-08:15"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.style.height).toBe('40px');
    expect(screen.getByText('Waiting for X-ray')).toBeInTheDocument();
  });

  it('finds the row of a booking at any row length', () => {
    expect(slotForTime('08:25', 20)).toBe('08:20');
    expect(slotForTime('08:45:00', 15)).toBe('08:45');
    expect(slotForTime('9:05')).toBe('09:00');
  });
});
