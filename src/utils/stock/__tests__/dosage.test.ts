import { describe, expect, it } from 'vitest';
import { daysOfMedicine, parseDirections, shorthandFromPrescription } from '../dosage';

describe('parseDirections: shorthand becomes the label a patient reads', () => {
  it('turns "1 tds" into plain words, so a patient never has to know Latin abbreviations', () => {
    expect(parseDirections('1 tds').text).toBe('Take 1 three times a day.');
  });

  it("adds the item's own unit when the shorthand gives none, so the label says what to take", () => {
    expect(parseDirections('1 tds', { unit: 'capsule' }).text).toBe('Take 1 capsule three times a day.');
    expect(parseDirections('2 bd', { unit: 'tablets' }).text).toBe('Take 2 tablets twice a day.');
  });

  it('leaves out units that are not doses (each, box), rather than printing "Take 1 each"', () => {
    expect(parseDirections('1 od', { unit: 'each' }).text).toBe('Take 1 once a day.');
  });

  it('reads timing, "when needed" and the course length, in the order a person would say them', () => {
    expect(parseDirections('10ml tds pc x5d').text).toBe('Take 10 ml three times a day after meals for 5 days.');
    expect(parseDirections('2 puffs bd prn').text).toBe('Inhale 2 puffs twice a day when needed.');
  });

  it('uses the right verb for drops, creams and suppositories (nobody "takes" eye drops)', () => {
    expect(parseDirections('2 drops eyes qid').text).toBe('Put 2 drops in both eyes four times a day.');
    expect(parseDirections('apply bd x14d').text).toBe('Apply twice a day for 2 weeks.');
    expect(parseDirections('1 supp nocte').text).toBe('Insert 1 suppository at night.');
  });

  it('understands the forms prescriptions are written in: glued, dotted, ranges, halves, hourly and day fractions', () => {
    expect(parseDirections('1tds').text).toBe('Take 1 three times a day.');
    expect(parseDirections('1 t.d.s.').text).toBe('Take 1 three times a day.');
    expect(parseDirections('1-2 q6h prn', { unit: 'tablet' }).text).toBe('Take 1 to 2 tablets every 6 hours when needed.');
    expect(parseDirections('½ bd', { unit: 'tablet' }).text).toBe('Take half a tablet twice a day.');
    expect(parseDirections('1 od 7/7').text).toBe('Take 1 once a day for 7 days.');
    expect(parseDirections('1 mane x 2 weeks').text).toBe('Take 1 in the morning for 2 weeks.');
    expect(parseDirections('2 stat').text).toBe('Take 2 now (one dose).');
  });

  it('keeps an unknown word in the text and flags it, so nothing is silently dropped from the instructions', () => {
    const result = parseDirections('1 tds qzx');
    expect(result.text).toBe('Take 1 three times a day qzx.');
    expect(result.unknown).toEqual(['qzx']);
  });

  it('does not flag ordinary words such as "with water"', () => {
    expect(parseDirections('1 od with water').unknown).toEqual([]);
  });

  it('prints directions already written in words exactly as typed', () => {
    const result = parseDirections('take one tablet when you wake up');
    expect(result.text).toBe('Take one tablet when you wake up.');
    expect(result.unknown).toEqual([]);
    expect(result.unitsPerDay).toBeNull();
  });

  it('works out the daily amount, which decides when a repeat falls due', () => {
    expect(parseDirections('2 bd').unitsPerDay).toBe(4);
    expect(parseDirections('1 q8h').unitsPerDay).toBe(3);
    expect(parseDirections('1 prn').unitsPerDay).toBeNull();
    expect(parseDirections('2 stat').unitsPerDay).toBeNull();
  });

  it('returns nothing for empty input, so an empty field never prints a label', () => {
    expect(parseDirections('   ').text).toBe('');
  });
});

describe('daysOfMedicine: when the medicine runs out', () => {
  it('divides the quantity by the daily amount, rounding down so the repeat is due before the patient runs out', () => {
    expect(daysOfMedicine(30, parseDirections('1 tds'))).toBe(10);
    expect(daysOfMedicine(30, parseDirections('2 bd'))).toBe(7);
  });

  it('never goes past a course the prescriber set (an antibiotic stops at 7 days even if 30 were given)', () => {
    expect(daysOfMedicine(30, parseDirections('1 tds x7d'))).toBe(7);
  });

  it('has no day for "when needed" medicine, so no repeat reminder is sent at a made-up time', () => {
    expect(daysOfMedicine(20, parseDirections('1 prn'))).toBeNull();
  });

  it('counts a weekly tablet as seven days each', () => {
    expect(daysOfMedicine(4, parseDirections('1 weekly'))).toBe(28);
  });
});

describe('shorthandFromPrescription: starting the directions from the visit\'s prescription', () => {
  it('maps the prescription screen\'s frequencies and durations to shorthand', () => {
    expect(shorthandFromPrescription({ dosage: '500mg', frequency: '3 times daily', duration: '7 days' })).toBe('1 tds x7d');
    expect(shorthandFromPrescription({ dosage: '5ml', frequency: 'Twice daily', duration: 'Ongoing' })).toBe('5ml bd');
    expect(shorthandFromPrescription({ dosage: '20mg', frequency: 'Evening only', duration: '1 month' })).toBe('1 nocte x1m');
  });

  it('gives nothing for a frequency it does not know, so the practitioner types it instead of a guess', () => {
    expect(shorthandFromPrescription({ dosage: '1g', frequency: 'Twice weekly' })).toBeNull();
  });
});
