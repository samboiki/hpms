/**
 * What links a booking to the rest of the file: its invoice (invoices_enhanced.visit_id) and a
 * patient's bookings with their reminder status. Read only; the rules are in
 * src/utils/diary/patientBookings.ts.
 */
import { supabase } from '../lib/supabase';
import { loadVisitsInRange } from './diaryService';
import { loadReminderStatuses } from './reminderStatusService';
import { addDaysToKey, toDateKey } from '../utils/diary/diaryTime';
import { splitPatientBookings, type BookingInvoice, type PatientBooking } from '../utils/diary/patientBookings';
import type { ReminderStatus } from '../utils/diary/reminderStatus';

const INVOICE_CHUNK = 40;

/** The invoices of these visits ([] when they cannot be read: the links are a convenience). */
export async function loadBookingInvoices(visitIds: string[]): Promise<BookingInvoice[]> {
  const ids = [...new Set(visitIds)];
  const invoices: BookingInvoice[] = [];
  for (let i = 0; i < ids.length; i += INVOICE_CHUNK) {
    const { data, error } = await supabase
      .from('invoices_enhanced')
      .select('id, invoice_number, payment_status, visit_id')
      .in('visit_id', ids.slice(i, i + INVOICE_CHUNK));
    if (error) {
      console.error('Could not load the invoices of the bookings:', error);
      return invoices;
    }
    for (const row of data ?? []) {
      invoices.push({ id: row.id, visitId: row.visit_id, number: row.invoice_number, paymentStatus: row.payment_status });
    }
  }
  return invoices;
}

export interface PatientBookingsData {
  upcoming: PatientBooking[];
  past: PatientBooking[];
  reminderStatuses: Map<string, ReminderStatus>;
}

export type PatientBookingsLoad = { state: 'ready'; data: PatientBookingsData } | { state: 'error'; message: string };

/** A patient's bookings from a year ago to a year ahead, with invoices and reminder statuses. */
export async function loadPatientBookings(practiceId: string, patientId: string): Promise<PatientBookingsLoad> {
  try {
    const today = toDateKey(new Date());
    const visits = await loadVisitsInRange(practiceId, addDaysToKey(today, -365), addDaysToKey(today, 365), { patientId });
    const ids = visits.map((visit) => visit.id);
    const [invoices, reminderStatuses] = await Promise.all([loadBookingInvoices(ids), loadReminderStatuses(ids)]);
    const { upcoming, past } = splitPatientBookings(visits, invoices, today);
    return { state: 'ready', data: { upcoming, past, reminderStatuses } };
  } catch (error) {
    return { state: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
