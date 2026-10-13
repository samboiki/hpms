import { describe, expect, it } from 'vitest';
import { mergeOwnTariffs, ownTariffPayload, toothRuleFor, validateOwnTariffDraft, withDefaultPortions, type OwnTariffRow } from '../practiceTariffs';
import { selectBillableTariffs, type TariffRow } from '../pricing';

const shared = (code: string, price: number, from: string, to: string | null = null): TariffRow => ({
  id: `shared-${code}-${from}`,
  code,
  description: `Shared ${code}`,
  price,
  is_active: true,
  effective_from: from,
  effective_to: to,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO'
});

const own = (code: string, price: number, from: string, overrides: Partial<OwnTariffRow> = {}): OwnTariffRow => ({
  id: `own-${code}-${from}`,
  practice_id: 'practice-a',
  code,
  description: `Own ${code}`,
  price,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO',
  effective_from: from,
  is_active: true,
  ...overrides
});

const priceOn = (rows: readonly TariffRow[], code: string, date: string): number | undefined =>
  selectBillableTariffs(rows, date).tariffs.find(tariff => tariff.code === code)?.unitPrice;

describe("a practice's own tariff list (parity E13)", () => {
  // The practice's own price wins from its start date, also over next year's shared benchmark
  it('bills the own price from its first date and the shared price before it', () => {
    const rows = mergeOwnTariffs(
      [shared('0190', 400, '2026-01-01'), shared('0190', 440, '2027-01-01'), shared('0191', 600, '2026-01-01')],
      [own('0190', 450, '2026-10-09')]
    ) as TariffRow[];
    expect(priceOn(rows, '0190', '2026-10-08')).toBe(400);
    expect(priceOn(rows, '0190', '2026-10-09')).toBe(450);
    expect(priceOn(rows, '0190', '2027-03-01')).toBe(450);
    // Codes the practice did not price itself are untouched
    expect(priceOn(rows, '0191', '2027-03-01')).toBe(600);
  });

  // A GP practice has no shared list at all: its own codes are its tariff list
  it('adds codes that only the practice has, with new prices from their own dates', () => {
    const rows = mergeOwnTariffs([], [own('GP01', 350, '2026-01-01'), own('GP01', 380, '2026-11-01')]) as TariffRow[];
    expect(priceOn(rows, 'GP01', '2026-10-31')).toBe(350);
    expect(priceOn(rows, 'GP01', '2026-11-01')).toBe(380);
    expect(priceOn(rows, 'GP01', '2025-12-31')).toBeUndefined();
  });

  // Removing an own code puts the shared price back for every date
  it('ignores removed own codes and malformed rows', () => {
    const rows = mergeOwnTariffs([shared('0190', 400, '2026-01-01')], [
      own('0190', 450, '2026-10-09', { is_active: false }),
      own('bad code', 1, '2026-01-01'),
      own('0191', 1, 'not a date')
    ]) as TariffRow[];
    expect(rows).toHaveLength(1);
    expect(priceOn(rows, '0190', '2026-12-01')).toBe(400);
  });

  // The Tariffs page shows which prices are the practice's own, and the shared version stops the day before
  it('marks own rows and ends the shared version the day before the own price starts', () => {
    const rows = mergeOwnTariffs([shared('0190', 400, '2026-01-01', '2026-12-31')], [own('0190', 450, '2026-06-01')]);
    expect(rows.find(row => row.id === 'own-0190-2026-06-01')).toMatchObject({ is_own: true, effective_to: null });
    expect(rows.find(row => row.id === 'shared-0190-2026-01-01')).toMatchObject({ effective_to: '2026-05-31' });
  });

  // Claim review asks for a tooth exactly when the visit's billing did: the version billed on the line's date, the
  // practice's own first; it does not guess when nothing was billed under the code that day or the date is unknown
  it("says whether a line needs a tooth from the version billed on its date, the practice's own first", () => {
    const rows = mergeOwnTariffs([{ ...shared('8341', 373.9, '2025-01-01'), requires_tooth_number: 'YES' }], [
      own('8341', 380, '2026-10-01', { requires_tooth_number: 'NO' })
    ]) as TariffRow[];
    const needsTooth = toothRuleFor(rows, 'dental');
    expect(needsTooth('8341', '2026-09-30')).toBe(true);
    expect(needsTooth(' 8341', '2026-10-01')).toBe(false);
    expect(needsTooth('9999', '2026-10-01')).toBeNull();
    expect(needsTooth('8341', '2024-12-31')).toBeNull();
    expect(needsTooth('8341', null)).toBeNull();
    // GPs and specialists never number teeth, whatever a row says
    expect(toothRuleFor(rows, 'medical')('8341', '2026-09-30')).toBe(false);
  });

  it("attaches the practice's default portion to each code", () => {
    const rows = withDefaultPortions([shared('0190', 400, '2026-01-01'), shared('9999', 1, '2026-01-01')], new Map([['9999', 'patient' as const]]));
    expect(rows.map(row => row.default_paid_by)).toEqual([null, 'patient']);
  });

  // The database refuses the same things: saying so before saving saves the administrator a round trip
  it('checks a code before it is saved, in plain words', () => {
    const draft = { code: ' gp01 ', description: 'Consultation', price: 'N$ 350.00', perUnit: false, needsTooth: false, fromDate: '2026-10-09' };
    expect(validateOwnTariffDraft(draft)).toEqual([]);
    expect(ownTariffPayload('practice-a', draft)).toEqual({
      p_practice_id: 'practice-a',
      p_code: 'GP01',
      p_description: 'Consultation',
      p_price: 350,
      p_per_unit: false,
      p_needs_tooth: false,
      p_from: '2026-10-09'
    });
    expect(validateOwnTariffDraft({ ...draft, code: '01 90', description: ' ', price: '12.345', fromDate: '2026-02-30' })).toHaveLength(4);
  });
});
