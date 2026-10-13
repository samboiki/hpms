import { describe, it, expect, vi } from 'vitest';
import {
  billableVisitTariffs,
  buildInfectionControlLine,
  buildMaterialFactorLine,
  buildTariffLine,
  changeLineFee,
  changeLineQuantity,
  feeChangeProblem,
  fundPricingNotice,
  priceForPatient,
  priceMaterialFactor,
  quantityControls,
  serviceMultiplyRule,
  sumServiceTotals,
  tariffLineInput,
  linePortionFromRow,
  lineTeethFromRow,
  priceLinesAtRate,
  toInvoiceServiceRow,
  toInvoiceServiceRows,
  withDisciplineRules,
  type VisitPricing,
  type VisitTariff
} from '../visitBillingLines';
import type { FundPriceBook, FundTariffRow } from '../../../utils/billing/fundPricing';
import { findInvoiceLineProblems } from '../../../services/invoiceService';
import { nadParts } from '../../../utils/billing/money';
import { REAL_PRICES, intBetween, pick, seededRandom } from '../../../utils/billing/__tests__/generators';
import type { ServiceSelection } from '../../../types/billing';

// invoiceService is imported only for its pure line check; nothing here may reach the database
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const tariff = (code: string, overrides: Partial<VisitTariff> = {}): VisitTariff => ({
  id: crypto.randomUUID(),
  code,
  description: `Tariff ${code}`,
  price: '100.00',
  can_be_multiplied: 'YES',
  requires_tooth_number: 'NO',
  business_rule_formula: null,
  example_calculation: null,
  ...overrides
});

const added = (outcome: ReturnType<typeof buildTariffLine>): ServiceSelection => {
  if (!outcome.ok) throw new Error(`expected a line, got: ${outcome.message}`);
  return outcome.service;
};

// Business rule: the price on a visit line is the tariff's own price, and the quantity rule is the
// tariff's can_be_multiplied. A tariff without a usable price must stop the line - never N$ 0.00 and
// never a fallback amount - because whatever the screen shows is what the patient or fund is billed.
describe('tariffLineInput: price and quantity rule come from the tariff', () => {
  it('reads string and number prices to the cent and the tariff quantity rule', () => {
    expect(tariffLineInput(tariff('8107', { price: '135.40', can_be_multiplied: 'yes' }), 3, false)).toMatchObject({
      code: '8107', unitPrice: 135.4, quantity: 3, multiplyRule: 'YES', hasMedicalAid: false
    });
    expect(tariffLineInput(tariff('8340', { price: 254.7, can_be_multiplied: 'PROGRESSIVE' }), 2, true)).toMatchObject({
      unitPrice: 254.7, multiplyRule: 'PROGRESSIVE', hasMedicalAid: true
    });
  });

  it.each([null, undefined, '', 'abc', -5, Number.NaN])('has no input for an unusable price (%s)', price => {
    expect(tariffLineInput(tariff('8101', { price }), 1, false)).toBeNull();
  });
});

