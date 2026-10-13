/**
 * Reading the values of an Eminance export: dates, amounts, account numbers, sex, relationship, names and language.
 *
 * Exports come from a South African build used in Namibia, so dates are written day first (07/10/2026), year first
 * (2026/10/07, Firebird's own form), compactly (20261007, as in claim files) or by Excel as a date or serial number;
 * amounts may use a decimal comma ("1 234,56"), and credits show as "-12.00", "12.00-", "(12.00)" or "12.00 CR".
 */
import { addDaysToKey, isValidDateKey, toDateKey } from '../billing/dates';
import { toCents } from '../billing/money';
import { cellText, type Cell } from '../billing/tariffImport';
import { relationshipOption } from '../patients/medicalAidMember';
import { normalizePhoneNumber } from '../../components/patients/patientContact';

/** A cell as trimmed text with single spaces, cut to `max` characters */
export function cleanText(cell: Cell, max = 200): string {
  return cellText(cell).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** The key a raw value is grouped by when staff choose what it means ("NMC01 " and "nmc01" are one value) */
export const valueKey = (raw: string): string => raw.replace(/\s+/g, ' ').trim().toLowerCase();

const pad2 = (value: number): string => String(value).padStart(2, '0');

const MONTHS: Readonly<Record<string, number>> = {
  jan: 1, january: 1, januarie: 1, feb: 2, february: 2, februarie: 2, mar: 3, march: 3, mrt: 3, maart: 3, apr: 4, april: 4,
  may: 5, mei: 5, jun: 6, june: 6, junie: 6, jul: 7, july: 7, julie: 7, aug: 8, august: 8, augustus: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12, des: 12, desember: 12
};

/**
 * 'past': a two-digit year is the latest year that is not in the future (a date of birth "05/03/45" is 1945).
 * 'near': it is in this century (a recall "05/03/27" is 2027).
 */
export type TwoDigitYears = 'past' | 'near';

const fullYear = (year: string, mode: TwoDigitYears, today: string): number => {
  if (year.length === 4) return Number(year);
  const candidate = 2000 + Number(year);
  if (mode === 'near') return candidate;
  return candidate <= Number(today.slice(0, 4)) ? candidate : candidate - 100;
};

const dateKeyOf = (year: number, month: number, day: number): string | null => {
  const key = `${year}-${pad2(month)}-${pad2(day)}`;
  return isValidDateKey(key) ? key : null;
};

/**
 * An Excel serial date: day 1 is 1 Jan 1900, and Excel counts a 29 Feb 1900 that never was, so from day 61 on the
 * serial is two more than the days since 1 Jan 1900.
 */
const excelSerialToKey = (serial: number): string | null =>
  Number.isInteger(serial) && serial > 0 && serial < 300000 ? addDaysToKey('1900-01-01', serial >= 61 ? serial - 2 : serial - 1) : null;

/** A date cell as 'yyyy-MM-dd', or null when it is empty or not a real date */
export function parseImportDate(cell: Cell, today: string, mode: TwoDigitYears = 'past'): string | null {
  if (cell instanceof Date) return toDateKey(cell);
  if (typeof cell === 'number') {
    const compact = toDateKey(String(cell));
    return compact ?? excelSerialToKey(cell);
  }
  const text = cellText(cell).trim();
  if (!text) return null;
  const direct = toDateKey(text);
  if (direct) return direct;

  let match = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})(?:[\sT].*)?$/.exec(text);
  if (match) return dateKeyOf(Number(match[1]), Number(match[2]), Number(match[3]));

  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?:\s.*)?$/.exec(text);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = fullYear(match[3], mode, today);
    // Day first, as Namibia writes dates; only a second number above 12 shows a month-first (US) date
    return second > 12 && first <= 12 ? dateKeyOf(year, first, second) : dateKeyOf(year, second, first);
  }

  match = /^(\d{1,2})[\s/-]+([A-Za-z]{3,})[\s/,-]+(\d{4}|\d{2})(?:\s.*)?$/.exec(text);
  if (match && MONTHS[match[2].toLowerCase()]) {
    return dateKeyOf(fullYear(match[3], mode, today), MONTHS[match[2].toLowerCase()], Number(match[1]));
  }
  match = /^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})(?:\s.*)?$/.exec(text);
  if (match && MONTHS[match[1].toLowerCase()]) {
    return dateKeyOf(Number(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]));
  }
  if (/^\d{5}$/.test(text)) return excelSerialToKey(Number(text));
  return null;
}

/**
 * An amount cell in whole cents (negative for a credit), or null when it is empty or not an amount.
 * "1 234,56" and "1,234.56" are both N$ 1 234.56; "(12.00)", "12.00-" and "12.00 CR" are credits.
 */
