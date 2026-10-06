import { describe, it, expect, vi } from 'vitest';
import {
  billableVisitTariffs,
  buildInfectionControlLine,
  buildMaterialFactorLine,
  buildTariffLine,
  changeLineQuantity,
  priceMaterialFactor,
  serviceMultiplyRule,
  sumServiceTotals,
  tariffLineInput,
  toInvoiceServiceRow,
  type VisitTariff
} from '../visitBillingLines';
import { findInvoiceLineProblems } from '../../../services/invoiceService';
import { nadParts } from '../../../utils/billing/money';
import { REAL_PRICES } from '../../../utils/billing/__tests__/generators';
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
