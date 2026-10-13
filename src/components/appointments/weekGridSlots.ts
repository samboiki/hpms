/**
 * Rows of the week timeline (PremiumWeekGridView): half-hours, or the practitioners' diary slot
 * (src/utils/diary/slotLength.ts). The grid only draws an appointment inside a row, so every
 * appointment must land in a visible row: a hidden appointment makes its slot look free and staff
 * could book a second patient with the same doctor on top of it. The rows shown come from
 * src/utils/diary/gridHours.ts (the day's hours, widened to every booking), each starting on a
 * multiple of the row length since midnight, as here.
 */
import { minutesToTime } from '../../utils/diary/diaryTime';

/** The row an appointment time ('HH:mm' or 'HH:mm:ss') belongs to, e.g. '09:15' -> '09:00' with half-hour rows. */
export function slotForTime(time: string, rowMinutes = 30): string {
  const [hour = '', minute = ''] = time.split(':');
  const step = Math.max(5, Math.round(rowMinutes));
  return minutesToTime(Math.floor((Number(hour) * 60 + Number(minute)) / step) * step);
}
