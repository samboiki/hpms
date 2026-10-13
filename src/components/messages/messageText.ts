import { format } from 'date-fns';

/**
 * Helpers for the text of SMS and email messages sent to patients from the message modals.
 */

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Replaces {{variables}} that have a real value. A variable with no value stays in the text, so
 * the person sending sees it and fills it in, instead of the patient receiving a blank or a
 * made-up value.
 */
export function fillPlaceholders(
  text: string,
  values: Readonly<Record<string, string | null | undefined>>
): string {
  return text.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = Object.prototype.hasOwnProperty.call(values, name) ? values[name] : undefined;
    return value ? value : placeholder;
  });
}

/** Lists each {{variable}} still in the text once, skipping the variable names in `ignore`. */
export function findPlaceholders(text: string, ignore: readonly string[] = []): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER)) {
    if (!ignore.includes(match[1]) && !found.includes(match[0])) found.push(match[0]);
  }
  return found;
}

/** Dates in patient messages are written day-month-year, e.g. "6 October 2026". */
export function formatMessageDate(date: Date): string {
  return format(date, 'd MMMM yyyy');
}

// GSM 03.38: the alphabet an SMS uses when the message has no other characters
const GSM7_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?' +
  '¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
// These are sent as an escape plus the character, so each one uses two places
const GSM7_EXTENDED = '\f^{}\\[~]|€';

export interface SmsLength {
  /** Places the message uses (an extended GSM character uses two, an emoji uses two). */
  used: number;
  /** SMS parts the message is sent and charged as; 0 for an empty message. */
  parts: number;
  /** Places available in that many parts. */
  capacity: number;
}

/**
 * Works out how many SMS parts a message is charged as. A plain-alphabet message fits 160
 * places in one SMS and 153 per part when longer. One emoji or other special character switches
 * the whole message to unicode: 70 places in one SMS, 67 per part.
 */
export function getSmsLength(text: string): SmsLength {
  let gsmUsed = 0;
  let isGsm = true;
  for (const char of text) {
    if (GSM7_BASIC.includes(char)) gsmUsed += 1;
    else if (GSM7_EXTENDED.includes(char)) gsmUsed += 2;
    else {
      isGsm = false;
      break;
    }
  }
  const used = isGsm ? gsmUsed : text.length;
  const single = isGsm ? 160 : 70;
  const perPart = isGsm ? 153 : 67;
  if (used === 0) return { used, parts: 0, capacity: single };
  if (used <= single) return { used, parts: 1, capacity: single };
  const parts = Math.ceil(used / perPart);
  return { used, parts, capacity: parts * perPart };
}