// Business rule: a picked tariff becomes exactly one line priced unit x quantity in cents. The old
// screens charged extra units of "progressive" codes at an invented 50% and charged codes with a
// quantity limit (8107, 8145, 8185) once while saving the quantity - invoiceService now refuses both,
// so every line the screen can build must also pass findInvoiceLineProblems.
describe('buildTariffLine: lines are priced by computeLine and accepted by invoiceService', () => {
  it('prices a progressive code at unit x quantity (no 50% rate) and flags it for review', () => {
    const outcome = buildTariffLine(tariff('8340', { can_be_multiplied: 'PROGRESSIVE' }), 3, '', false);
    const service = added(outcome);
    expect(service.totalPrice).toBe(300);
    expect(service.canBeMultiplied).toBe(true);
    expect(outcome.ok && outcome.warnings.join(' ')).toMatch(/special quantity rule \(progressive\)/);
    expect(findInvoiceLineProblems([service])).toEqual([]);
  });

  it('refuses quantity 3 on a code the tariff bills once per line, instead of pricing one unit', () => {
    const outcome = buildTariffLine(tariff('8107', { can_be_multiplied: 'NO' }), 3, '', false);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.message).toMatch(/quantity 1.*The line was not added/);
  });

  it('bills 3 X-ray films of N$ 135.40 as exactly N$ 406.20', () => {
    const service = added(buildTariffLine(tariff('8107', { price: '135.40' }), 3, '', false));
    expect(service).toMatchObject({ unitPrice: 135.4, quantity: 3, totalPrice: 406.2 });
  });

  it('needs the tooth when the tariff requires one, because the claim must name it', () => {
    const toothCode = tariff('8341', { requires_tooth_number: 'YES', can_be_multiplied: 'NO' });
    expect(buildTariffLine(toothCode, 1, '', false)).toMatchObject({ ok: false });
    expect(added(buildTariffLine(toothCode, 1, '16', false)).teethNumbers).toEqual(['16']);
  });

  it('refuses a tariff without a valid price rather than billing a made-up amount', () => {
    const outcome = buildTariffLine(tariff('8101', { price: null }), 1, '', false);
    expect(outcome).toEqual({ ok: false, message: expect.stringMatching(/8101 has no valid price/) });
  });

  // Business rule: medical aid or private follows the patient's record. The old screens flagged
  // every line as medical aid, which left private patients with nothing to pay.
  it('flags the line for the medical aid only when the patient has one', () => {
    expect(added(buildTariffLine(tariff('8101'), 1, '', true))).toMatchObject({ medicalAidCovered: true, coveragePercentage: 100 });
    expect(added(buildTariffLine(tariff('8101'), 1, '', false))).toMatchObject({ medicalAidCovered: false, coveragePercentage: 0 });
  });

  const sweep = REAL_PRICES.flatMap(price =>
    (['NO', 'YES', 'SOMETIMES', 'PROGRESSIVE'] as const).flatMap(rule =>
      [1, 2, 3, 7, 12].map(quantity => ({ price, rule, quantity }))
    )
  );
  it.each(sweep)('N$ $price x $quantity ($rule) is refused or accepted by invoiceService', ({ price, rule, quantity }) => {
    const outcome = buildTariffLine(tariff('8101', { price, can_be_multiplied: rule }), quantity, '', true);
    expect(outcome.ok).toBe(rule !== 'NO' || quantity === 1);
    if (outcome.ok) expect(findInvoiceLineProblems([outcome.service])).toEqual([]);
  });
});

// Business rule: 8109 infection control is billed once per visit at the 8109 tariff price. The old
// screens billed a made-up N$ 45.00 under a fake 'manual-8109' tariff when the tariff was missing.
describe('buildInfectionControlLine: 8109 comes from the tariff list or not at all', () => {
  it('uses the 8109 tariff price and links the line to that tariff', () => {
    const infectionControl = tariff('8109', { price: '52.30', can_be_multiplied: 'NO' });
    const outcome = buildInfectionControlLine([tariff('8101'), infectionControl], false, 'parent-id');
    const service = added(outcome);
    expect(service).toMatchObject({ tariffId: infectionControl.id, unitPrice: 52.3, quantity: 1, totalPrice: 52.3, isRequired: true, parentServiceId: 'parent-id' });
    expect(findInvoiceLineProblems([service])).toEqual([]);
  });

  it('adds no line, and says why, when 8109 is missing or has no price', () => {
    expect(buildInfectionControlLine([tariff('8101')], false)).toEqual({
      ok: false,
      message: expect.stringMatching(/8109 has no tariff in effect/)
    });
    expect(buildInfectionControlLine([tariff('8109', { price: '' })], false)).toMatchObject({ ok: false });
  });

  it('links to a procedure only when one is given', () => {
    expect('parentServiceId' in added(buildInfectionControlLine([tariff('8109')], false))).toBe(false);
  });
});

// Business rule: 8346 restorative material is 10% of its procedure's unit price, rounded to the
// cent, for the same quantity and teeth. The old screens stored the unrounded 10% (13.545), so a
// quantity of 2 saved 27.09 against a unit of 13.55 - a line invoiceService now refuses.
describe('8346 material factor', () => {
  it('rounds 10% to the cent before multiplying, so the total equals unit x quantity', () => {
    expect(priceMaterialFactor(135.45, 2, false)).toMatchObject({ ok: true, unitPrice: 13.55, total: 27.1 });
    expect(priceMaterialFactor(Number.NaN, 1, false).ok).toBe(false);
  });

  it('follows its procedure: quantity, teeth, multiply flag and parent link', () => {
    const procedure = added(buildTariffLine(tariff('8341', { price: '373.90', requires_tooth_number: 'YES' }), 2, '16', true));
    const materialTariff = tariff('8346', { price: '0' });
    const material = added(buildMaterialFactorLine([materialTariff], procedure, true));
    expect(material).toMatchObject({
      tariffId: materialTariff.id,
      unitPrice: 37.39,
      quantity: 2,
      totalPrice: 74.78,
      teethNumbers: ['16'],
      canBeMultiplied: true,
      parentServiceId: procedure.id,
      medicalAidCovered: true
    });
    expect(findInvoiceLineProblems([procedure, material])).toEqual([]);
  });

  it('adds no material line without the 8346 tariff', () => {
    const procedure = added(buildTariffLine(tariff('8341'), 1, '', false));
    expect(buildMaterialFactorLine([], procedure, false)).toMatchObject({ ok: false, message: expect.stringMatching(/8346/) });
  });
});

