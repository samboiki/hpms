/**
 * The codes a stay is billed under. Why it matters on a ward: the private hospital's ward fees per day (NAMAF 57001
 * surgical, 57201 ICU ...) have no fixed amount (57007 day admission has one, N$ 2,914.10), and a night is billed at the
 * bed's daily rate, so the bed supplies the price; a bed with no rate is billed at the code's NAMAF amount for that night's
 * date, and where NAMAF has none the person billing types it. A practice whose own list has the code must bill its own
 * tariff, not the benchmark; and the ward setup must name exactly what the stay bill will use. Invented codes, beds and amounts.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

import { wardTariffLookup } from '../useWardTariffs';
import { stayBill, stayNights } from '../../../utils/inpatient/inpatientRules';
import { wardDayTariffs } from '../../../utils/billing/namafTariffs';

const wardCodes = wardDayTariffs([
  { id: 'n-57001', discipline_code: '057', tariff_code: '57001', code: '001', description: 'SURGICAL CASES: PER DAY', amount: 0, units: 0, valid_from: '2026-01-01', valid_to: '2026-12-31' },
  { id: 'n-57201', discipline_code: '057', tariff_code: '57201', code: '201', description: 'INTENSIVE CARE UNIT: PER DAY', amount: null, units: null, valid_from: '2026-01-01', valid_to: '2026-12-31' },
  { id: 'n-57007', discipline_code: '057', tariff_code: '57007', code: '007', description: 'DAY ADMISSION: ALL PATIENTS DISCHARGED BY 23H00', amount: 2914.1, units: 0, valid_from: '2026-01-01', valid_to: '2026-12-31' }
]);

const stay = (bedLabel: string, dailyRate: number | null, from = '2026-10-10T08:00:00Z', leftAt = '2026-10-12T08:00:00Z') =>
  stayNights([{ bedId: bedLabel, bedLabel, wardId: 'w1', wardName: 'Ward', dailyRate, from, to: null }], leftAt);
const wardWith = (code: string) => new Map([['w1', { bedDayCode: code, dailyCodes: [] }]]);

describe('the tariff a ward code bills as', () => {
  it("takes the practice's own list first, then its NAMAF list, then the hospital ward fees", () => {
    const practiceList = [{ id: 'p-201', code: '201', description: 'Own ICU day', price: 9000, can_be_multiplied: 'NO' }];
    const namafList = [{ id: 'g-0190', code: '0190', description: 'Consultation', price: 521.4 }];
    const lookup = wardTariffLookup(practiceList, namafList, wardCodes);
    expect(lookup('201')).toMatchObject({ id: 'p-201', description: 'Own ICU day' });
    expect(lookup(' 0190 ')).toMatchObject({ id: 'g-0190' });
    expect(lookup('001')).toMatchObject({ id: 'n-57001', description: 'SURGICAL CASES: PER DAY', price: 0 });
    expect(lookup('999')).toBeUndefined();
  });

  it("bills a night under a ward fee with no fixed amount at the bed's daily rate", () => {
    const bill = stayBill({ nights: stay('S1', 1850), wards: wardWith('001'), tariffByCode: wardTariffLookup([], [], wardCodes) });
    expect(bill.problems).toEqual([]);
    expect(bill.lines.map(line => [line.code, line.unitPrice, line.serviceDate])).toEqual([['001', 1850, '2026-10-10'], ['001', 1850, '2026-10-11']]);
  });

  // A bed that has a rate is billed at it under every bed-day code alike, whatever amount the list shows for the code
  it("bills a night under the day-admission code at the bed's daily rate when the bed has one, not at the list's amount", () => {
    expect(wardDayTariffs([{ id: 'n-57007', discipline_code: '057', tariff_code: '57007', code: '007', description: 'DAY ADMISSION', amount: 2914.1, units: 0, valid_from: '2026-01-01', valid_to: '2026-12-31' }])[0]).toMatchObject({ code: '007', price: 2914.1, no_fixed_amount: false });
    const bill = stayBill({ nights: stay('D1', 1850), wards: wardWith('007'), tariffByCode: wardTariffLookup([], [], wardCodes) });
    expect(bill.problems).toEqual([]);
    expect(bill.lines.map(line => line.unitPrice)).toEqual([1850, 1850]);
    expect(bill.lines.map(line => bill.sources[line.id])).toEqual(['bed rate', 'bed rate']);
  });
});

// Why: a bed whose rate was never entered must not stop the stay being billed. The code's NAMAF amount for the night is the
// next best price, labelled so the person billing sees it is the benchmark and not the bed's own rate.
describe('a bed with no daily rate is billed at the NAMAF amount of the ward code', () => {
  it('bills 57007 day admission at its NAMAF 2026 amount and labels the line', () => {
    const bill = stayBill({ nights: stay('D1', null), wards: wardWith('007'), tariffByCode: wardTariffLookup([], [], wardCodes) });
    expect(bill.problems).toEqual([]);
    expect(bill.lines.map(line => [line.code, line.unitPrice, bill.sources[line.id]])).toEqual([['007', 2914.1, 'NAMAF 2026'], ['007', 2914.1, 'NAMAF 2026']]);
  });

  it('asks the person billing for the amount of a ward fee NAMAF gives no fixed amount (surgical 57001), instead of blocking or billing N$ 0', () => {
    const bill = stayBill({ nights: stay('S1', null), wards: wardWith('001'), tariffByCode: wardTariffLookup([], [], wardCodes) });
    expect(bill.problems).toEqual([]);
    expect(bill.lines).toEqual([]);
    expect(bill.asks).toMatchObject([{ key: 'bed:S1', nights: 2 }]);
    const typed = stayBill({ nights: stay('S1', null), wards: wardWith('001'), tariffByCode: wardTariffLookup([], [], wardCodes), typedAmounts: { 'bed:S1': 1650 } });
    expect(typed.lines.map(line => [line.unitPrice, typed.sources[line.id]])).toEqual([[1650, 'typed in'], [1650, 'typed in']]);
  });

  it("prefers the practice's own price for the code to the NAMAF benchmark, and says it is the price list", () => {
    const practiceList = [{ id: 'p-007', code: '007', description: 'Own day admission', price: 2100 }];
    const bill = stayBill({ nights: stay('D1', null), wards: wardWith('007'), tariffByCode: wardTariffLookup(practiceList, [], wardCodes) });
    expect(bill.lines.map(line => [line.tariffId, line.unitPrice, bill.sources[line.id]])).toEqual([['p-007', 2100, 'price list'], ['p-007', 2100, 'price list']]);
  });
});

// NAMAF publishes a new list each year and the rows keep their start dates. A night must be priced with the list that was in
// force that night, otherwise a stay across New Year is billed at the wrong year's amount.
describe('the NAMAF version in force on the night', () => {
  const twoYears = wardDayTariffs([
    { id: 'n-2027', discipline_code: '057', tariff_code: '57007', code: '007', description: 'DAY ADMISSION', amount: 3100, units: 0, valid_from: '2027-01-01', valid_to: '2027-12-31' },
    { id: 'n-2026', discipline_code: '057', tariff_code: '57007', code: '007', description: 'DAY ADMISSION', amount: 2914.1, units: 0, valid_from: '2026-01-01', valid_to: '2026-12-31' }
  ]);

  it('picks the latest version that has started, whatever order the rows come in', () => {
    const lookup = wardTariffLookup(twoYears);
    expect(lookup('007', '2026-12-31')).toMatchObject({ id: 'n-2026', price: 2914.1, priceSource: 'NAMAF 2026' });
    expect(lookup('007', '2027-01-01')).toMatchObject({ id: 'n-2027', price: 3100, priceSource: 'NAMAF 2027' });
  });

  it('keeps using the last list after its end date until the next one is loaded, as billing does on 1 January', () => {
    expect(wardTariffLookup(wardCodes)('007', '2027-03-01')).toMatchObject({ price: 2914.1, priceSource: 'NAMAF 2026' });
  });

  it('has no amount for a night before the first list started, and never uses a later year for it', () => {
    const before = wardTariffLookup(wardCodes)('007', '2025-12-31');
    expect(before).toMatchObject({ id: 'n-57007', price: 0 });
    expect(before?.priceSource).toBeUndefined();
  });

  it('bills a stay across New Year at each year\'s amount', () => {
    const nights = stay('D1', null, '2026-12-30T08:00:00Z', '2027-01-02T08:00:00Z');
    const bill = stayBill({ nights, wards: wardWith('007'), tariffByCode: wardTariffLookup(twoYears) });
    expect(bill.lines.map(line => [line.serviceDate, line.unitPrice, bill.sources[line.id]])).toEqual([
      ['2026-12-30', 2914.1, 'NAMAF 2026'],
      ['2026-12-31', 2914.1, 'NAMAF 2026'],
      ['2027-01-01', 3100, 'NAMAF 2027']
    ]);
  });

  it('does not date-check the practice\'s own list: its tariff row is the one billable today, whatever night is billed', () => {
    const own = [{ id: 'p-1', code: 'N200', description: 'Own nursing day', price: 150, effective_from: '2026-10-01' }];
    expect(wardTariffLookup(own)('N200', '2026-09-28')).toMatchObject({ id: 'p-1', price: 150 });
  });
});
