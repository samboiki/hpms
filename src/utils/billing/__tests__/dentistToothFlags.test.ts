/**
 * Dental specialists ask for a tooth on the dentist's tooth codes (owner, 14 Oct 2026: "Yes, copy the dentist flags").
 * Why it matters to a practice: NAMAF's file does not say which codes need a tooth number, so every NAMAF row reads NO, and
 * an orthodontist or a periodontist, who bills from NAMAF's list alone, was never asked for the tooth of a filling or an
 * extraction the way a dentist is; the fund then pends or rejects the line. Only the dentist's own list (practice_tariffs)
 * knows, and an administrator must still be able to say otherwise for the practice (Admin > Tariffs). Invented rows.
 */
import { describe, expect, it } from 'vitest';
import {
  dentistToothCodes,
  isDentalSpecialist,
  namafRowsAsTariffs,
  withDentistToothFlags,
  withNamafTariffs,
  type NamafTariffRow
} from '../namafTariffs';
import { mergeOwnTariffs, toothRuleFor, type OwnTariffRow } from '../practiceTariffs';
import { selectBillableTariffs, type TariffRow } from '../pricing';
import { DENTAL_PRACTICE_TYPES } from '../practiceTypeNames';

const FILLING = '8341';
const EXTRACTION = '8501';
const CONSULTATION = '8101';
const SPECIALIST_ONLY = '9001';
const TODAY = '2026-10-14';

let nextId = 0;
const nam = (code: string, overrides: Partial<NamafTariffRow> = {}): NamafTariffRow => ({
  id: `namaf-${(nextId += 1)}`,
  discipline_code: '064',
  tariff_code: code.padStart(5, '0'),
  code,
  description: `Invented ${code}`,
  amount: 250,
  units: 10,
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  ...overrides
});

/** A row of the dentist's shared list (practice type 'dental') as the tooth rules are read from it */
const dentist = (code: string, flag: string | null, from = '2025-01-01') => ({ code, requires_tooth_number: flag, effective_from: from });

const own = (code: string, needsTooth: boolean, from = '2026-10-01'): OwnTariffRow => ({
  id: `own-${code}-${from}`,
  practice_id: 'practice-1',
  code,
  description: `Own ${code}`,
  price: 300,
  can_be_multiplied: 'NO',
  requires_tooth_number: needsTooth ? 'YES' : 'NO',
  effective_from: from,
  is_active: true
});

/** The dentist's list marks a filling and an extraction, not a consultation */
const DENTIST_TOOTH_CODES = dentistToothCodes([dentist(FILLING, 'YES'), dentist(EXTRACTION, 'YES'), dentist(CONSULTATION, 'NO')]);

/** What an orthodontist's NAMAF list holds: a filling, an extraction, a consultation and a code only specialists have */
const specialistList = () => namafRowsAsTariffs([nam(FILLING), nam(EXTRACTION), nam(CONSULTATION), nam(SPECIALIST_ONLY)]);

const needsToothOn = (rows: readonly TariffRow[], date = TODAY) =>
  new Map(selectBillableTariffs(rows, date).tariffs.map(tariff => [tariff.code, tariff.requiresTooth]));

describe('which practices are dental specialists', () => {
  // These are the practices whose list comes from NAMAF alone: the dentist's shared list already carries the flags
  it.each(['orthodontist', 'maxillofacial_oral_surgeon', 'periodontist', 'prosthodontist', 'dental_therapist'])(
    '%s copies the dentist flags',
    type => {
      expect(isDentalSpecialist(type)).toBe(true);
    }
  );

  it('keeps the dentist, the dental laboratory and every other discipline out: they have their own rules', () => {
    // The dentist's list holds the flags itself (and the practice typed dental_practice is read as the dentist); the
    // laboratory has no tooth chart; a GP, an optometrist or a physiotherapist is never asked for a tooth
    ['dental', ' Dental ', 'dental_practice', 'dental_technician', 'medical', 'optometry', 'physiotherapy', 'general', '', null, undefined].forEach(type => {
      expect(isDentalSpecialist(type)).toBe(false);
    });
  });

  it('is every dental practice type except the dentist, so a specialist added to that list copies the flags too', () => {
    expect(DENTAL_PRACTICE_TYPES.filter(isDentalSpecialist)).toEqual(DENTAL_PRACTICE_TYPES.filter(type => type !== 'dental'));
  });
});