// Business rule: changing a quantity on the visit screen re-prices the line with computeLine, keeps
// codes that cannot be multiplied at 1, and keeps the 8346 material line equal to its procedure.
// The old +/- buttons multiplied floats and left the material line at the old quantity.
describe('changeLineQuantity', () => {
  const procedureTariff = tariff('8341', { price: '373.90' });
  const procedure = added(buildTariffLine(procedureTariff, 1, '', false));
  const material = added(buildMaterialFactorLine([tariff('8346')], procedure, false));

  it('re-prices the line and moves its material line to the same quantity', () => {
    const { services, line } = changeLineQuantity([procedure, material], procedure.id, 3, [procedureTariff], false);
    expect(line?.ok).toBe(true);
    expect(services[0]).toMatchObject({ quantity: 3, totalPrice: 1121.7 });
    expect(services[1]).toMatchObject({ quantity: 3, unitPrice: 37.39, totalPrice: 112.17 });
    expect(findInvoiceLineProblems(services)).toEqual([]);
  });

  it('refuses more than one unit of a code the tariff bills once per line and changes nothing', () => {
    const onceTariff = tariff('8101', { can_be_multiplied: 'NO' });
    const once = added(buildTariffLine(onceTariff, 1, '', false));
    const result = changeLineQuantity([once], once.id, 2, [onceTariff], false);
    expect(result.line?.ok).toBe(false);
    expect(result.services).toEqual([once]);
  });

  it('uses the tariff rule, so a progressive code is flagged for review when it goes above 1', () => {
    const progressiveTariff = tariff('8340', { can_be_multiplied: 'PROGRESSIVE' });
    const progressive = added(buildTariffLine(progressiveTariff, 1, '', false));
    expect(serviceMultiplyRule(progressive, [progressiveTariff])).toBe('PROGRESSIVE');
    expect(changeLineQuantity([progressive], progressive.id, 2, [progressiveTariff], false).line).toMatchObject({
      ok: true, needsReview: true, total: 200
    });
  });

  it('falls back to the stored flag for lines whose tariff is not loaded (older invoices)', () => {
    expect(serviceMultiplyRule({ ...procedure, tariffId: 'gone', canBeMultiplied: false }, [])).toBe('NO');
    expect(changeLineQuantity([procedure], 'missing', 2, [], false).line).toBeNull();
  });
});

// Business rule (parity D1): staff with billing rights may charge a line another fee than the price list, with a short
// reason; the claim sends the fee charged. The price list's fee is kept, so the invoice shows what changed and the
// change can be undone; the 8346 material factor stays 10% of its restoration's fee, as for a quantity change.
describe('changeLineFee', () => {
  const procedureTariff = tariff('8341', { price: '373.90' });
  const procedure = added(buildTariffLine(procedureTariff, 1, '', false));
  const material = added(buildMaterialFactorLine([tariff('8346')], procedure, false));
  const change = { unitPrice: 300, reason: ' Pensioner rate ', by: 'user-1', at: '2026-10-09T08:00:00.000Z' };

  it('charges the new fee, keeps the price before with the reason, who and when, and moves the material line with it', () => {
    const { services, error } = changeLineFee([procedure, material], procedure.id, change, [procedureTariff], false);
    expect(error).toBeNull();
    expect(services[0]).toMatchObject({
      unitPrice: 300,
      totalPrice: 300,
      feeOverride: { reason: 'Pensioner rate', fromUnitPrice: 373.9, by: 'user-1', at: '2026-10-09T08:00:00.000Z' }
    });
    expect(services[1]).toMatchObject({ unitPrice: 30, totalPrice: 30 });
    expect(findInvoiceLineProblems(services)).toEqual([]);
  });

  it('keeps the first price list fee through a second change, and goes back to it when undone', () => {
    const once = changeLineFee([procedure], procedure.id, change, [procedureTariff], false).services;
    const twice = changeLineFee(once, procedure.id, { ...change, unitPrice: 250 }, [procedureTariff], false).services;
    expect(twice[0].feeOverride?.fromUnitPrice).toBe(373.9);
    const undone = changeLineFee(twice, procedure.id, null, [procedureTariff], false).services;
    expect(undone[0]).toMatchObject({ unitPrice: 373.9, totalPrice: 373.9, feeOverride: undefined });
    // Typing the price list fee again is no change either
    expect(changeLineFee(once, procedure.id, { ...change, unitPrice: 373.9 }, [procedureTariff], false).services[0].feeOverride).toBeUndefined();
  });

  it('refuses a fee without a reason, a negative fee and one below the discount, and changes nothing', () => {
    expect(changeLineFee([procedure], procedure.id, { ...change, reason: '  ' }, [], false)).toEqual({ services: [procedure], error: expect.stringMatching(/Say why/) });
    expect(changeLineFee([procedure], procedure.id, { ...change, unitPrice: -1 }, [], false).error).toMatch(/cannot be negative/);
    const discounted = { ...procedure, discountAmount: 100 };
    expect(changeLineFee([discounted], procedure.id, { ...change, unitPrice: 50 }, [], false).error).toMatch(/lower the discount first/);
    expect(changeLineFee([material], material.id, change, [], false).error).toMatch(/priced by its rule/);
  });

  it('checks a fee the way it will be saved (amount format, reason length)', () => {
    expect(feeChangeProblem(procedure, 300.005, 'x')).toMatch(/400\.00/);
    expect(feeChangeProblem(procedure, 300, 'x'.repeat(201))).toMatch(/200 characters/);
    expect(feeChangeProblem(procedure, 300, 'Pensioner rate')).toBeNull();
  });
});

