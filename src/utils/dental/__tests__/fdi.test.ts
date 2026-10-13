import { describe, it, expect } from 'vitest';
import {
  ADULT_LOWER,
  ADULT_UPPER,
  ageInYears,
  chartRows,
  defaultDentition,
  isFrontTooth,
  isMilkTooth,
  isMolar,
  isUpperTooth,
  parseBilledTeeth,
  toothName
} from '../fdi';

// Business rule: the chart is read facing the patient, as practitioners and Eminance draw it. The patient's right
// (quadrants 1 and 4) is on the left of the screen; a mirrored chart puts work on the wrong side of the mouth.
describe('chart rows', () => {
  it('runs the upper arch from the right back tooth (18) to the left back tooth (28)', () => {
    expect(ADULT_UPPER.teeth).toEqual(['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28']);
    expect(ADULT_LOWER.teeth).toEqual(['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']);
  });

  it('shows milk teeth only for a child, and between the permanent arches for mixed teeth (where they sit)', () => {
    expect(chartRows('child').map(row => row.teeth.join(' '))).toEqual(['55 54 53 52 51 61 62 63 64 65', '85 84 83 82 81 71 72 73 74 75']);
    expect(chartRows('mixed').map(row => row.key)).toEqual(['upper', 'upper-milk', 'lower-milk', 'lower']);
    expect(chartRows('adult').map(row => row.key)).toEqual(['upper', 'lower']);
  });
});

// Business rule: staff read plain names; the code is for funds. Milk teeth have five per quadrant and their 4 and 5
// are molars (a root canal or crown code depends on it).
describe('tooth names and kinds', () => {
  it('names teeth in plain words', () => {
    expect(toothName('36')).toBe('Lower left first molar');
    expect(toothName('18')).toBe('Upper right wisdom tooth');
    expect(toothName('11')).toBe('Upper right central incisor');
    expect(toothName('54')).toBe('Upper right milk first molar');
    expect(toothName('83')).toBe('Lower right milk canine');
    expect(toothName('19')).toBe('Tooth 19');
  });

  it('knows front teeth, molars, milk teeth and the jaw', () => {
    expect(isFrontTooth('13')).toBe(true);
    expect(isFrontTooth('14')).toBe(false);
    expect(isMolar('16')).toBe(true);
    expect(isMolar('15')).toBe(false);
    expect(isMolar('54')).toBe(true);
    expect(isMilkTooth('54')).toBe(true);
    expect(isMilkTooth('46')).toBe(false);
    expect(isUpperTooth('26')).toBe(true);
    expect(isUpperTooth('75')).toBe(false);
  });
});

// Business rule: the history is built from billed lines. The screens store "36" or "11,12"; claim files and Eminance
// write up to eight numbers without separators ("1112"). A value that is not a tooth must not be drawn on one.
describe('teeth on a billed line', () => {
  it('reads single teeth, lists and claim-file runs of pairs', () => {
    expect(parseBilledTeeth('36')).toEqual({ teeth: ['36'], invalid: [] });
    expect(parseBilledTeeth('11,12 21')).toEqual({ teeth: ['11', '12', '21'], invalid: [] });
    expect(parseBilledTeeth('1112')).toEqual({ teeth: ['11', '12'], invalid: [] });
    expect(parseBilledTeeth('36,36')).toEqual({ teeth: ['36'], invalid: [] });
  });

  it('keeps what is not a tooth apart', () => {
    expect(parseBilledTeeth('19')).toEqual({ teeth: [], invalid: ['19'] });
    expect(parseBilledTeeth('36, UL')).toEqual({ teeth: ['36'], invalid: ['UL'] });
    expect(parseBilledTeeth('1119')).toEqual({ teeth: [], invalid: ['1119'] });
    expect(parseBilledTeeth(null)).toEqual({ teeth: [], invalid: [] });
  });
});

// Business rule: the chart opens on the teeth the patient has: milk teeth under 6, both from 6 to 12, permanent from 13.
// Anything already recorded on the other set widens the chart, so no record is hidden.
describe('which teeth the chart shows first', () => {
  const today = '2026-10-07';

  it('follows the age', () => {
    expect(defaultDentition('2022-03-01', today)).toBe('child');
    expect(defaultDentition('2018-03-01', today)).toBe('mixed');
    expect(defaultDentition('1990-03-01', today)).toBe('adult');
    expect(defaultDentition(null, today)).toBe('adult');
  });

  it('widens to mixed when records are on the other set of teeth', () => {
    expect(defaultDentition('1990-03-01', today, ['55'])).toBe('mixed');
    expect(defaultDentition('2022-03-01', today, ['16'])).toBe('mixed');
    expect(defaultDentition('1990-03-01', today, ['16'])).toBe('adult');
  });

  it('counts a birthday only once it has come', () => {
    expect(ageInYears('2013-10-08', today)).toBe(12);
    expect(ageInYears('2013-10-07', today)).toBe(13);
    expect(ageInYears('2030-01-01', today)).toBeNull();
  });
});
