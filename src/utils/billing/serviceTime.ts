/**
 * How long a service took, as staff note it on the billing line ("45 minutes", "1 hour 30 min", "1.5 h"), for the codes
 * a practice charges by time (codeRules.ts). The visit asks for the note until it gives a time (lineRuleNotices), and
 * the claim gives the fund those minutes: field 18, the number of services, carries minutes on a time-based line
 * (claim specification; funds refuse such a line without them, QEDI rejection D036 "time in minutes missing").
 * Pure and without imports: the claim modules the edge functions import (Deno) use it.
 */

/** The longest a noted service can be: a day, in minutes (more is a typing slip, never sent to a fund) */
export const MAX_SERVICE_MINUTES = 24 * 60;

/** A time in a note: a number with its unit ("45 min", "1.5 h", "2hrs", "1,5 hours") */
const TIME_IN_NOTE = /\b(\d+(?:[.,]\d+)?)\s*(m|min|mins|minutes?|h|hrs?|hours?)\b/gi;

/**
 * The minutes a note gives, whole (half up): every time it names added up, hours as 60 minutes ("1 hour 30 minutes" is
 * 90). null when it names none, or adds up to no time or more than a day.
 */
export function minutesFromNote(text: string | null | undefined): number | null {
  let minutes = 0;
  let found = false;
  for (const match of (text ?? '').matchAll(TIME_IN_NOTE)) {
    const amount = Number(match[1].replace(',', '.'));
    minutes += match[2].toLowerCase().startsWith('h') ? amount * 60 : amount;
    found = true;
  }
  const whole = Math.round(minutes);
  return found && whole >= 1 && whole <= MAX_SERVICE_MINUTES ? whole : null;
}
