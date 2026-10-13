import { addDays, differenceInHours, differenceInMinutes, format, isSameDay, isValid } from 'date-fns';

/**
 * When a dashboard notification happened, or for scheduled items such as today's follow-ups, when
 * it is due. Future times used to read "Just now", and an invalid date made date-fns format() throw
 * and take the notifications panel down with it.
 */
export function formatNotificationTime(date: Date, now: Date = new Date()): string {
  if (!isValid(date)) return '';

  const minutesAgo = differenceInMinutes(now, date);
  if (minutesAgo < 0) {
    if (isSameDay(date, now)) return `Today ${format(date, 'h:mm a')}`;
    if (isSameDay(date, addDays(now, 1))) return `Tomorrow ${format(date, 'h:mm a')}`;
    return format(date, 'd MMM, h:mm a');
  }
  if (minutesAgo < 1) return 'Just now';
  if (minutesAgo < 60) return `${minutesAgo}m ago`;

  const hoursAgo = differenceInHours(now, date);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  return format(date, 'd MMM, h:mm a');
}
