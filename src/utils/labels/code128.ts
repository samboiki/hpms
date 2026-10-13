/**
 * Code 128 barcodes (ISO/IEC 15417): the symbology every handheld scanner reads. Any printable ASCII text can be
 * encoded; runs of digits are packed two to a symbol (code set C), so numeric codes such as frame or stock numbers
 * stay short enough for small labels. Pure: encodeCode128 returns the bar pattern, barcodeSvg draws it.
 */

/**
 * Bar and space widths (in modules) of the 107 symbols, bar first: values 0-102, the start symbols (103 = start A,
 * 104 = start B, 105 = start C) and the stop symbol (106, which ends with a bar). Every symbol is 11 modules wide
 * (the stop 13) and its bars add up to an even number of modules: the tests check both, so a mistyped digit shows.
 */
const PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export const CODE128_PATTERNS = PATTERNS;

const START_B = 104;
const START_C = 105;
const STOP = 106;
/** In code set B: switch to C. In code set C: switch to B. */
const SWITCH_TO_C = 99;
const SWITCH_TO_B = 100;

/** The longest text a label barcode takes: longer codes would not fit any label at a width scanners read */
export const CODE128_MAX_LENGTH = 40;

export type BarcodeProblem = 'empty' | 'unsupported_character' | 'too_long';

export interface Code128 {
  /** The text encoded (what a scanner types) */
  text: string;
  /** Symbol values from the start symbol to the check symbol (the stop symbol is not listed) */
  values: number[];
  /** Bars and spaces one module each: '1' bar, '0' space; from the start symbol to the end of the stop symbol */
  modules: string;
}

export type Code128Result = { ok: true; code: Code128 } | { ok: false; problem: BarcodeProblem };

const isDigit = (char: string): boolean => char >= '0' && char <= '9';

function digitRunAt(text: string, index: number): number {
  let end = index;
  while (end < text.length && isDigit(text[end])) end += 1;
  return end - index;
}

/** The value of a character in code set B (printable ASCII 32-126) */
const valueInSetB = (char: string): number => char.charCodeAt(0) - 32;

/** What a scanner would refuse or a label cannot hold, in plain words */
export function barcodeProblemText(problem: BarcodeProblem): string {
  if (problem === 'empty') return 'There is no code to print.';
  if (problem === 'too_long') return `The code is longer than ${CODE128_MAX_LENGTH} characters.`;
  return 'The code has a character a barcode cannot hold (use letters, digits and ordinary signs).';
}

/**
 * Encodes text as Code 128. Starts in set C when the text opens with at least four digits (or is an even number of
 * digits), and switches to set C inside the text for a run of six digits or more, or four or more at the end.
 */
export function encodeCode128(text: string): Code128Result {
  if (text.length === 0) return { ok: false, problem: 'empty' };
  if (text.length > CODE128_MAX_LENGTH) return { ok: false, problem: 'too_long' };
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (char.length !== 1 || code < 32 || code > 126) return { ok: false, problem: 'unsupported_character' };
  }

  const values: number[] = [];
  const leadingDigits = digitRunAt(text, 0);
  let set: 'B' | 'C' = (leadingDigits === text.length && leadingDigits % 2 === 0) || leadingDigits >= 4 ? 'C' : 'B';
  values.push(set === 'C' ? START_C : START_B);

  let index = 0;
  while (index < text.length) {
    const run = digitRunAt(text, index);
    if (set === 'C') {
      if (run >= 2) {
        values.push(Number(text.slice(index, index + 2)));
        index += 2;
      } else {
        values.push(SWITCH_TO_B);
        set = 'B';
      }
      continue;
    }
    if ((run >= 4 && index + run === text.length) || run >= 6) {
      // An odd run: its first digit stays in set B, so the rest pairs up exactly
      if (run % 2 === 1) {
        values.push(valueInSetB(text[index]));
        index += 1;
      }
      values.push(SWITCH_TO_C);
      set = 'C';
      continue;
    }
    values.push(valueInSetB(text[index]));
    index += 1;
  }

  const checksum = values.reduce((sum, value, position) => sum + value * Math.max(position, 1), 0) % 103;
  values.push(checksum);

  let modules = '';
  for (const value of [...values, STOP]) {
    const widths = PATTERNS[value];
    for (let element = 0; element < widths.length; element += 1) {
      modules += (element % 2 === 0 ? '1' : '0').repeat(Number(widths[element]));
    }
  }
  return { ok: true, code: { text, values, modules } };
}

/** Clear space a scanner needs on each side of the bars, in modules */
export const QUIET_ZONE_MODULES = 10;
/** Narrowest bar most scanners still read reliably from a laser or thermal print */
export const MIN_MODULE_MM = 0.19;
/** Widest bar used: wider only makes the barcode longer, not easier to read */
export const MAX_MODULE_MM = 0.33;

/** The module width that fits the barcode (with its quiet zones) in `widthMm`, or null when it cannot fit readably */
export function moduleWidthFor(code: Code128, widthMm: number): number | null {
  const total = code.modules.length + 2 * QUIET_ZONE_MODULES;
  const width = Math.min(MAX_MODULE_MM, widthMm / total);
  return width >= MIN_MODULE_MM ? Math.floor(width * 1000) / 1000 : null;
}

/**
 * The barcode as an SVG element (bars only; the human-readable text is printed by the label). Sized in millimetres:
 * `moduleMm` per module and `heightMm` tall, quiet zones included. Consecutive bar modules are one rectangle.
 */
export function barcodeSvg(code: Code128, options: { moduleMm: number; heightMm: number }): string {
  const total = code.modules.length + 2 * QUIET_ZONE_MODULES;
  const widthMm = Math.round(total * options.moduleMm * 1000) / 1000;
  const bars: string[] = [];
  let start = -1;
  for (let position = 0; position <= code.modules.length; position += 1) {
    const bar = code.modules[position] === '1';
    if (bar && start < 0) start = position;
    if (!bar && start >= 0) {
      bars.push(`<rect x="${start + QUIET_ZONE_MODULES}" y="0" width="${position - start}" height="1"/>`);
      start = -1;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${options.heightMm}mm" viewBox="0 0 ${total} 1" `
    + `preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="Barcode">`
    + `<rect x="0" y="0" width="${total}" height="1" fill="#fff"/><g fill="#000">${bars.join('')}</g></svg>`;
}
