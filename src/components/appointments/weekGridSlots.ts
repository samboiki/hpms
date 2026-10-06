/**
 * Half-hour rows for the week timeline (PremiumWeekGridView). The grid only draws an appointment
 * inside a row, so every appointment must land in a visible row: a hidden appointment makes its
 * slot look free and staff could book a second patient with the same doctor on top of it.
 */

const FIRST_HOUR = 8;
const LAST_HOUR = 17; // the last default row starts at 17:30

/** The row an appointment time ('HH:mm' or 'HH:mm:ss') belongs to, e.g. '09:15' -> '09:00'. */
export function slotForTime(time: string): string {
  const [hour = '', minute = ''] = time.split(':');
  return `${hour.padStart(2, '0')}:${Number(minute) >= 30 ? '30' : '00'}`;
}

/** Rows from 08:00 to 17:30, widened so the earliest and latest appointments still get a row. */
export function buildWeekTimeSlots(appointmentTimes: Array<string | null | undefined>): string[] {
  const hours = appointmentTimes
    .filter((time): time is string => Boolean(time))
    .map((time) => Number(time.split(':')[0]))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
  const first = Math.min(FIRST_HOUR, ...hours);
  const last = Math.max(LAST_HOUR, ...hours);

  const slots: string[] = [];
  for (let hour = first; hour <= last; hour++) {
    const hh = String(hour).padStart(2, '0');
    slots.push(`${hh}:00`, `${hh}:30`);
  }
  return slots;
}
