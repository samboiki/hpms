/**
 * The look of Messages' own panels (the SMS replies and app requests inboxes, SmsReplyCard.tsx), copied so the
 * Templates and Message log tabs look like the rest of Messages: white rounded cards, cyan action buttons, grey
 * borders.
 */

const BUTTON =
  'inline-flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60';
export const SECONDARY = `${BUTTON} border-gray-200 bg-white text-gray-700 hover:bg-gray-50`;
export const PRIMARY = `${BUTTON} border-cyan-600 bg-cyan-600 text-white hover:bg-cyan-700`;
export const DANGER = `${BUTTON} border-red-200 bg-white text-red-700 hover:bg-red-50`;

export const INPUT =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:bg-gray-50 disabled:text-gray-600';
export const LABEL = 'mb-1 block text-sm font-medium text-gray-800';
export const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm';

/** The selected / not selected look of the inbox filters ("Needs reply", "Handled", "All") */
export const FILTER = 'inline-flex min-h-[2.5rem] items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';
export const FILTER_ON = 'bg-cyan-600 text-white';
export const FILTER_OFF = 'text-gray-700 hover:bg-gray-100';

/** Puts `token` where the cursor is (replacing a selection) and says where the cursor goes after it. */
export function insertAt(text: string, start: number, end: number, token: string): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  return { text: `${text.slice(0, from)}${token}${text.slice(to)}`, caret: from + token.length };
}
