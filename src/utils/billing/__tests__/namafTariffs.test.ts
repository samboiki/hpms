/**
 * The NAMAF benchmark list beneath every practice's price list (parity E1, A5, E2). Why these rules matter to a
 * practice: a GP, specialist or optometrist must find NAMAF's codes and amounts without typing them; a fund's own
 * price (PSEMAS) and the practice's own price must never be overridden by the benchmark; a 2026 visit is billed the
 * 2026 benchmark, a 2025 visit keeps 2025's price; a code priced by rule or at cost is offered, never billed at N$ 0.
 * Codes, amounts and names here are invented in NAMAF's shapes.
 */
import { describe, expect, it } from 'vitest';
import {
  NAMAF_DISCIPLINE_BY_PRACTICE_TYPE,
  disciplineChoices,
  disciplineLabel,
  isNamafListCode,
  namafRowsAsTariffs,
  noFixedAmount,
  practiceDiscipline,
  typeDiscipline,
  typeDisciplinesFromRows,
  wardDayTariffs,
  withNamafTariffs,
  type NamafTariffRow
} from '../namafTariffs';
import { mergeOwnTariffs, type OwnTariffRow } from '../practiceTariffs';
import { selectBillableTariffs, type TariffRow } from '../pricing';
import { fundPriceFor, type FundPriceBook } from '../fundPricing';
import { needsPracticeTypeChoice } from '../../practiceType';

let nextId = 0;
const nam = (discipline: string, tariffCode: string, code: string, amount: number | null, overrides: Partial<NamafTariffRow> = {}): NamafTariffRow => ({
  id: `namaf-${(nextId += 1)}`,
  discipline_code: discipline,
  tariff_code: tariffCode,
  code,
  description: `Invented ${code}`,
  amount,
  units: 10,
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  ...overrides
});

const shared = (code: string, price: number, from: string, overrides: Partial<TariffRow> = {}): TariffRow => ({
  id: `shared-${code}-${from}`,
  code,
  description: `Shared ${code}`,
  price,
  is_active: true,
  effective_from: from,
  effective_to: null,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO',
  ...overrides
});

const billable = (rows: readonly TariffRow[], date: string) => new Map(selectBillableTariffs(rows, date).tariffs.map(tariff => [tariff.code, tariff]));
// The shared list as the database returns it: flags are 'YES'/'NO' text (TariffRow also allows true/false)
const asShared = (rows: readonly TariffRow[]) => rows as unknown as Parameters<typeof withNamafTariffs>[0];

describe('which list a practice bills from', () => {
  it('follows the practice type: a GP practice gets the general practitioner list, a dentist 054, an optometrist 070', () => {
    expect(practiceDiscipline('medical', null)).toBe('014');
    expect(practiceDiscipline(' Dental ', null)).toBe('054');
    expect(practiceDiscipline('optometry', undefined)).toBe('070');
    expect(practiceDiscipline('physiotherapy', null)).toBe('072');
  });

  it("uses the discipline an administrator chose (an anaesthetist in a 'medical' practice bills 010), ignoring anything malformed", () => {
    expect(practiceDiscipline('medical', '010')).toBe('010');
    expect(practiceDiscipline('medical', '014003')).toBe('014003');
    expect(practiceDiscipline('medical', '10')).toBe('014');
    expect(practiceDiscipline('medical', 14)).toBe('014');
  });

  it("gives a 'general' practice no list until its type is chosen in Settings (the prompt already shown there)", () => {
    expect(needsPracticeTypeChoice('general')).toBe(true);
    expect(practiceDiscipline('general', null)).toBeNull();
    expect(practiceDiscipline(null, null)).toBeNull();
    // Once the administrator chooses 'medical' the GP list applies
    expect(needsPracticeTypeChoice('medical')).toBe(false);
    expect(practiceDiscipline('medical', null)).toBe('014');
  });

  // Sub-types (014003, 018001, ...) mostly repeat their parent's codes and prices, so a type bills from the main discipline.
  // The exceptions are the lists NAMAF numbers with six digits because their three-digit number holds no list of its own:
  // 082 (speech therapist and audiologist) holds a single line, a member refund, and the list a speech therapy or audiology
  // practice needs, 102 lines, is 082000; the sonographers' list (22 lines, not the radiographers' 109) is 039004; the
  // stand-alone oncology units' list is 120000.
  it('maps every practice type to a three-digit NAMAF discipline, except the three whose list NAMAF numbers with six digits', () => {
    const sixDigits: Record<string, string> = { speech_therapy: '082000', sonographer: '039004', oncology_unit: '120000' };
    Object.entries(NAMAF_DISCIPLINE_BY_PRACTICE_TYPE).forEach(([type, code]) => {
      if (sixDigits[type]) expect(code).toBe(sixDigits[type]);
      else expect(code).toMatch(/^\d{3}$/);
    });
    expect(practiceDiscipline('aesthetic', null)).toBeNull();
  });
});