// Business rule: when an invoice's lines are rewritten they are saved the way invoiceService saves
// them on create - the medical aid / patient split follows the patient's record, the tooth numbers
// are kept for the claim, and system_transaction_number is left to the database trigger (the old
// update path wrote random numbers and dropped the teeth).
describe('toInvoiceServiceRow', () => {
  const line = added(buildTariffLine(tariff('8341', { price: '373.90', requires_tooth_number: 'YES' }), 2, '16', true));

  it('sends a medical aid patient line to the fund and charges a private patient in full', () => {
    expect(toInvoiceServiceRow(line, 'invoice-1', true)).toMatchObject({ total_price: 747.8, medical_aid_covered: 747.8, patient_portion: 0 });
    expect(toInvoiceServiceRow(line, 'invoice-1', false)).toMatchObject({ medical_aid_covered: 0, patient_portion: 747.8 });
  });

  it('keeps the tooth numbers and leaves the transaction number to the database', () => {
    const row = toInvoiceServiceRow({ ...line, teethNumbers: ['16', '17'] }, 'invoice-1', true);
    expect(row.tooth_number).toBe('16,17');
    expect(row).not.toHaveProperty('system_transaction_number');
    expect(toInvoiceServiceRow({ ...line, teethNumbers: undefined }, 'invoice-1', true).tooth_number).toBeNull();
  });

  it('throws on a line computeLine refuses instead of saving it as N$ 0.00', () => {
    expect(() => toInvoiceServiceRow({ ...line, quantity: 0 }, 'invoice-1', true)).toThrow(/greater than 0/);
  });
});

// Business rule: only a tariff in effect on the visit date may be billed. An inactive, expired or
// not-yet-effective row must not be offered, and when the practice updates a price the newest version
// is billed. The visit screens offered every row and took the first 8109 / 8346 row they found, so a
// visit could be billed last year's price.
describe('billableVisitTariffs: only tariffs in effect on the visit date are offered', () => {
  const oldInfectionControl = tariff('8109', { price: '40.00', effective_from: '2025-01-01', can_be_multiplied: 'NO' });
  const newInfectionControl = tariff('8109', { price: '45.50', effective_from: '2026-01-01', can_be_multiplied: 'NO' });
  const rows = [
    oldInfectionControl, // listed first, so a lookup on the raw rows would bill the old price
    newInfectionControl,
    tariff('8101', { is_active: false }),
    tariff('8102', { effective_to: '2025-12-31' }),
    tariff('8103', { effective_from: '2027-01-01' }),
    tariff('8104', { price: '100.00', effective_from: '2026-01-01' }),
    tariff('8104', { price: '120.00', effective_from: '2026-01-01' }),
    tariff('8105', { price: '135.4' })
  ];

  it('keeps one current row per code, with its cleaned price', () => {
    const billable = billableVisitTariffs(rows, '2026-10-06');
    expect(billable.map(row => row.code)).toEqual(['8105', '8109']);
    expect(billable.find(row => row.code === '8109')).toMatchObject({ id: newInfectionControl.id, price: 45.5 });
    expect(billable.find(row => row.code === '8105')?.price).toBe(135.4);
  });

  it('bills 8109 at the price in effect, not at the first matching row', () => {
    expect(added(buildInfectionControlLine(billableVisitTariffs(rows, '2026-10-06'), false))).toMatchObject({
      tariffId: newInfectionControl.id,
      unitPrice: 45.5
    });
  });

  it('uses the tariffs in effect on a back-dated visit', () => {
    const billable = billableVisitTariffs(rows, '2025-06-01');
    expect(billable.map(row => row.code)).toEqual(['8102', '8105', '8109']);
    expect(billable.find(row => row.code === '8109')).toMatchObject({ id: oldInfectionControl.id, price: 40 });
  });
});

