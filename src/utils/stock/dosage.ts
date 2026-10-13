/**
 * Dispensing directions: the shorthand a practitioner types ("1 tds pc x7d") turned into the plain label text a
 * patient reads ("Take 1 tablet three times a day after meals for 7 days."), plus how many units a day that is, so
 * the days of medicine (and the day a repeat falls due) can be worked out.
 *
 * Anything not recognised is kept in the text as typed and listed in `unknown`, so the screen can ask the person to
 * check the label: a word is never dropped from a patient's instructions.
 */

export interface Directions {
  /** The label text, e.g. "Take 1 three times a day." ('' when nothing was typed) */
  text: string;
  /** Units per dose (the larger number of a range such as 1-2); null when no dose was given */
  dose: number | null;
  /** Doses a day (every 8 hours = 3); null for "when needed" alone, "now" and anything without a frequency */
  dosesPerDay: number | null;
  /** Units a day (dose x doses a day), null when either is unknown */
  unitsPerDay: number | null;
  /** Days, when the shorthand says how long ("x7d", "7/7", "2/52") */
  days: number | null;
  /** "when needed" (prn): the daily figure is the most, not the usual */
  asNeeded: boolean;
  /** Words that were not recognised (shown back to the person) */
  unknown: string[];
}

interface Frequency {
  text: string;
  perDay: number | null;
}

const FREQUENCIES: Readonly<Record<string, Frequency>> = {
  od: { text: 'once a day', perDay: 1 },
  daily: { text: 'once a day', perDay: 1 },
  qd: { text: 'once a day', perDay: 1 },
  bd: { text: 'twice a day', perDay: 2 },
  bid: { text: 'twice a day', perDay: 2 },
  tds: { text: 'three times a day', perDay: 3 },
  tid: { text: 'three times a day', perDay: 3 },
  qid: { text: 'four times a day', perDay: 4 },
  qds: { text: 'four times a day', perDay: 4 },
  mane: { text: 'in the morning', perDay: 1 },
  om: { text: 'in the morning', perDay: 1 },
  nocte: { text: 'at night', perDay: 1 },
  hs: { text: 'at bedtime', perDay: 1 },
  qhs: { text: 'at bedtime', perDay: 1 },
  weekly: { text: 'once a week', perDay: 1 / 7 },
  stat: { text: 'now (one dose)', perDay: null }
};

const TIMINGS: Readonly<Record<string, string>> = {
  ac: 'before meals',
  pc: 'after meals',
  cc: 'with meals',
  wf: 'with food'
};

/** Dose units: the word on the label for one and for several */
const UNITS: ReadonlyArray<{ match: RegExp; one: string; many: string; verb?: string }> = [
  { match: /^(tab|tabs|tablet|tablets)$/, one: 'tablet', many: 'tablets' },
  { match: /^(cap|caps|capsule|capsules)$/, one: 'capsule', many: 'capsules' },
  { match: /^(ml|mls)$/, one: 'ml', many: 'ml' },
  { match: /^(puff|puffs)$/, one: 'puff', many: 'puffs', verb: 'Inhale' },
  { match: /^(drop|drops|gtt|gtts)$/, one: 'drop', many: 'drops', verb: 'Put' },
  { match: /^(sachet|sachets)$/, one: 'sachet', many: 'sachets' },
  { match: /^(supp|supps|suppository|suppositories)$/, one: 'suppository', many: 'suppositories', verb: 'Insert' },
  { match: /^(patch|patches)$/, one: 'patch', many: 'patches', verb: 'Apply' },
  { match: /^(unit|units|iu)$/, one: 'unit', many: 'units', verb: 'Use' },
  { match: /^(g|gram|grams)$/, one: 'g', many: 'g' },
  { match: /^(mg)$/, one: 'mg', many: 'mg' }
];

