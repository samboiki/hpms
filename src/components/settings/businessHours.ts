/**
 * Reads a time as stored in older branch business-hours records ("9:00 AM", "5:30 pm") or in
 * 24-hour form ("17:00") and returns it as 24-hour "HH:mm", or null when it cannot be read.
 */
export function parseTime12Hour(text: string): string | null {
  const match = /^\s*(\d{1,2}):(\d{2})\s*(?:([AaPp])\.?\s*[Mm]\.?)?\s*$/.exec(text);
  if (!match) return null;

  const hour = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) return null;

  const meridiem = match[3]?.toUpperCase();
  let hour24: number;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour24 = (hour % 12) + (meridiem === 'P' ? 12 : 0);
  } else {
    if (hour > 23) return null;
    hour24 = hour;
  }
  return `${String(hour24).padStart(2, '0')}:${match[2]}`;
}

/**
 * The first open day whose closing time is not after its opening time ("Monday"), or null when every open day is
 * sound. Such a day saves as a day with no bookable hours at all, so the form must refuse it.
 */
export function dayClosingBeforeOpening(
  hours: ReadonlyArray<{ day: string; isOpen: boolean; openTime?: string; closeTime?: string }>
): string | null {
  for (const schedule of hours) {
    if (!schedule.isOpen || !schedule.openTime || !schedule.closeTime) continue;
    const open = parseTime12Hour(schedule.openTime);
    const close = parseTime12Hour(schedule.closeTime);
    if (open && close && close <= open) return schedule.day;
  }
  return null;
}