// Business rule: the visit header total is the sum of the lines shown, to the cent. The headers
// added floats and showed Math.floor + toFixed: lines of 0.70 + 0.10 + 0.20 add up to
// 0.9999999999999999, which was shown as N$ 0.00 instead of N$ 1.00.
describe('sumServiceTotals', () => {
  const lineWithTotal = (totalPrice: number): ServiceSelection => ({ ...added(buildTariffLine(tariff('8101'), 1, '', false)), totalPrice });

  it('adds the lines in whole cents', () => {
    const total = sumServiceTotals([lineWithTotal(0.7), lineWithTotal(0.1), lineWithTotal(0.2)]);
    expect(total).toBe(1);
    expect(nadParts(total)).toEqual({ whole: '1', cents: '00' });
    expect(sumServiceTotals([lineWithTotal(135.4), lineWithTotal(135.4), lineWithTotal(135.4)])).toBe(406.2);
  });

  it('counts a line without a usable total as nothing rather than breaking the header', () => {
    expect(sumServiceTotals([lineWithTotal(Number.NaN), lineWithTotal(12.5)])).toBe(12.5);
    expect(sumServiceTotals([])).toBe(0);
  });
});

// --------------------------------------------------------------------------------------------------------------------
// Fund prices and the 8109 staff count
// --------------------------------------------------------------------------------------------------------------------

const fundRow = (code: string, unitPrice: string, overrides: Partial<FundTariffRow> = {}): FundTariffRow => ({
  id: crypto.randomUUID(),
  practice_id: null,
  fund_reference: 'MAG1',
  code,
  unit_price: unitPrice,
  effective_from: '2023-12-13',
  ...overrides
});
// PSEMAS prices from the practice's claims, against the NAMAF 2025 prices of the practice tariff
const PSEMAS: FundPriceBook = { rows: [fundRow('8109', '20.00'), fundRow('8369', '386.10'), fundRow('8101', '148.30')], contracts: [] };
const psemasPatient: VisitPricing = { practiceId: 'practice-1', fund: { reference: 'MAG1', planOptions: [], name: 'PSEMAS' }, book: PSEMAS };
const namaf = () => [
  tariff('8101', { price: '254.70', can_be_multiplied: 'NO' }),
  tariff('8109', { price: '34.40', can_be_multiplied: 'SOMETIMES' }),
  tariff('8110', { price: '76.80', can_be_multiplied: 'NO' }),
  tariff('8346', { price: '0' }),
  tariff('8369', { price: '663.00', can_be_multiplied: 'NO', requires_tooth_number: 'YES' })
];

// Business rule: PSEMAS pays its own lower tariff; a PSEMAS line at the NAMAF price is cut on assessment. Every line
// built for a PSEMAS patient - the code, its 8109 and its 8346 (10% of the PSEMAS restoration price) - uses PSEMAS prices.
describe('priceForPatient: a PSEMAS patient is billed the PSEMAS schedule', () => {
  const priced = priceForPatient(billableVisitTariffs(namaf(), '2026-10-07'), '2026-10-07', psemasPatient);
  const find = (code: string) => priced.find(row => row.code === code) as VisitTariff;

  it('prices the visit lines from the fund schedule', () => {
    const filling = added(buildTariffLine(find('8369'), 1, '16', true));
    const infectionControl = added(buildInfectionControlLine(priced, true, filling.id, 2));
    const material = added(buildMaterialFactorLine(priced, filling, true));
    expect(filling).toMatchObject({ unitPrice: 386.1, totalPrice: 386.1 });
    expect(infectionControl).toMatchObject({ unitPrice: 20, quantity: 2, totalPrice: 40 });
    expect(material).toMatchObject({ unitPrice: 38.61, totalPrice: 38.61 });
    expect(findInvoiceLineProblems([infectionControl, filling, material])).toEqual([]);
  });

  it('bills a code the fund has no price for at the practice tariff, with a warning to check the rate', () => {
    const outcome = buildTariffLine(find('8110'), 1, '', true);
    expect(added(outcome).unitPrice).toBe(76.8);
    expect(outcome.ok && outcome.warnings.join(' ')).toContain('PSEMAS (MAG1) has no price for code 8110');
    expect(fundPricingNotice(psemasPatient, '2026-10-07')).toContain('PSEMAS (MAG1) prices');
    expect(fundPricingNotice(null, '2026-10-07')).toBeNull();
  });

  it('refuses a code whose fund price is ambiguous instead of guessing', () => {
    const conflicting = { ...psemasPatient, book: { rows: [...PSEMAS.rows, fundRow('8101', '200.00')], contracts: [] } };
    const [exam] = priceForPatient(billableVisitTariffs([tariff('8101', { price: '254.70' })], '2026-10-07'), '2026-10-07', conflicting);
    expect(buildTariffLine(exam, 1, '', true)).toEqual({ ok: false, message: expect.stringContaining('8101 has two different MAG1 prices') });
    expect(tariffLineInput(exam, 1, true)).toBeNull();
  });
});