// Owner, 14 Oct 2026: "if you open up an optometric practice their codes should be there already. They should be linked to
// practice type." The link is a column of practice_types, so a new type needs no release; the built-in map is only for a
// database without the column.
describe("a practice type's discipline from the database", () => {
  const links = typeDisciplinesFromRows([
    { name: ' Optometry ', namaf_discipline_code: '070' },
    { name: 'chiropractic', namaf_discipline_code: '004' },
    { name: 'pharmacy', namaf_discipline_code: null },
    { name: 'dental', namaf_discipline_code: '54' },
    { name: '', namaf_discipline_code: '014' }
  ]);

  it('bills a practice of a type added only in the database from that type\'s list, with no release', () => {
    expect(practiceDiscipline('chiropractic', null, links)).toBe('004');
    expect(practiceDiscipline('Optometry', null, links)).toBe('070');
    expect(typeDiscipline('chiropractic', links)).toBe('004');
  });

  it('takes the database as the truth: a type it leaves empty has no list, and so does one with a malformed code', () => {
    // pharmacy is 060 in the built-in copy; the database says none, so no list is offered
    expect(practiceDiscipline('pharmacy', null, links)).toBeNull();
    expect(practiceDiscipline('dental', null, links)).toBeNull();
    // A type the database does not list has none (the built-in copy is only for a database without the column)
    expect(practiceDiscipline('medical', null, links)).toBeNull();
  });

  it("still lets the administrator's choice win over the type's link", () => {
    expect(practiceDiscipline('chiropractic', '010', links)).toBe('010');
    expect(typeDiscipline('chiropractic', links)).toBe('004');
  });

  it('is not fooled by a type named like an object property', () => {
    expect(typeDiscipline('constructor', links)).toBeNull();
    expect(typeDiscipline('__proto__', links)).toBeNull();
    expect(typeDiscipline('toString', NAMAF_DISCIPLINE_BY_PRACTICE_TYPE)).toBeNull();
  });
});

describe('the NAMAF rows as billing tariffs', () => {
  it('bills the NAMAF code and keeps the five-digit form funds print on statements', () => {
    const [tariff] = namafRowsAsTariffs([nam('072', '72001', '001', 125.5)]);
    expect(tariff).toMatchObject({ code: '001', price: 125.5, no_fixed_amount: false, namaf: { discipline: '072', tariffCode: '72001' } });
  });

  it('offers a code with no amount (empty or 0: by rule or at cost) at N$ 0 marked "no fixed amount", so staff type the amount', () => {
    const tariffs = namafRowsAsTariffs([nam('014', '00201', '0201', null), nam('014', '00011', '0011', 0)]);
    expect(tariffs.map(tariff => [tariff.code, tariff.price, tariff.no_fixed_amount])).toEqual([['0201', 0, true], ['0011', 0, true]]);
    expect(tariffs.every(tariff => noFixedAmount(tariff))).toBe(true);
  });

  it('offers one row when a discipline lists a code twice: the one whose five-digit form is the code itself', () => {
    const tariffs = namafRowsAsTariffs([
      nam('014', '98810', '09815', 0, { description: 'Contraceptive implants' }),
      nam('014', '09815', '09815', 0, { description: 'Acute medicine' })
    ]);
    expect(tariffs).toHaveLength(1);
    expect(tariffs[0].description).toBe('Acute medicine');
  });

  it('stays in force after its end date until the next list starts, so billing never stops on 1 January', () => {
    const rows = namafRowsAsTariffs([nam('014', '00190', '0190', 400), nam('014', '00190', '0190', 420, { valid_from: '2027-01-01', valid_to: '2027-12-31' })]);
    expect(billable(rows as unknown as TariffRow[], '2026-12-31').get('0190')?.unitPrice).toBe(400);
    expect(billable(rows.slice(0, 1) as unknown as TariffRow[], '2027-01-15').get('0190')?.unitPrice).toBe(400);
    expect(billable(rows as unknown as TariffRow[], '2027-01-15').get('0190')?.unitPrice).toBe(420);
  });
});

