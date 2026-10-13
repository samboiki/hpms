import { describe, expect, it } from 'vitest';
import { CODE128_MAX_LENGTH, CODE128_PATTERNS, QUIET_ZONE_MODULES, barcodeSvg, encodeCode128, moduleWidthFor, type Code128 } from '../code128';

/** Module string ('1' bar, '0' space) of one symbol, from its widths */
const bits = (widths: string): string =>
  widths.split('').map((width, at) => (at % 2 === 0 ? '1' : '0').repeat(Number(width))).join('');

/**
 * Reads the bars back the way a scanner does: symbol by symbol, through code sets B and C, checking the check
 * symbol. Written from the standard independently of the encoder, so a wrong set switch or checksum fails here.
 */
function scan(modules: string): string {
  const symbols: number[] = [];
  let at = 0;
  while (at < modules.length) {
    const width = modules.length - at === 13 ? 13 : 11;
    const chunk = modules.slice(at, at + width);
    const value = CODE128_PATTERNS.findIndex(pattern => bits(pattern) === chunk);
    if (value < 0) throw new Error(`unreadable symbol at module ${at}`);
    symbols.push(value);
    at += width;
  }
  if (symbols.pop() !== 106) throw new Error('no stop symbol');
  const check = symbols.pop() as number;
  const sum = symbols.reduce((total, value, position) => total + value * Math.max(position, 1), 0);
  if (sum % 103 !== check) throw new Error('check symbol wrong');
  let set = symbols[0] === 105 ? 'C' : symbols[0] === 104 ? 'B' : 'A';
  let text = '';
  for (const value of symbols.slice(1)) {
    if (set === 'C') {
      if (value === 100) set = 'B';
      else text += String(value).padStart(2, '0');
    } else if (value === 99) set = 'C';
    else text += String.fromCharCode(value + 32);
  }
  return text;
}

const encoded = (text: string): Code128 => {
  const result = encodeCode128(text);
  if (!result.ok) throw new Error(result.problem);
  return result.code;
};

describe('Code 128 symbol table', () => {
  it('has 107 symbols, each 11 modules wide (the stop 13) with an even number of bar modules, so a mistyped width cannot slip in', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    CODE128_PATTERNS.forEach((pattern, value) => {
      const widths = pattern.split('').map(Number);
      expect(widths.reduce((sum, width) => sum + width, 0)).toBe(value === 106 ? 13 : 11);
      expect(widths.filter((_, at) => at % 2 === 0).reduce((sum, width) => sum + width, 0) % 2).toBe(0);
    });
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
  });

  it('matches the published bar patterns of the start, stop and common symbols', () => {
    expect(bits(CODE128_PATTERNS[0])).toBe('11011001100');
    expect(bits(CODE128_PATTERNS[16])).toBe('10011101100');
    expect(bits(CODE128_PATTERNS[33])).toBe('10100011000');
    expect(bits(CODE128_PATTERNS[103])).toBe('11010000100');
    expect(bits(CODE128_PATTERNS[104])).toBe('11010010000');
    expect(bits(CODE128_PATTERNS[105])).toBe('11010011100');
    expect(bits(CODE128_PATTERNS[106])).toBe('1100011101011');
  });
});

describe('encodeCode128', () => {
  it('reads back exactly what was encoded, for the kinds of codes practices print', () => {
    for (const text of ['FR-000123', '700123001', '12345678', 'Ab 9', '0', '42', 'X12345678Y', 'A1234', '1234AB', 'SKU/12.5%', '123456789012']) {
      expect(scan(encoded(text).modules)).toBe(text);
    }
  });

  it('packs digits two to a symbol, so a numeric frame or stock number fits a small label', () => {
    // Start C, 4 pairs, check: 6 symbols before the stop, against 10 if every digit were its own symbol
    expect(encoded('12345678').values).toHaveLength(6);
    expect(encoded('12345678').values[0]).toBe(105);
    expect(encoded('ABC').values[0]).toBe(104);
    // Letters then a long run of digits: switches to C for the digits
    expect(encoded('FR123456').values).toContain(99);
  });

  it('computes the check symbol as the standard does (start weighted 1, then 1, 2, 3 ...)', () => {
    // "PJJ123C" in set B: 104 + 48 + 42*2 + 42*3 + 17*4 + 18*5 + 19*6 + 35*7 = 879; 879 mod 103 = 55
    const values = encoded('PJJ123C').values;
    expect(values[values.length - 1]).toBe(55);
  });

  it('refuses what a scanner cannot read back: empty, too long, or characters outside plain ASCII', () => {
    expect(encodeCode128('')).toEqual({ ok: false, problem: 'empty' });
    expect(encodeCode128('9'.repeat(CODE128_MAX_LENGTH + 1))).toEqual({ ok: false, problem: 'too_long' });
    expect(encodeCode128('Frame–1')).toEqual({ ok: false, problem: 'unsupported_character' });
    expect(encodeCode128('é1')).toEqual({ ok: false, problem: 'unsupported_character' });
  });
});

describe('fitting and drawing', () => {
  it('keeps bars wide enough to scan: a code that would need bars narrower than 0.19 mm does not fit', () => {
    const short = encoded('FR-1');
    expect(moduleWidthFor(short, 40)).not.toBeNull();
    const long = encoded('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(moduleWidthFor(long, 34)).toBeNull();
    expect(moduleWidthFor(long, 90)).not.toBeNull();
  });

  it('draws every bar with a quiet zone on both sides, at the size asked for in millimetres', () => {
    const code = encoded('12');
    const svg = barcodeSvg(code, { moduleMm: 0.3, heightMm: 10 });
    const total = code.modules.length + 2 * QUIET_ZONE_MODULES;
    expect(svg).toContain(`viewBox="0 0 ${total} 1"`);
    expect(svg).toContain(`width="${Math.round(total * 0.3 * 1000) / 1000}mm"`);
    expect(svg).toContain('height="10mm"');
    const barModules = [...svg.matchAll(/<rect x="(\d+)" y="0" width="(\d+)" height="1"\/>/g)]
      .filter(match => Number(match[2]) < total)
      .reduce((sum, match) => sum + Number(match[2]), 0);
    expect(barModules).toBe(code.modules.split('').filter(bit => bit === '1').length);
    const first = /<g fill="#000"><rect x="(\d+)"/.exec(svg);
    expect(Number(first?.[1])).toBe(QUIET_ZONE_MODULES);
  });
});