// Business rule: a private patient, a patient whose fund has no schedule, and every patient before the fund tables
// exist must get exactly today's prices. Generated visits at real prices: the priced list is the list itself.
describe('priceForPatient changes nothing without fund prices', () => {
  it('returns the same tariffs and builds the same lines in 1,000 generated visits', () => {
    const random = seededRandom(7102026);
    const codes = ['8101', '8104', '8107', '8109', '8110', '8145', '8159', '8201', '8367', '8369'];
    const patients: Array<VisitPricing | null> = [
      null,
      { practiceId: 'practice-1', fund: null, book: PSEMAS },
      { practiceId: 'practice-1', fund: { reference: 'NMC1', planOptions: ['Essential'] }, book: PSEMAS },
      { practiceId: 'practice-1', fund: { reference: 'MAG1', planOptions: [] }, book: { rows: [], contracts: [] } }
    ];
    for (let run = 0; run < 1000; run += 1) {
      const rows = codes.map(code => tariff(code, { price: pick(random, REAL_PRICES).toFixed(2), can_be_multiplied: pick(random, ['NO', 'YES']) }));
      const billable = billableVisitTariffs(rows, '2026-10-07');
      const priced = priceForPatient(billable, '2026-10-07', pick(random, patients));
      expect(priced).toEqual(billable);
      const index = intBetween(random, 0, billable.length - 1);
      const quantity = intBetween(random, 1, 3);
      const medicalAid = random() < 0.5;
      const before = buildTariffLine(billable[index], quantity, '', medicalAid);
      const after = buildTariffLine(priced[index], quantity, '', medicalAid);
      expect(after.ok).toBe(before.ok);
      if (before.ok && after.ok) expect({ ...after.service, id: '' }).toEqual({ ...before.service, id: '' });
    }
  }, 30_000);
});

// Business rule: NAMAF bills 8109 per dentist, hygienist and assistant at the visit; the practice billed 2 on 99.5% of
// its claim lines, but the screens added 1 and blocked more. The line now starts at the practice's staff count, can be
// changed from 1 to 3 and passes the invoice check; nothing above 3 is accepted.
describe('8109 is billed per clinical staff member', () => {
  const tariffs = [tariff('8109', { price: '34.40', can_be_multiplied: 'NO' })];

  it('starts at the staff count from the practice setting (1 without one)', () => {
    expect(added(buildInfectionControlLine(tariffs, true))).toMatchObject({ quantity: 1, totalPrice: 34.4, maxQuantity: 3, canBeMultiplied: true });
    expect(added(buildInfectionControlLine(tariffs, true, undefined, 2))).toMatchObject({ quantity: 2, totalPrice: 68.8 });
    expect(added(buildInfectionControlLine(tariffs, true, undefined, 7))).toMatchObject({ quantity: 1 });
  });

  it('can be changed between 1 and 3 on the screen, whatever the tariff row says, and the invoice accepts it', () => {
    const line = added(buildInfectionControlLine(tariffs, true, undefined, 2));
    expect(quantityControls(line)).toEqual({ editable: true, max: 3 });
    expect(serviceMultiplyRule(line, tariffs)).toBe('YES');
    const three = changeLineQuantity([line], line.id, 3, tariffs, true);
    expect(three.services[0]).toMatchObject({ quantity: 3, totalPrice: 103.2 });
    expect(findInvoiceLineProblems(three.services)).toEqual([]);
    const four = changeLineQuantity([line], line.id, 4, tariffs, true);
    expect(four.line).toMatchObject({ ok: false, errors: [expect.stringContaining('1 to 3')] });
    expect(four.services).toEqual([line]);
    expect(changeLineQuantity([line], line.id, 1.5, tariffs, true).line?.ok).toBe(false);
    expect(findInvoiceLineProblems([{ ...line, quantity: 4, totalPrice: 137.6 }])).toEqual([expect.stringContaining('at most 3')]);
  });

  it('leaves other required or automatic lines without quantity controls, as before', () => {
    const procedure = added(buildTariffLine(tariff('8341', { price: '373.90' }), 1, '', false));
    const material = added(buildMaterialFactorLine([tariff('8346')], procedure, false));
    expect(quantityControls(procedure)).toEqual({ editable: true, max: 99 });
    expect(quantityControls(material).editable).toBe(false);
    expect(quantityControls({ ...procedure, canBeMultiplied: false }).editable).toBe(false);
  });
});