describe("the dentist's tooth codes", () => {
  it('are the codes of the dentist list flagged YES, tidied as every code lookup tidies them', () => {
    const codes = dentistToothCodes([dentist(' 8341 ', 'YES'), dentist('8501', 'yes'), dentist('8101', 'NO'), dentist('8110', null), dentist('8999', 'maybe'), dentist('', 'YES'), dentist('a100', 'YES')]);
    expect([...codes].sort()).toEqual(['8341', '8501', 'A100']);
  });

  // A flag the dentist's list switched off in a newer version must not keep asking specialists for a tooth
  it('follow the newest version of a code, so a flag switched off later is not copied and one switched on later is', () => {
    const codes = dentistToothCodes([
      dentist('8341', 'YES', '2025-01-01'),
      dentist('8341', 'NO', '2026-01-01'),
      dentist('8501', 'NO', '2025-01-01'),
      dentist('8501', 'YES', '2026-01-01')
    ]);
    expect([...codes]).toEqual(['8501']);
  });

  // Two versions that start the same day and disagree are a mistake in the list; asking for a tooth is the safe side
  // (the line shows a tooth box, where a missing tooth would have the fund pend the claim)
  it('count a code as needing a tooth when any version that starts the same day says so, in either row order', () => {
    expect(dentistToothCodes([dentist('8341', 'NO'), dentist('8341', 'YES')]).has('8341')).toBe(true);
    expect(dentistToothCodes([dentist('8341', 'YES'), dentist('8341', 'NO')]).has('8341')).toBe(true);
  });

  it('are none when the list has none', () => {
    expect(dentistToothCodes([]).size).toBe(0);
  });
});

describe("copying the dentist's flags to a specialist's NAMAF codes", () => {
  it('asks for a tooth on a code with the same number as a dentist tooth code, and on no other', () => {
    const copied = needsToothOn(withDentistToothFlags(specialistList(), DENTIST_TOOTH_CODES));
    expect(copied.get(FILLING)).toBe(true);
    expect(copied.get(EXTRACTION)).toBe(true);
    // Same number as a dentist code that needs no tooth, and a code the dentist does not have: no tooth
    expect(copied.get(CONSULTATION)).toBe(false);
    expect(copied.get(SPECIALIST_ONLY)).toBe(false);
  });

  it('is what a specialist met before: nothing asked for a tooth while the rules were not copied', () => {
    const before = needsToothOn(specialistList());
    expect([...before.values()].some(Boolean)).toBe(false);
  });

  it('changes only the tooth rule of the code, and never the list it was given', () => {
    const list = specialistList();
    const snapshot = JSON.stringify(list);
    const copied = withDentistToothFlags(list, DENTIST_TOOTH_CODES);
    expect(JSON.stringify(list)).toBe(snapshot);
    const filling = copied.find(tariff => tariff.code === FILLING);
    const original = list.find(tariff => tariff.code === FILLING);
    expect({ ...filling, requires_tooth_number: 'NO' }).toEqual(original);
    expect(filling?.namaf.discipline).toBe('064');
    // The codes that stay as they were are the very same rows
    expect(copied.find(tariff => tariff.code === CONSULTATION)).toBe(list.find(tariff => tariff.code === CONSULTATION));
  });

  it('leaves the list as it was when the dentist has no tooth codes (or they could not be read)', () => {
    const list = specialistList();
    expect(withDentistToothFlags(list, new Set())).toEqual(list);
  });

  it('never turns a tooth rule off', () => {
    const asked = namafRowsAsTariffs([nam(CONSULTATION)]).map(tariff => ({ ...tariff, requires_tooth_number: 'YES' }));
    expect(withDentistToothFlags(asked, new Set([FILLING])).map(tariff => tariff.requires_tooth_number)).toEqual(['YES']);
  });
});