describe('the NAMAF list beneath the practice type\'s shared list', () => {
  it('gives a practice without a shared list (GP) every NAMAF code', () => {
    const rows = withNamafTariffs([], namafRowsAsTariffs([nam('014', '00190', '0190', 521.4), nam('014', '00191', '0191', 600)]));
    expect([...billable(rows as unknown as TariffRow[], '2026-10-14').keys()]).toEqual(['0190', '0191']);
  });

  it('bills a 2026 visit the 2026 benchmark and a 2025 visit the shared 2025 price, keeping the shared rules (tooth, quantity)', () => {
    const sharedRows = [shared('8107', 135.4, '2025-01-01', { can_be_multiplied: 'YES', requires_tooth_number: 'YES', description: 'Intra-oral radiograph' })];
    const rows = withNamafTariffs(asShared(sharedRows), namafRowsAsTariffs([nam('054', '08107', '8107', 141.9)]));
    const in2026 = billable(rows as unknown as TariffRow[], '2026-10-14').get('8107');
    expect(in2026).toMatchObject({ unitPrice: 141.9, multiplyRule: 'YES', requiresTooth: true, description: 'Intra-oral radiograph' });
    expect(billable(rows as unknown as TariffRow[], '2025-06-01').get('8107')?.unitPrice).toBe(135.4);
  });

  it('keeps the shared price when NAMAF has no fixed amount for the code (a dental code is never dropped to N$ 0)', () => {
    const rows = withNamafTariffs(asShared([shared('8348', 192, '2025-01-01')]), namafRowsAsTariffs([nam('054', '08348', '8348', 0)]));
    expect(billable(rows as unknown as TariffRow[], '2026-10-14').get('8348')?.unitPrice).toBe(192);
  });

  it('leaves a code alone when the shared list already starts a version on or after the NAMAF date', () => {
    const rows = withNamafTariffs(asShared([shared('8101', 270, '2026-03-01')]), namafRowsAsTariffs([nam('054', '08101', '8101', 267)]));
    expect(rows).toHaveLength(1);
  });

  it("lets the practice's own price win over the benchmark from its date (mergeOwnTariffs on top)", () => {
    const ownRow: OwnTariffRow = {
      id: 'own-0190',
      practice_id: 'practice-a',
      code: '0190',
      description: 'Consultation',
      price: 480,
      can_be_multiplied: 'NO',
      requires_tooth_number: 'NO',
      effective_from: '2026-07-01',
      is_active: true
    };
    const rows = mergeOwnTariffs(withNamafTariffs([], namafRowsAsTariffs([nam('014', '00190', '0190', 521.4)])), [ownRow]);
    expect(billable(rows as unknown as TariffRow[], '2026-06-30').get('0190')?.unitPrice).toBe(521.4);
    expect(billable(rows as unknown as TariffRow[], '2026-10-14').get('0190')?.unitPrice).toBe(480);
  });

  it("lets a fund's own price (PSEMAS) win over the benchmark: the benchmark is only the practice tariff beneath it", () => {
    const book: FundPriceBook = {
      rows: [{ id: 'f1', practice_id: null, fund_reference: 'MAG1', plan_option: null, code: '8101', unit_price: 148.3, effective_from: '2023-12-13', effective_to: null, is_active: true }],
      contracts: []
    };
    const rows = withNamafTariffs(asShared([shared('8101', 254.7, '2025-01-01')]), namafRowsAsTariffs([nam('054', '08101', '8101', 267)]));
    const practicePrice = billable(rows as unknown as TariffRow[], '2026-10-14').get('8101')?.unitPrice as number;
    expect(practicePrice).toBe(267);
    const psemas = fundPriceFor('8101', practicePrice, { serviceDate: '2026-10-14', practiceId: 'practice-a', fund: { reference: 'MAG1', planOptions: [] }, book });
    expect(psemas).toMatchObject({ ok: true, unitPrice: 148.3 });
    const private_ = fundPriceFor('8101', practicePrice, { serviceDate: '2026-10-14', practiceId: 'practice-a', fund: { reference: 'NHPM', planOptions: [] }, book });
    expect(private_).toMatchObject({ ok: true, unitPrice: 267 });
  });
});