/** Routes and places that change the verb or add where it goes */
const ROUTES: Readonly<Record<string, { verb: string; where?: string }>> = {
  po: { verb: 'Take' },
  top: { verb: 'Apply' },
  apply: { verb: 'Apply' },
  inh: { verb: 'Inhale' },
  pr: { verb: 'Insert', where: 'into the back passage' },
  pv: { verb: 'Insert', where: 'into the vagina' },
  eye: { verb: 'Put', where: 'in the eye' },
  eyes: { verb: 'Put', where: 'in both eyes' },
  ear: { verb: 'Put', where: 'in the ear' },
  ears: { verb: 'Put', where: 'in both ears' },
  nose: { verb: 'Spray', where: 'into each nostril' }
};

/** Ordinary words that may sit in the directions without being flagged ("with water") */
const PLAIN_WORDS = new Set(['with', 'and', 'the', 'of', 'in', 'to', 'for', 'food', 'water', 'meals', 'at', 'a', 'an', 'if', 'as', 'or',
  'take', 'pain', 'fever', 'needed', 'before', 'after', 'each', 'every', 'day', 'days', 'night', 'morning', 'sleep', 'swallow', 'whole',
  'chew', 'dissolve', 'shake', 'well', 'avoid', 'alcohol', 'until', 'finished', 'complete', 'course']);

const unitFor = (word: string) => UNITS.find(unit => unit.match.test(word)) ?? null;

/** Directions typed out in words ("Take one tablet...") are used as written */
const PLAIN_START = new Set(['take', 'apply', 'put', 'use', 'insert', 'inhale', 'spray', 'give', 'chew', 'dissolve', 'swallow']);

/**
 * "1tds" -> ["1", "tds"], "5ml" -> ["5", "ml"], "2puffs" -> ["2", "puffs"], "t.d.s." -> ["tds"]; durations ("x7d",
 * "7/7") stay whole
 */
function tokens(input: string): string[] {
  const out: string[] = [];
  const words = input.toLowerCase().replace(/[,;]+/g, ' ').split(/\s+/).filter(Boolean)
    .map(word => word.replace(/(?<=[a-z])\.|\.(?=[a-z])|\.$/g, ''))
    .filter(Boolean);
  for (const raw of words) {
    const glued = /^(\d+(?:\.\d+)?|½)([a-z]+)$/.exec(raw);
    if (glued && !/^(d|day|days|w|wk|wks|week|weeks|m|month|months)$/.test(glued[2])) {
      out.push(glued[1], glued[2]);
    } else {
      out.push(raw);
    }
  }
  return out;
}

/** "x7d" / "7d" / "7/7" -> 7, "2/52" / "x2w" -> 14, "1/12" / "x1m" -> 30 */
function durationDays(token: string): number | null {
  const fraction = /^x?(\d+)\/(7|52|12)$/.exec(token);
  if (fraction) {
    const count = Number(fraction[1]);
    return fraction[2] === '7' ? count : fraction[2] === '52' ? count * 7 : count * 30;
  }
  const plain = /^x(\d+)(d|day|days|w|wk|wks|week|weeks|m|month|months)?$|^(\d+)(d|day|days|w|wk|wks|week|weeks|m|month|months)$/.exec(token);
  if (!plain) return null;
  const count = Number(plain[1] ?? plain[3]);
  const unit = plain[2] ?? plain[4] ?? 'd';
  if (unit.startsWith('w')) return count * 7;
  if (unit.startsWith('m')) return count * 30;
  return count;
}

/** "every 6 hours" from q6h, 6h, 6hrly, 6-hourly */
function hourly(token: string): Frequency | null {
  const match = /^q?(\d{1,2})(?:h|hr|hrs|hrly|-hourly|hourly)$/.exec(token);
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours < 1 || hours > 24) return null;
  return { text: hours === 24 ? 'once a day' : `every ${hours} hours`, perDay: 24 / hours };
}

const describeDays = (days: number): string =>
  days % 30 === 0 && days >= 30 ? `${days / 30} month${days === 30 ? '' : 's'}`
    : days % 7 === 0 && days >= 14 ? `${days / 7} weeks`
      : `${days} day${days === 1 ? '' : 's'}`;

