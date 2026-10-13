/**
 * Small, exact helpers shared by the remittance parsers and the matcher. Pure: no I/O.
 *
 * Amounts are parsed from their text into whole cents without going through floating point, so
 * "1,234.56" is exactly 123456. Dates come in several shapes (dd-mm-yy on Methealth statements,
 * dd/mm/yyyy on Medscheme advices and CSVs, yyyymmdd in claim files) and all become yyyy-MM-dd.
 */
import { isValidDateKey } from '../billing/dates';

/**
 * Cents from an amount as printed: "1,234.56", "999.9", " 0.00", "-12.50", "(12.50)", "12.50-",
 * "R1234.56", "N$ 45". Null for anything that is not an amount (so a stray word never becomes 0).
 */
export function parseAmountCents(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let text = String(raw).trim().replace(/\s+/g, '');
  if (!text) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  }
  text = text.replace(/^(N\$|NAD|R)/i, '');
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  }
  // Thousands separators only in their proper places ("1,234.56", never "12,34")
  if (text.includes(',')) {
    if (!/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(text)) return null;
    text = text.replace(/,/g, '');
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return negative && cents !== 0 ? -cents : cents;
}

/** True when the text is an amount with 1-2 decimals (columns of money, not codes or counts) */
export const looksLikeAmount = (raw: string): boolean => /^\(?-?(N\$|R)?-?[\d,]*\d\.\d{1,2}-?\)?$/.test(raw.trim().replace(/\s+/g, ''));

const pad2 = (value: string): string => value.padStart(2, '0');

/**
 * A yyyy-MM-dd key from "dd/mm/yyyy", "dd-mm-yyyy", "dd.mm.yyyy", "dd-mm-yy", "yyyymmdd" or
 * "yyyy-mm-dd"; null when the text is not a real date. Two-digit years are 20yy (fund documents
 * only carry service and payment dates, never dates of birth).
 */
export function parseDateKey(raw: string | null | undefined): string | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  let key: string | null = null;
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
  if (m) key = `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  if (!key && (m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(text))) key = `20${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
  if (!key && (m = /^(\d{4})(\d{2})(\d{2})$/.exec(text))) key = `${m[1]}-${m[2]}-${m[3]}`;
  if (!key && (m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text))) key = `${m[1]}-${m[2]}-${m[3]}`;
  return key && isValidDateKey(key) ? key : null;
}

export const isDateText = (raw: string): boolean => parseDateKey(raw) !== null;

/**
 * The tariff code as staff know it: Methealth pads codes to 5 characters with a leading zero
 * ("08109" is 8109, "00190" is 0190); everything else is kept as printed (upper case).
 */
export function displayTariff(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  return /^0\d{4}$/.test(text) ? text.slice(1) : text;
}

/**
 * The key two tariff codes are compared on: numeric codes without leading zeros ("08109", "8109"
 * and "008109" are one code; "0190" and "190" too), other codes (NAPPI with letters, GMED) upper case.
 */
export function tariffKey(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^\d+$/.test(text)) return text.replace(/^0+(?=\d)/, '');
  return text;
}

/** Membership numbers and references compared as digits without leading zeros ("0000123" = "123") */
export function numberKey(raw: string | null | undefined): string {
  const compact = String(raw ?? '').trim().toUpperCase().replace(/[\s/.-]/g, '');
  if (/^\d+$/.test(compact)) return compact.replace(/^0+(?=\d)/, '');
  return compact.replace(/[^A-Z0-9]/g, '');
}

const TITLES = new Set(['MR', 'MRS', 'MS', 'MISS', 'DR', 'PROF', 'REV', 'MSTR', 'MASTER', 'MNR', 'MEV', 'MEJ', 'ME', 'BABY', 'INF']);

/** Upper-case name words without titles or punctuation: "Mrs N. Shilongo" -> ["N", "SHILONGO"] */
export function nameTokens(name: string | null | undefined): string[] {
  return String(name ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z\s'-]/g, ' ')
    .split(/[\s'-]+/)
    .filter(word => word && !TITLES.has(word) && !/^\?+$/.test(word));
}

/**
 * How alike two names are, 0 (nothing in common) to 1, for choosing between family members seen on
 * the same day. Full words count fully; an initial counts when it starts a word of the other name
 * ("N SHILONGO" and "NDAPEWA SHILONGO" are alike).
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const left = nameTokens(a);
  const right = nameTokens(b);
  if (left.length === 0 || right.length === 0) return 0;
  const [short, long] = left.length <= right.length ? [left, right] : [right, left];
  let score = 0;
  const used = new Set<number>();
  for (const word of short) {
    let best = -1;
    let bestScore = 0;
    long.forEach((other, index) => {
      if (used.has(index)) return;
      const value = word === other ? 1 : (word.length === 1 || other.length === 1) && word[0] === other[0] ? 0.5 : 0;
      if (value > bestScore) {
        bestScore = value;
        best = index;
      }
    });
    if (best >= 0) {
      used.add(best);
      score += bestScore;
    }
  }
  return score / short.length;
}

/**
 * One CSV record into fields: commas separate, double quotes protect commas and quotes ("" is a
 * quote). Fields are returned as written (the caller trims; fund CSVs pad values with spaces).
 */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"' && current.trim() === '') {
      quoted = true;
      current = '';
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Text lines of a CSV or report, without a byte-order mark, CR or trailing empty lines */
export function textLines(text: string): string[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines;
}

/** The last 4 digits of an account number; null when there are none */
export function last4(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  return digits ? digits.slice(-4) : null;
}

/** Sum of cents, treating missing values as 0 */
export const sumOf = (values: ReadonlyArray<number | null | undefined>): number =>
  values.reduce<number>((total, value) => total + (value ?? 0), 0);