// Business rule: tooth numbers are a NAMAF dental rule. A GP or specialist tariff row flagged for a tooth must not block
// the line or ask staff for a tooth that means nothing.
describe('withDisciplineRules', () => {
  const rows = [tariff('0190', { requires_tooth_number: 'YES' }), tariff('8369', { requires_tooth_number: 'YES' })];

  it('keeps tooth flags for dental practices and clears them for every other practice type', () => {
    expect(withDisciplineRules(rows, 'dental')).toEqual(rows);
    expect(withDisciplineRules(rows, 'medical').map(row => row.requires_tooth_number)).toEqual(['NO', 'NO']);
    expect(added(buildTariffLine(withDisciplineRules(rows, 'medical')[0], 1, '', false)).requiresTeethNumbers).toBe(false);
  });
});

// Business rule: in a dental practice 8109 is per clinical staff member however it is added, so a hand-picked or
// bundled 8109 line also stops at 3; other practice types have no such limit.
describe('withDisciplineRules limits 8109 in dental practices', () => {
  const rows = [tariff('8109', { price: '34.40', can_be_multiplied: 'YES' })];

  it('accepts 1 to 3 staff on a hand-picked 8109 line and refuses more', () => {
    const [dental] = withDisciplineRules(rows, 'dental');
    expect(added(buildTariffLine(dental, 3, '', true))).toMatchObject({ quantity: 3, totalPrice: 103.2, maxQuantity: 3, canBeMultiplied: true });
    expect(buildTariffLine(dental, 4, '', true)).toEqual({ ok: false, message: expect.stringContaining('1 to 3') });
    expect(added(buildTariffLine(withDisciplineRules(rows, 'medical')[0], 4, '', true)).quantity).toBe(4);
  });
});

// Parity D8: who pays a line. A code the practice marks "patient pays all" starts its lines that way for medical aid
// patients (never claimed); saving the visit again keeps it; the fund's levy is charged once per invoice.
describe('who pays each line', () => {
  it("starts a medical aid patient's line with the code's default portion, and a private patient's without one", () => {
    const cosmetic = tariff('9901', { default_paid_by: 'patient' });
    const aid = buildTariffLine(cosmetic, 1, '', true);
    const cash = buildTariffLine(cosmetic, 1, '', false);
    expect(aid.ok && aid.service.paidBy).toBe('patient');
    expect(cash.ok && cash.service.paidBy).toBeUndefined();
    const plain = buildTariffLine(tariff('0190'), 1, '', true);
    expect(plain.ok && 'paidBy' in plain.service).toBe(false);
  });

  // A material line belongs to its procedure: when the patient pays the procedure, the fund is not claimed its 8346
  it("gives the 8346 line its procedure's payer", () => {
    const filling = buildTariffLine(tariff('8367', { default_paid_by: 'patient', requires_tooth_number: 'YES' }), 1, '16', true);
    if (!filling.ok) throw new Error(filling.message);
    const material = buildMaterialFactorLine([tariff('8346')], filling.service, true);
    expect(material.ok && material.service.paidBy).toBe('patient');
  });

  it('reads the payer and authorisation number back from a stored line, so saving again keeps them', () => {
    expect(linePortionFromRow({ paid_by: 'patient', authorisation_number: ' A12 ' })).toEqual({ paidBy: 'patient', authorisationNumber: 'A12' });
    expect(linePortionFromRow({ paid_by: null, authorisation_number: null })).toEqual({});
    expect(linePortionFromRow({ paid_by: 'someone' })).toEqual({});
  });

  it('saves all lines with the levy charged once, and the patient line all on the patient', () => {
    const lines = [buildTariffLine(tariff('0190'), 1, '', true), buildTariffLine(tariff('9901', { default_paid_by: 'patient' }), 1, '', true)].map(outcome => {
      if (!outcome.ok) throw new Error(outcome.message);
      return outcome.service;
    });
    const rows = toInvoiceServiceRows(lines, 'invoice-1', true, { levy: 20, linePortions: true });
    expect(rows.map(row => [row.code, row.medical_aid_covered, row.patient_portion])).toEqual([['0190', 80, 20], ['9901', 0, 100]]);
    expect((rows[1] as unknown as { paid_by: string }).paid_by).toBe('patient');
  });
});

