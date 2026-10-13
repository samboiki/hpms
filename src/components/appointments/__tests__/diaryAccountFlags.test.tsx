/**
 * Diary cards carry one small icon when the patient's account has a flag that matters at the desk (cash only, a
 * credit limit, a dispute ...): reception sees it before the patient arrives, and a screen reader hears the flags
 * in words, not a colour. Invented bookings.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PremiumDayGridView } from '../PremiumDayGridView';
import { PremiumWeekGridView } from '../PremiumWeekGridView';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
// Icons load their data on a timer that could outlive the test
vi.mock('@iconify/react', () => ({ Icon: () => null }));

const booking = (id: string, date: string, time: string, doctorId = 'pr-1') => ({
  id,
  patient_id: `pt-${id}`,
  doctor_id: doctorId,
  date,
  time,
  duration: 30,
  type: 'consultation' as const,
  status: 'scheduled' as const,
  patient: { first_name: 'Patient', last_name: id.toUpperCase() }
});

const FLAGS = new Map([['pt-a', 'Account: Cash only, Credit limit']]);

describe('account flags on diary cards', () => {
  it('shows one icon named with the flags on the day grid card of a flagged patient, and none on the others', () => {
    render(
      <PremiumDayGridView
        selectedDate={new Date(2026, 9, 6)}
        appointments={[booking('a', '2026-10-06', '09:00'), booking('b', '2026-10-06', '10:00')]}
        doctors={[{ id: 'pr-1', email: '', user_metadata: { full_name: 'Dr One', role: 'doctor' } }]}
        businessHours={{ start: '08:00', end: '12:00' }}
        slotDuration={30}
        accountFlags={FLAGS}
      />
    );
    const icons = screen.getAllByRole('img', { name: 'Account: Cash only, Credit limit' });
    expect(icons).toHaveLength(1);
    expect(icons[0]).toHaveAttribute('title', 'Account: Cash only, Credit limit');
  });

  it('shows the same icon on the week grid', () => {
    render(
      <PremiumWeekGridView
        weekDates={[5, 6, 7, 8, 9, 10, 11].map(day => new Date(2026, 9, day))}
        appointments={[booking('a', '2026-10-06', '09:00'), booking('b', '2026-10-07', '09:00')]}
        doctors={[]}
        hours={{ start: 8 * 60, end: 12 * 60 }}
        accountFlags={FLAGS}
      />
    );
    expect(screen.getAllByRole('img', { name: 'Account: Cash only, Credit limit' })).toHaveLength(1);
  });

  it('shows nothing while the flags are not known (before they load, or before the debtors update)', () => {
    render(
      <PremiumWeekGridView
        weekDates={[5, 6, 7, 8, 9, 10, 11].map(day => new Date(2026, 9, day))}
        appointments={[booking('a', '2026-10-06', '09:00')]}
        doctors={[]}
        hours={{ start: 8 * 60, end: 12 * 60 }}
      />
    );
    expect(screen.queryByRole('img', { name: /^Account:/ })).toBeNull();
  });
});
