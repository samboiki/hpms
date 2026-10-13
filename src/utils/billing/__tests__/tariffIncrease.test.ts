/**
 * The yearly price increase (parity E3): a practice puts its prices up by a percentage from a date. The rule that
 * matters most: "people must not get wrong prices", so the base is the price billed the day before, a second run never
 * increases an increase, and a price already set for that date is not replaced unless staff say so.
 */
import { describe, expect, it } from 'vitest';
import { checkIncreaseOptions, increasePayload, increasedPriceCents, nextNewYear, parsePercent, planIncrease, type CheckedIncrease, type IncreaseOptions } from '../tariffIncrease';
import type { TariffRow } from '../pricing';

const row = (code: string, price: number, from: string, overrides: Partial<TariffRow> = {}): TariffRow => ({
  id: `${code}-${from}`,
  code,
  description: `Service ${code}`,
  price,
  is_active: true,
  effective_from: from,
  effective_to: null,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO',
  ...overrides
});

const increase = (overrides: Partial<CheckedIncrease> = {}): CheckedIncrease => ({ percent: 6, fromDate: '2027-01-01', rounding: 'cent', range: null, ...overrides });
const options = (overrides: Partial<IncreaseOptions> = {}): IncreaseOptions => ({
  percent: '6',
  fromDate: '2027-01-01',
  rounding: 'cent',
  scope: 'all',
  fromCode: '',
  toCode: '',
  ...overrides
});

describe('the new price', () => {
  // Whole cents, half up, then to the step chosen: the price on the invoice is the price in the preview
  it.each([
    [45000, 6, 'cent', 47700],
    [33333, 5.5, 'cent', 35166],
    [45050, 6, 'one', 47800],
    [45050, 6, 'five', 48000],
    [45050, 6, 'ten', 48000],
    [44450, 6, 'ten', 47000],
    [44750, 0.5, 'five', 45000],
    [0, 6, 'cent', 0]
  ] as const)('%i cents up %d%% rounded %s is %i', (cents, percent, rounding, expected) => {
    expect(increasedPriceCents(cents, percent, rounding)).toBe(expected);
  });

  it('reads the percentage as staff type it', () => {
    expect(parsePercent('6')).toBe(6);
    expect(parsePercent(' 5,5 % ')).toBe(5.5);
    expect(parsePercent('6.125')).toBeNull();
    expect(parsePercent('six')).toBeNull();
  });

  it('starts a new price list on 1 January next year', () => {
    expect(nextNewYear('2026-10-13')).toBe('2027-01-01');
  });
});

describe('the choices', () => {
  it.each([
    ['no percentage', options({ percent: '' }), /percentage from 0.01 to 100/],
    ['more than 100%', options({ percent: '150' }), /percentage from 0.01 to 100/],
    ['no start date', options({ fromDate: '' }), /date the new prices start/],
    ['a range without its ends', options({ scope: 'range', fromCode: '0190' }), /first and the last code/],
    ['a range the wrong way round', options({ scope: 'range', fromCode: '0199', toCode: '0190' }), /comes after the last one/]
  ])('refuses %s', (_label, typed, message) => {
    const checked = checkIncreaseOptions(typed);
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.errors.join(' ')).toMatch(message);
  });

  it('accepts a range in code order (0190 to 0199)', () => {
    expect(checkIncreaseOptions(options({ scope: 'range', fromCode: '0190', toCode: '0199' }))).toEqual({
      ok: true,
      value: increase({ range: { from: '0190', to: '0199' } })
    });
  });
});

describe('the preview', () => {
  it("puts every code billed the day before up, with its own terms kept, in code order", () => {
    const plan = planIncrease([row('8101', 450, '2025-01-01', { can_be_multiplied: 'YES' }), row('0190', 300, '2026-03-01', { requires_tooth_number: 'YES' })], increase());
    expect(plan).toEqual([
      { code: '0190', description: 'Service 0190', oldPrice: 300, newPrice: 318, perUnit: false, needsTooth: true, include: true, selectable: true, note: null },
      { code: '8101', description: 'Service 8101', oldPrice: 450, newPrice: 477, perUnit: true, needsTooth: false, include: true, selectable: true, note: null }
    ]);
  });

  // Running the increase again must not put the price up twice: the base stays the price of the day before
  it('gives the same new price when run again after the new version exists, and leaves that code unticked', () => {
    const before = [row('0190', 300, '2026-03-01')];
    const after = [...before, row('0190', 318, '2027-01-01', { id: 'own-0190' })];
    const [item] = planIncrease(after, increase());
    expect(item.newPrice).toBe(318);
    expect(item.include).toBe(false);
    expect(item.note).toMatch(/Billed at N\$ 318.00 from 1 Jan 2027 already/);
  });

  // A practice that already set next year's price by hand must not lose it to the increase
  it('leaves a code unticked when another price applies from that date, but staff can tick it', () => {
    const [item] = planIncrease([row('0190', 300, '2026-03-01'), row('0190', 350, '2027-01-01')], increase());
    expect(item).toMatchObject({ oldPrice: 300, newPrice: 318, include: false, selectable: true });
  });

  it('does not offer a code that stops before the date, nor change a N$ 0.00 code', () => {
    const plan = planIncrease([row('0190', 300, '2026-01-01', { effective_to: '2026-12-31' }), row('0201', 0, '2026-01-01')], increase());
    expect(plan.map(item => item.code)).toEqual(['0201']);
    expect(plan[0]).toMatchObject({ include: false, selectable: false, note: 'No change after rounding.' });
  });

  it('keeps to the range chosen', () => {
    const plan = planIncrease([row('0189', 1, '2026-01-01'), row('0190', 1, '2026-01-01'), row('0199', 1, '2026-01-01'), row('0201', 1, '2026-01-01')], increase({ range: { from: '0190', to: '0199' } }));
    expect(plan.map(item => item.code)).toEqual(['0190', '0199']);
  });

  it('sends only the codes ticked, in the shape apply_practice_tariff_increase reads', () => {
    const plan = planIncrease([row('0190', 300, '2026-03-01'), row('0191', 100, '2026-03-01'), row('0191', 120, '2027-01-01')], increase());
    expect(increasePayload(plan)).toEqual([{ code: '0190', description: 'Service 0190', price: 318, per_unit: false, needs_tooth: false }]);
  });

  it('keeps a description the database accepts (1 to 200 characters)', () => {
    const [blank, long] = planIncrease([row('0190', 100, '2026-01-01', { description: '  ' }), row('0191', 100, '2026-01-01', { description: 'x'.repeat(250) })], increase());
    expect(blank.description).toBe('Code 0190');
    expect(long.description).toHaveLength(200);
  });
});
