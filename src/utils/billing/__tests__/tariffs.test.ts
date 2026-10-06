import { describe, it, expect } from 'vitest';
import {
  selectBillableTariffs,
  getTariffExclusion,
  searchTariffs,
  normalizeMultiplyRule,
  parseYesNo,
  parseTariffPrice,
  summarizeExclusions,
  type TariffRow
} from '../pricing';
import { dayRange, localKey } from './generators';

const row = (overrides: Partial<TariffRow> = {}): TariffRow => ({
  id: overrides.id ?? `id-${overrides.code ?? '8101'}`,
  code: '8101',
  description: 'Full mouth examination, charting and treatment planning',
  price: 254.7,
  unit: 'per visit',
  is_active: true,
  effective_from: null,
  effective_to: null,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO',
  ...overrides
});

// Oracle for date shifts: plain JS Date arithmetic on the local calendar
const shiftKey = (key: string, days: number): string => {
  const [year, month, day] = key.split('-').map(Number);
  return localKey(new Date(year, month - 1, day + days));
};

// Business rule: a tariff can only be billed on dates it is in effect - from effective_from up to
// and including effective_to. Billing an expired or future price is a wrong price.
describe('effective dates decide which price applies', () => {
  const serviceDates = dayRange('2026-01-01', 53, 7);
  const windows = [
    { label: 'open-ended', from: null, to: null, inEffect: true },
    { label: 'started earlier', from: -30, to: null, inEffect: true },
    { label: 'starts on the day', from: 0, to: null, inEffect: true },
    { label: 'starts tomorrow', from: 1, to: null, inEffect: false },
    { label: 'ends on the day', from: null, to: 0, inEffect: true },
    { label: 'ended yesterday', from: null, to: -1, inEffect: false },
    { label: 'window around the day', from: -10, to: 10, inEffect: true },
    { label: 'window in the future', from: 5, to: 40, inEffect: false },
    { label: 'window in the past', from: -40, to: -5, inEffect: false }
  ] as const;
  const cases = serviceDates.flatMap(date => windows.map(window => ({ date, ...window })));

  it.each(cases)('$date: $label', ({ date, from, to, inEffect }) => {
    const tariff = row({
      effective_from: from === null ? null : shiftKey(date, from),
      effective_to: to === null ? null : shiftKey(date, to)
    });
    const { tariffs, excluded } = selectBillableTariffs([tariff], date);
    expect(tariffs.length).toBe(inEffect ? 1 : 0);
    if (!inEffect) expect(['not_yet_effective', 'expired']).toContain(excluded[0].reason);
  });

  it('accepts timestamps and compact dates in the effective columns', () => {
    expect(getTariffExclusion(row({ effective_from: '2026-01-01T00:00:00+00:00' }), '2026-01-01')).toBeNull();
    expect(getTariffExclusion(row({ effective_to: '20251231' }), '2026-01-01')).toBe('expired');
  });

  it('rejects an invalid service date instead of guessing one', () => {
    expect(() => selectBillableTariffs([row()], '06/10/2026')).toThrow(RangeError);
  });
});

// Business rule: inactive, broken or ambiguous tariff rows are never offered for billing, and the
// screen is told why so an administrator can fix the tariff list.
describe('rows that must not be billed', () => {
  it.each([
    { label: 'inactive', overrides: { is_active: false }, reason: 'inactive' },
    { label: 'no code', overrides: { code: '  ' }, reason: 'missing_code' },
    { label: 'no id', overrides: { id: null }, reason: 'missing_code' },
    { label: 'no price', overrides: { price: null }, reason: 'invalid_price' },
    { label: 'empty price', overrides: { price: '' }, reason: 'invalid_price' },
    { label: 'text price', overrides: { price: 'N$254.70' }, reason: 'invalid_price' },
    { label: 'negative price', overrides: { price: -254.7 }, reason: 'invalid_price' },
    { label: 'NaN price', overrides: { price: Number.NaN }, reason: 'invalid_price' },
    { label: 'absurd price', overrides: { price: 2_000_000 }, reason: 'invalid_price' },
    { label: 'impossible date', overrides: { effective_from: '2026-02-30' }, reason: 'invalid_dates' },
    { label: 'garbage date', overrides: { effective_to: 'next year' }, reason: 'invalid_dates' },
    { label: 'from after to', overrides: { effective_from: '2026-05-01', effective_to: '2026-04-01' }, reason: 'invalid_dates' }
  ] as const)('$label', ({ overrides, reason }) => {
    const { tariffs, excluded } = selectBillableTariffs([row(overrides as Partial<TariffRow>)], '2026-04-15');
    expect(tariffs).toHaveLength(0);
    expect(excluded[0].reason).toBe(reason);
  });

  it('treats an unknown is_active (null) as active and a numeric-string price as a price', () => {
    const { tariffs } = selectBillableTariffs([row({ is_active: null, price: '135.40' })], '2026-04-15');
    expect(tariffs[0].unitPrice).toBe(135.4);
  });

  it('rounds float noise in stored prices to the cent', () => {
    expect(parseTariffPrice(135.39999999999998)).toBe(135.4);
    expect(parseTariffPrice(' 34.40 ')).toBe(34.4);
  });
});

