import { format, isSameYear, isToday } from 'date-fns';

/**
 * When a conversation's last message came, as the chat list shows it: "14:05" today, "7 Oct" earlier this year,
 * "7 Oct 2025" before that. The list showed only the time, so last week's message looked like today's.
 */
export function chatListTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  if (isToday(date)) return format(date, 'HH:mm');
  return format(date, isSameYear(date, now) ? 'd MMM' : 'd MMM yyyy');
}