// "An administrator can still change it in Admin > Tariffs": the copy is only the starting point, as NAMAF's NO was before
describe('who still has the last word on a specialist code', () => {
  it("the practice's own version wins: an administrator who unticks 'needs a tooth' stops the question for that code only", () => {
    const rows = mergeOwnTariffs(withNamafTariffs([], withDentistToothFlags(specialistList(), DENTIST_TOOTH_CODES)), [own(FILLING, false)]);
    const flags = needsToothOn(rows as unknown as TariffRow[]);
    expect(flags.get(FILLING)).toBe(false);
    // The other copied code is still asked
    expect(flags.get(EXTRACTION)).toBe(true);
  });

  it("the practice's own version can ask where the copy does not: ticking 'needs a tooth' on a code the dentist does not flag", () => {
    const rows = mergeOwnTariffs(withNamafTariffs([], withDentistToothFlags(specialistList(), DENTIST_TOOTH_CODES)), [own(SPECIALIST_ONLY, true)]);
    expect(needsToothOn(rows as unknown as TariffRow[]).get(SPECIALIST_ONLY)).toBe(true);
  });

  it("a version of the practice's own that starts later changes nothing before its date", () => {
    const rows = mergeOwnTariffs(withNamafTariffs([], withDentistToothFlags(specialistList(), DENTIST_TOOTH_CODES)), [own(FILLING, false, '2026-12-01')]);
    expect(needsToothOn(rows as unknown as TariffRow[], '2026-11-30').get(FILLING)).toBe(true);
    expect(needsToothOn(rows as unknown as TariffRow[], '2026-12-01').get(FILLING)).toBe(false);
  });

  // The shared list of the specialist's own type, if one is ever loaded, keeps the rules of its codes (withNamafTariffs)
  it("a shared row of the specialist's own type keeps its own rule over the copy", () => {
    const sharedRow = {
      id: 'shared-8341',
      code: FILLING,
      description: 'Shared filling',
      price: 200,
      unit: null,
      is_active: true,
      effective_from: '2025-01-01',
      effective_to: null,
      can_be_multiplied: 'NO',
      requires_tooth_number: 'NO',
      business_rule_formula: null,
      example_calculation: null,
      notes: null
    };
    const rows = withNamafTariffs([sharedRow], withDentistToothFlags(specialistList(), DENTIST_TOOTH_CODES));
    expect(needsToothOn(rows as unknown as TariffRow[]).get(FILLING)).toBe(false);
  });
});

// Claim review decides a tooth as the visit does, so it never asks for one the visit did not ask for, nor lets through a
// line the visit would have stopped; a specialist's NAMAF codes are not in the rows it reads, so it needs the dentist's codes
describe("claim review asks a specialist's tooth question as the visit does", () => {
  const noRows: TariffRow[] = [];

  it('asks for a tooth on a code the dentist list marks, when no row of the practice says anything about it', () => {
    const needsTooth = toothRuleFor(noRows, 'orthodontist', DENTIST_TOOTH_CODES);
    expect(needsTooth(FILLING, TODAY)).toBe(true);
    expect(needsTooth(' 8341 ', TODAY)).toBe(true);
  });

  it('does not check a code the dentist list does not mark', () => {
    const needsTooth = toothRuleFor(noRows, 'orthodontist', DENTIST_TOOTH_CODES);
    expect(needsTooth(CONSULTATION, TODAY)).toBeNull();
    expect(needsTooth(SPECIALIST_ONLY, TODAY)).toBeNull();
  });

  it("follows the practice's own version first: unticked on Admin > Tariffs, no tooth is asked on the claim either", () => {
    const rows = mergeOwnTariffs([], [own(FILLING, false)]) as unknown as TariffRow[];
    const needsTooth = toothRuleFor(rows, 'orthodontist', DENTIST_TOOTH_CODES);
    expect(needsTooth(FILLING, TODAY)).toBe(false);
    expect(needsTooth(EXTRACTION, TODAY)).toBe(true);
  });

  it("asks nothing it did not have before for the dentist's own practice, which reads its flags from its shared list", () => {
    const needsTooth = toothRuleFor(noRows, 'dental');
    expect(needsTooth(FILLING, TODAY)).toBeNull();
  });

  it('never asks a practice that is not dental, whatever list of codes it is given', () => {
    const needsTooth = toothRuleFor(noRows, 'medical', DENTIST_TOOTH_CODES);
    expect(needsTooth(FILLING, TODAY)).toBe(false);
  });

  it('does not check a line with no usable service date, as before', () => {
    const needsTooth = toothRuleFor(noRows, 'orthodontist', DENTIST_TOOTH_CODES);
    expect(needsTooth(FILLING, null)).toBeNull();
    expect(needsTooth(FILLING, 'soon')).toBeNull();
  });
});
