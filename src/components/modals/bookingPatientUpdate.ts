/**
 * Patient fields saved when reception confirms a website booking (BookingRequestModal).
 * Only the fields the form shows are sent, and blank ones are skipped: the form starts with an
 * empty ID number and date of birth, and sending '' would wipe details already on file (the date
 * column rejects it outright). Hidden form state, such as a default gender, is never sent.
 */
const BOOKING_PATIENT_FIELDS = ['first_name', 'last_name', 'email', 'cell_number', 'id_number', 'date_of_birth'] as const;

export type BookingPatientField = (typeof BOOKING_PATIENT_FIELDS)[number];

export function buildBookingPatientUpdate(
  form: Record<BookingPatientField, string>
): Partial<Record<BookingPatientField, string>> {
  const update: Partial<Record<BookingPatientField, string>> = {};
  for (const field of BOOKING_PATIENT_FIELDS) {
    const value = (form[field] ?? '').trim();
    if (value) update[field] = value;
  }
  return update;
}