describe('which codes are only there because of the NAMAF list', () => {
  it("tells a NAMAF code from the practice's own, so a menu can leave the thousands of NAMAF codes out", () => {
    const [fromNamaf] = namafRowsAsTariffs([nam('070', 'NA70405', 'NA70405', 0)]);
    expect(isNamafListCode(fromNamaf)).toBe(true);
    // The practice's own price for the same code replaces the row and is its own
    expect(isNamafListCode({ ...fromNamaf, is_own: true })).toBe(false);
    // A code of the shared list that NAMAF does not carry has no NAMAF marker at all
    expect(isNamafListCode({ is_own: false })).toBe(false);
  });
});

describe('codes whose amount is typed', () => {
  it('asks only while the price is still N$ 0: a fund price or an amount already typed is billed as it is', () => {
    const [tariff] = namafRowsAsTariffs([nam('014', '00201', '0201', null)]);
    expect(noFixedAmount(tariff)).toBe(true);
    expect(noFixedAmount({ ...tariff, price: 350 })).toBe(false);
    expect(noFixedAmount({ ...tariff, price_problem: 'ambiguous fund price' })).toBe(false);
    // A shared code at N$ 0 (8346, worked out from its restoration) is not a NAMAF "no fixed amount" code
    expect(noFixedAmount({ price: 0 })).toBe(false);
  });
});

describe('the discipline chooser and the ward codes', () => {
  it('names disciplines in plain words with their number, main disciplines before sub-types', () => {
    expect(disciplineLabel({ discipline_code: '014', discipline_name: 'GENERAL PRACTITIONER' })).toBe('General practitioner (014)');
    const choices = disciplineChoices([
      { discipline_code: '014003', discipline_name: 'GENERAL MEDICAL PRACTICE', codes: 1, priced_codes: 1, valid_from: null, valid_to: null },
      { discipline_code: '054', discipline_name: 'DENTIST', codes: 1, priced_codes: 1, valid_from: null, valid_to: null },
      { discipline_code: '010', discipline_name: 'ANAESTHETIST', codes: 1, priced_codes: 1, valid_from: null, valid_to: null }
    ]);
    expect(choices.map(choice => choice.discipline_code)).toEqual(['010', '054', '014003']);
  });

  it('offers the private hospital ward fees per day in ward order, billed under their NAMAF code', () => {
    const rows = [
      nam('057', '57201', '201', 0, { description: 'INTENSIVE CARE UNIT: PER DAY' }),
      nam('057', '57001', '001', 0, { description: 'SURGICAL CASES: PER DAY' }),
      nam('057', '57007', '007', 2914.1, { description: 'DAY ADMISSION' }),
      nam('057', '00002', '0002', 7291.5),
      nam('014', '57001', '001', 0)
    ];
    expect(wardDayTariffs(rows).map(tariff => [tariff.code, tariff.namaf.tariffCode])).toEqual([['001', '57001'], ['201', '57201'], ['007', '57007']]);
  });
});