/** "1", "1 to 2", "half a" (before a unit) or "half" */
const formatDose = (low: number, high: number | null, withUnit: boolean): string => {
  if ((high === null || high === low) && low === 0.5) return withUnit ? 'half a' : 'half';
  const show = (value: number) => (value === 0.5 ? 'half' : String(value));
  return high !== null && high !== low ? `${show(low)} to ${show(high)}` : show(low);
};

const sentenceCase = (text: string): string => {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}${/[.!?]$/.test(trimmed) ? '' : '.'}`;
};

/**
 * Turns dispensing shorthand into label text. `unit` is the stock item's unit ("tablet", "capsule", "ml"): it is
 * added after the dose when the shorthand names none ("1 tds" for capsules -> "Take 1 capsule three times a day.").
 */
export function parseDirections(input: string, options: { unit?: string | null } = {}): Directions {
  const words = tokens(input.trim());
  const hasShorthand = words.some(word => FREQUENCIES[word] || hourly(word) || TIMINGS[word] || word === 'prn' || durationDays(word) !== null);
  if (words.length > 0 && PLAIN_START.has(words[0]) && !hasShorthand) {
    // Already written out: printed as typed; the days of medicine are then entered by hand
    return { text: sentenceCase(input), dose: null, dosesPerDay: null, unitsPerDay: null, days: null, asNeeded: false, unknown: [] };
  }
  let low: number | null = null;
  let high: number | null = null;
  let unitWords: { one: string; many: string } | null = null;
  let verb: string | null = null;
  let where: string | null = null;
  let frequency: Frequency | null = null;
  let timing: string | null = null;
  let asNeeded = false;
  let days: number | null = null;
  const rest: string[] = [];
  const unknown: string[] = [];

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const range = /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(word);
    if (low === null && (/^\d+(?:\.\d+)?$/.test(word) || word === '½' || word === '1/2' || range)) {
      // "x 7 days": a number after "x" or "for" is a duration, not a dose
      const next = words[i + 1] ?? '';
      if (/^(d|day|days|w|wk|wks|week|weeks|m|month|months)$/.test(next) && (words[i - 1] === 'x' || words[i - 1] === 'for')) {
        days = durationDays(`${word}${next.charAt(0)}`);
        i += 1;
        continue;
      }
      if (range) {
        low = Number(range[1]);
        high = Number(range[2]);
      } else {
        low = word === '½' || word === '1/2' ? 0.5 : Number(word);
      }
      continue;
    }
    const unit = unitFor(word);
    if (unit && low !== null && !unitWords) {
      unitWords = unit;
      verb = verb ?? unit.verb ?? null;
      continue;
    }
    if (FREQUENCIES[word] && !frequency) {
      frequency = FREQUENCIES[word];
      continue;
    }
    const everyHours = hourly(word);
    if (everyHours && !frequency) {
      frequency = everyHours;
      continue;
    }
    if (word === 'prn') {
      asNeeded = true;
      continue;
    }
    if (TIMINGS[word] && !timing) {
      timing = TIMINGS[word];
      continue;
    }
    if (ROUTES[word]) {
      verb = ROUTES[word].verb;
      where = ROUTES[word].where ?? where;
      continue;
    }
    const duration = durationDays(word);
    if (duration !== null && days === null) {
      days = duration;
      continue;
    }
    if (word === 'x' || word === 'for') {
      const next = words[i + 1] ?? '';
      const nextDays = durationDays(next) ?? (/^\d+$/.test(next) ? durationDays(`${next}${(words[i + 2] ?? 'd').charAt(0)}`) : null);
      if (nextDays !== null && days === null) {
        days = nextDays;
        i += /^\d+$/.test(next) && /^(d|day|days|w|wk|wks|week|weeks|m|month|months)$/.test(words[i + 2] ?? '') ? 2 : 1;
        continue;
      }
    }
    rest.push(word);
    if (!PLAIN_WORDS.has(word)) unknown.push(word);
  }

  if (words.length === 0) {
    return { text: '', dose: null, dosesPerDay: null, unitsPerDay: null, days: null, asNeeded: false, unknown: [] };
  }

  // The item's own unit when the shorthand gave a dose but no unit ("1 tds" for capsules)
  if (!unitWords && low !== null && options.unit) {
    const itemUnit = unitFor(options.unit.trim().toLowerCase());
    if (itemUnit) {
      unitWords = itemUnit;
      verb = verb ?? itemUnit.verb ?? null;
    }
  }

  const doseValue = high ?? low;
  const parts: string[] = [verb ?? 'Take'];
  if (low !== null) {
    parts.push(formatDose(low, high, unitWords !== null));
    if (unitWords) parts.push(doseValue !== null && doseValue > 1 ? unitWords.many : unitWords.one);
  }
  if (where) parts.push(where);
  if (frequency) parts.push(frequency.text);
  if (timing) parts.push(timing);
  if (asNeeded) parts.push('when needed');
  if (days !== null) parts.push(`for ${describeDays(days)}`);
  if (rest.length > 0) parts.push(rest.join(' '));
  const text = sentenceCase(parts.join(' '));

  const dosesPerDay = frequency?.perDay ?? null;
  return {
    text,
    dose: doseValue,
    dosesPerDay,
    unitsPerDay: doseValue !== null && dosesPerDay !== null ? doseValue * dosesPerDay : null,
    days,
    asNeeded,
    unknown
  };
}

/**
 * How many days the medicine lasts: the quantity at the daily dose (rounded down, so a repeat falls due as the last
 * dose is taken, not after), never longer than a course the directions give ("x7d"). Null when it cannot be worked
 * out ("when needed" alone, "now", no frequency): such a medicine gets no due day for its repeat.
 */
export function daysOfMedicine(quantity: number, directions: Pick<Directions, 'unitsPerDay' | 'days'>): number | null {
  const fromQuantity = directions.unitsPerDay && directions.unitsPerDay > 0 && quantity > 0
    ? Math.max(1, Math.floor(quantity / directions.unitsPerDay))
    : null;
  if (fromQuantity !== null && directions.days !== null) return Math.min(fromQuantity, directions.days);
  return fromQuantity ?? directions.days;
}

const PRESCRIPTION_FREQUENCIES: Readonly<Record<string, string>> = {
  'once daily': 'od',
  'twice daily': 'bd',
  '3 times daily': 'tds',
  'three times daily': 'tds',
  '4 times daily': 'qid',
  'four times daily': 'qid',
  'every 4 hours': 'q4h',
  'every 6 hours': 'q6h',
  'every 8 hours': 'q8h',
  'every 12 hours': 'q12h',
  'morning only': 'mane',
  'evening only': 'nocte',
  'with meals': 'cc',
  'before meals': 'ac',
  'as needed': 'prn',
  weekly: 'weekly'
};

/**
 * Shorthand to start from when a prescribed medicine is dispensed, from the visit's medication line ("500mg",
 * "3 times daily", "7 days" -> "1 tds x7d"; "5ml", "Twice daily" -> "5ml bd"). Null when the frequency is not one
 * the shorthand knows: the person then types the directions. A strength (mg) is not a number of tablets, so the
 * dose starts at 1 and the label preview shows it for checking.
 */
export function shorthandFromPrescription(prescription: { dosage?: string | null; frequency?: string | null; duration?: string | null }): string | null {
  const frequency = PRESCRIPTION_FREQUENCIES[(prescription.frequency ?? '').trim().toLowerCase()];
  if (!frequency) return null;
  const volume = /^(\d+(?:\.\d+)?)\s*ml$/i.exec((prescription.dosage ?? '').trim());
  const dose = volume ? `${volume[1]}ml` : '1';
  const duration = /^(\d+)\s*(day|days|week|weeks|month|months)$/i.exec((prescription.duration ?? '').trim());
  const course = duration ? ` x${duration[1]}${duration[2].charAt(0).toLowerCase()}` : '';
  return `${dose} ${frequency}${course}`;
}