// Business rule: one price per code. When the tariff list has the same code twice, the version
// with the latest start date is the current price; two versions starting the same day with
// different prices are ambiguous, so that code is withheld instead of picking one at random.
describe('duplicate codes', () => {
  it('uses the newest version of a code', () => {
    const { tariffs, excluded } = selectBillableTariffs(
      [
        row({ id: 'old', price: 240, effective_from: '2025-01-01' }),
        row({ id: 'new', price: 254.7, effective_from: '2026-01-01' })
      ],
      '2026-06-01'
    );
    expect(tariffs.map(t => t.id)).toEqual(['new']);
    expect(excluded).toEqual([{ id: 'old', code: '8101', reason: 'superseded' }]);
  });

  it('ignores a newer version that has not started yet', () => {
    const { tariffs } = selectBillableTariffs(
      [
        row({ id: 'current', price: 254.7, effective_from: '2026-01-01' }),
        row({ id: 'next-year', price: 270, effective_from: '2027-01-01' })
      ],
      '2026-06-01'
    );
    expect(tariffs.map(t => t.id)).toEqual(['current']);
  });

  it('keeps one copy of identical duplicates', () => {
    const { tariffs, excluded } = selectBillableTariffs([row({ id: 'a' }), row({ id: 'b' })], '2026-06-01');
    expect(tariffs.map(t => t.id)).toEqual(['a']);
    expect(excluded[0].reason).toBe('superseded');
  });

  it('withholds a code whose same-day versions disagree on the price', () => {
    const { tariffs, excluded } = selectBillableTariffs(
      [row({ id: 'a', price: 254.7 }), row({ id: 'b', price: 260 }), row({ id: 'c', code: '8104', price: 137.4 })],
      '2026-06-01'
    );
    expect(tariffs.map(t => t.code)).toEqual(['8104']);
    expect(summarizeExclusions(excluded)).toEqual({ conflicting_duplicate: 2 });
  });

  it('treats codes case- and space-insensitively when finding duplicates', () => {
    const { tariffs } = selectBillableTariffs([row({ id: 'a', code: '8101' }), row({ id: 'b', code: ' 8101 ', price: 999 })], '2026-06-01');
    expect(tariffs).toHaveLength(0);
  });

  it('returns codes in natural order', () => {
    const { tariffs } = selectBillableTariffs(
      ['8826', '0190', '8101', '0191', '8109'].map(code => row({ id: code, code })),
      '2026-06-01'
    );
    expect(tariffs.map(t => t.code)).toEqual(['0190', '0191', '8101', '8109', '8826']);
  });
});

// Business rule: quantity rules come from can_be_multiplied. Anything unknown is NO (quantity 1),
// the safe default: it can never multiply a price by mistake.
describe('reading tariff flags', () => {
  it.each([
    ['YES', 'YES'], ['yes', 'YES'], [' Y ', 'YES'], ['TRUE', 'YES'], [true, 'YES'],
    ['NO', 'NO'], ['', 'NO'], [null, 'NO'], [undefined, 'NO'], ['MAYBE', 'NO'], [false, 'NO'], [1, 'NO'],
    ['SOMETIMES', 'SOMETIMES'], ['sometimes', 'SOMETIMES'], ['PROGRESSIVE', 'PROGRESSIVE'], ['Progressive ', 'PROGRESSIVE']
  ])('can_be_multiplied %s -> %s', (value, expected) => {
    expect(normalizeMultiplyRule(value)).toBe(expected);
  });

  it.each([
    ['YES', true], ['Y', true], ['yes', true], [true, true], ['TRUE', true],
    ['NO', false], ['', false], [null, false], [undefined, false], ['SOMETIMES', false], [false, false]
  ])('requires_tooth_number %s -> %s', (value, expected) => {
    expect(parseYesNo(value)).toBe(expected);
  });
});

// Business rule: doctors find codes by number or by words in the description; the exact code is
// always first so typing "8101" never picks a different procedure.
describe('searchTariffs', () => {
  const { tariffs } = selectBillableTariffs(
    [
      row({ id: '1', code: '8101', description: 'Full mouth examination, charting and treatment planning' }),
      row({ id: '2', code: '8104', description: 'Examination or consultation for a specific problem' }),
      row({ id: '3', code: '81010', description: 'Example extended code' }),
      row({ id: '4', code: '8341', description: 'Amalgam - one surface' }),
      row({ id: '5', code: '8107', description: 'Intra-oral radiographs, per film' }),
      row({ id: '6', code: '0190', description: 'Consultation, new or established patient' })
    ],
    '2026-06-01'
  );

  it.each([
    { query: '8101', expected: ['8101', '81010'] },
    { query: ' 810 ', expected: ['8101', '8104', '8107', '81010'] },
    { query: 'EXAMINATION', expected: ['8101', '8104'] },
    { query: 'specific problem', expected: ['8104'] },
    { query: 'consultation', expected: ['0190', '8104'] },
    { query: 'amalgam one', expected: ['8341'] },
    { query: 'radiograph film', expected: ['8107'] },
    { query: 'implant', expected: [] },
    { query: '', expected: ['0190', '8101', '8104', '8107', '8341', '81010'] }
  ])('"$query"', ({ query, expected }) => {
    expect(searchTariffs(tariffs, query).map(t => t.code)).toEqual(expected);
  });
});