export function parseMoneyCents(cell: Cell): number | null {
  if (typeof cell === 'number') return Number.isFinite(cell) ? toCents(cell) : null;
  let text = cellText(cell).replace(/[\s\u00A0]/g, '');
  if (!text || text === '-') return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/cr$/i.test(text)) {
    negative = true;
    text = text.slice(0, -2);
  } else if (/dr$/i.test(text)) {
    text = text.slice(0, -2);
  }
  if (text.endsWith('-')) {
    negative = !negative;
    text = text.slice(0, -1);
  }
  text = text.replace(/^(N\$|NAD|R)/i, '');
  if (text.startsWith('-')) {
    negative = !negative;
    text = text.slice(1);
  }
  text = text.replace(/^(N\$|NAD|R)/i, '');
  const lastComma = text.lastIndexOf(',');
  const lastDot = text.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Both: the later one is the decimal sign
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (lastComma >= 0) {
    text = /^\d+,\d{1,2}$/.test(text) ? text.replace(',', '.') : text.replace(/,/g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const cents = toCents(Number(text));
  return negative ? -cents : cents;
}

/**
 * The account number as Eminance shows it. Numeric numbers are 7 digits with leading zeros (Excel drops them:
 * 1234 is account 0001234); others (a prefix and a number, or surname letters) are kept in capitals.
 */
export function canonicalAccountNumber(cell: Cell): string {
  let text = typeof cell === 'number' && Number.isInteger(cell) ? String(cell) : cellText(cell);
  text = text.replace(/\s+/g, '').toUpperCase();
  if (/^\d+\.0+$/.test(text)) text = text.replace(/\.0+$/, '');
  return /^\d{1,7}$/.test(text) ? text.padStart(7, '0') : text;
}

/** The same account whatever the zeros: "0001234", "1234" and "001234" match */
export const accountKey = (account: string): string => (/^\d+$/.test(account) ? String(Number(account)) : account.toUpperCase());

export type Sex = 'male' | 'female' | 'other';

/** M / F / Male / Female, and Eminance's Afrikaans M / V (manlik, vroulik); numbers and anything else: null */
export function readSex(cell: Cell): Sex | null {
  const text = cleanText(cell).toLowerCase().replace(/\.$/, '');
  if (['m', 'male', 'man', 'manlik'].includes(text)) return 'male';
  if (['f', 'female', 'woman', 'v', 'vroulik', 'vrou'].includes(text)) return 'female';
  if (['o', 'other', 'ander'].includes(text)) return 'other';
  return null;
}

/** The sex a title names (Mr, Mrs, Ms, Miss and the Afrikaans Mnr, Mev, Mej); null for Dr, Prof and the like */
export function sexFromTitle(cell: Cell): Sex | null {
  const text = cleanText(cell).toLowerCase().replace(/\./g, '');
  if (['mr', 'mnr', 'master', 'meneer'].includes(text)) return 'male';
  if (['mrs', 'ms', 'miss', 'mev', 'mej', 'me', 'mevrou', 'mejuffrou'].includes(text)) return 'female';
  return null;
}

export type Relationship = 'self' | 'spouse' | 'child' | 'parent' | 'other';

/**
 * The relationship to the main member written in words (English or Afrikaans); null when empty or a number (a code
 * whose meaning staff choose in the wizard). The meaning of English words is relationshipOption's, as on the forms.
 */
export function readRelationship(cell: Cell): Relationship | null {
  const text = cleanText(cell).toLowerCase();
  if (!text || /^\d+$/.test(text)) return null;
  if (['hooflid', 'lid', 'main', 'mainmember', 'main member', 'principal member'].includes(text)) return 'self';
  if (['eggenoot', 'eggenote', 'gade'].includes(text)) return 'spouse';
  if (['kind', 'seun', 'dogter'].includes(text)) return 'child';
  if (['ouer', 'vader', 'moeder', 'father', 'mother'].includes(text)) return 'parent';
  return relationshipOption(text) || null;
}

const TITLES = new Set(['MR', 'MRS', 'MS', 'MISS', 'DR', 'PROF', 'REV', 'MNR', 'MEV', 'MEJ', 'ME', 'DS', 'ADV']);
const SURNAME_PARTICLES = new Set(['VAN', 'VON', 'DER', 'DEN', 'DE', 'DU', 'LE', 'LA', 'TER', 'TEN', 'DA', 'DOS', 'DAS']);

/** "SHILONGO, Ndapewa Maria" or "Ndapewa Maria Shilongo" or "Mr Pieter van der Merwe" -> first names and surname */
export function splitFullName(raw: string): { firstName: string; surname: string } {
  const text = raw.replace(/\s+/g, ' ').trim();
  const words = (part: string) => part.split(' ').filter(word => word && !TITLES.has(word.replace(/\./g, '').toUpperCase()));
  if (text.includes(',')) {
    const [surnamePart, ...rest] = text.split(',');
    return { surname: words(surnamePart).join(' '), firstName: words(rest.join(' ')).join(' ') };
  }
  const parts = words(text);
  if (parts.length <= 1) return { firstName: '', surname: parts[0] ?? '' };
  let start = parts.length - 1;
  while (start > 1 && SURNAME_PARTICLES.has(parts[start - 1].toUpperCase())) start -= 1;
  return { firstName: parts.slice(0, start).join(' '), surname: parts.slice(start).join(' ') };
}

/** patients.home_language accepts English, Afrikaans, Oshiwambo and Other; a code number is not a language */
export function readLanguage(cell: Cell): 'English' | 'Afrikaans' | 'Oshiwambo' | 'Other' | null {
  const text = cleanText(cell).toLowerCase();
  if (!text || /^\d+$/.test(text)) return null;
  if (['e', 'eng', 'english', 'engels'].includes(text)) return 'English';
  if (['a', 'afr', 'afrikaans'].includes(text)) return 'Afrikaans';
  if (['oshiwambo', 'oshivambo', 'owambo', 'ovambo', 'oshindonga', 'oshikwanyama'].includes(text)) return 'Oshiwambo';
  return 'Other';
}

/** A Namibian mobile number (08x): a phone column is only used as the cell number when it is one */
export function isMobileNumber(raw: string): boolean {
  return (normalizePhoneNumber(raw) ?? '').startsWith('+2648');
}

export const isPlausibleEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
