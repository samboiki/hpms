import { describe, it, expect } from 'vitest';
import { bookingLinks, formatBookingWhen, splitPatientBookings, type PatientBookingVisit } from '../patientBookings';

const visit = (id: string, date: string, overrides: Partial<PatientBookingVisit> = {}): PatientBookingVisit => ({
  id,
  patient_id: 'patient-1',
  doctor_id: 'pr-a',
  scheduled_date: date,
  scheduled_time: '09:30:00',
  visit_date: date,
  visit_time: '09:30:00',
  status: 'scheduled',
  is_cancelled: false,
  ...overrides
});

describe('splitPatientBookings', () => {
  const visits = [
    visit('next-month', '2026-11-05'),
    visit('tomorrow', '2026-10-08'),
    visit('today-waiting', '2026-10-07', { is_checked_in: true }),
    visit('last-week', '2026-09-30', { status: 'completed' }),
    visit('missed', '2026-10-01', { status: 'no-show' }),
    visit('cancelled-future', '2026-10-20', { is_cancelled: true })
  ];
  const invoices = [{ id: 'inv-1', visitId: 'last-week', number: 'INV-0042', paymentStatus: 'paid' }];

  it('puts what is still to come first, soonest first, so reception sees the next booking at once', () => {
    const { upcoming } = splitPatientBookings(visits, invoices, '2026-10-07');
    expect(upcoming.map((booking) => booking.id)).toEqual(['today-waiting', 'tomorrow', 'next-month']);
    expect(upcoming[0].stageLabel).toBe('Checked in (waiting)');
  });

  it('lists what happened latest first, with the invoice of each visit', () => {
    const { past } = splitPatientBookings(visits, invoices, '2026-10-07');
    expect(past.map((booking) => booking.id)).toEqual(['cancelled-future', 'missed', 'last-week']);
    expect(past.find((booking) => booking.id === 'last-week')?.invoice?.number).toBe('INV-0042');
  });

  it('keeps the past list short', () => {
    const many = Array.from({ length: 15 }, (_, i) => visit(`v${i}`, `2026-09-${String(i + 1).padStart(2, '0')}`, { status: 'completed' }));
    expect(splitPatientBookings(many, [], '2026-10-07', 10).past).toHaveLength(10);
  });
});

describe('links back from the patient file', () => {
  // A doctor's diary opens on their own column and the time grid leaves cancelled bookings out: the day alone could
  // open on a diary without the booking in it
  it("open the day with the booking's practitioner, and its cancelled bookings when it was cancelled", () => {
    expect(bookingLinks.diaryDay('2026-10-08', { practitionerId: 'pr-a', showCancelled: true })).toBe(
      '/?diaryDate=2026-10-08&diaryPractitioner=pr-a&diaryShow=cancelled'
    );
  });

  it('open the day in the diary, the visit and the invoices', () => {
    expect(bookingLinks.diaryDay('2026-10-08')).toBe('/?diaryDate=2026-10-08');
    expect(bookingLinks.visit('p 1', 'v1')).toBe('/patients?patientId=p%201&tab=encounters&visitId=v1&action=edit-visit');
    expect(bookingLinks.invoices('p1')).toBe('/patients?patientId=p1&tab=billing');
  });

  it('write the date day first', () => {
    expect(formatBookingWhen({ date: '2026-10-08', time: '09:30' })).toBe('8 Oct 2026, 09:30');
  });
});