// --------------------------------------------------------------------------------------------------------------------
// Several practitioners (parity D31) and tooth surfaces (parity D5)
// --------------------------------------------------------------------------------------------------------------------

// Business rule: a partner who charges their own rate (here 120% of the practice's price list) is billed at it on the
// lines they treat; a fund's own agreed price (PSEMAS) is never raised by it, and a practice without rates bills
// exactly as before. The 8346 material line is 10% of the restoration's price, so it follows the rate.
describe("a practitioner's rate prices the visit's list", () => {
  it('raises the practice tariff, keeps the list price, and leaves a fund schedule alone', () => {
    const list = billableVisitTariffs(namaf(), '2026-10-07');
    const atRate = priceForPatient(list, '2026-10-07', { practiceId: 'practice-1', fund: null, book: PSEMAS, ratePercent: 120 });
    const exam = atRate.find(row => row.code === '8101') as VisitTariff;
    expect(exam).toMatchObject({ price: 305.64, list_price: 254.7, rate_percent: 120 });
    const filling = added(buildTariffLine(atRate.find(row => row.code === '8369') as VisitTariff, 1, '16', false));
    expect(added(buildMaterialFactorLine(atRate, filling, false)).unitPrice).toBe(79.56);
    // PSEMAS's own prices stay; a code PSEMAS has no price for is at the practice tariff, so the rate applies to it
    const psemas = priceForPatient(list, '2026-10-07', { ...psemasPatient, ratePercent: 120 });
    expect(psemas.find(row => row.code === '8369')?.price).toBe(386.1);
    expect(psemas.find(row => row.code === '8110')?.price).toBe(92.16);
    expect(priceForPatient(list, '2026-10-07', { practiceId: 'practice-1', fund: null, book: PSEMAS, ratePercent: null })).toEqual(list);
  });

  // A price above the list surprises reception unless the Billing tab says why
  it('says so above the lines', () => {
    expect(fundPricingNotice({ practiceId: 'practice-1', fund: null, book: PSEMAS, ratePercent: 120 }, '2026-10-07')).toBe(
      "New lines are priced at the treating practitioner's rate: 120% of the price list."
    );
    expect(fundPricingNotice({ ...psemasPatient, ratePercent: 120 }, '2026-10-07')).toMatch(/^PSEMAS \(MAG1\) prices: .* 120% of the price list for codes at the practice tariff\.$/);
  });

  // When another practitioner treats a line (a partner at 120%, a hygienist at 80%), the line moves to their rate; a
  // fee typed by hand is what staff decided and stays
  it('moves chosen lines to a rate, with their 8346, and keeps hand-changed fees and fund prices', () => {
    const list = billableVisitTariffs(namaf(), '2026-10-07');
    const atRate = priceForPatient(list, '2026-10-07', { practiceId: 'practice-1', fund: null, book: PSEMAS, ratePercent: 120 });
    const filling = added(buildTariffLine(atRate.find(row => row.code === '8369') as VisitTariff, 1, '16', false));
    const material = added(buildMaterialFactorLine(atRate, filling, false));
    const exam = { ...added(buildTariffLine(atRate.find(row => row.code === '8101') as VisitTariff, 1, '', false)), feeOverride: { reason: 'Agreed', fromUnitPrice: 305.64, by: 'u', at: '2026-10-07T08:00:00Z' } };
    const lines = priceLinesAtRate([filling, material, exam], new Set([filling.id, material.id, exam.id]), 80, atRate, false);
    expect(lines.map(line => [line.code, line.unitPrice, line.totalPrice])).toEqual([
      ['8369', 530.4, 530.4],
      ['8346', 53.04, 53.04],
      ['8101', 305.64, 305.64]
    ]);
    // Back to the list price without a rate; a line not chosen keeps its price
    expect(priceLinesAtRate(lines, new Set([filling.id]), null, atRate, false)[0].unitPrice).toBe(663);
    expect(priceLinesAtRate(lines, new Set(), null, atRate, false)).toEqual(lines);
  });
});

// Parity D5: the surfaces and quadrant come back with a stored line, so saving the visit again keeps them
it('reads the tooth surfaces and quadrant back from a stored line', () => {
  expect(lineTeethFromRow({ tooth_surfaces: ' MO ', tooth_quadrant: null })).toEqual({ toothSurfaces: 'MO' });
  expect(lineTeethFromRow({ tooth_surfaces: null, tooth_quadrant: 3 })).toEqual({ toothQuadrant: 3 });
  expect(lineTeethFromRow({ tooth_quadrant: 7 })).toEqual({});
  expect(lineTeethFromRow({})).toEqual({});
});
