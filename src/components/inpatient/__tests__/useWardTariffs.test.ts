/**
 * The codes a stay is billed under. Why it matters on a ward: the private hospital's ward fees per day (NAMAF 57001
 * surgical, 57201 ICU ...) have no fixed amount (57007 day admission has one, N$ 2,914.10), and a night is always billed at
 * the bed's daily rate, so the bed must supply the price; a practice whose own list has
 * the code must bill its own tariff, not the benchmark; and the ward setup must name exactly what the bill will use.
 * Invented codes, beds and amounts.
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
    const nights = stayNights([{ bedId: 'b1', bedLabel: 'S1', wardId: 'w1', wardName: 'Surgical', dailyRate: 1850, from: '2026-10-10T08:00:00Z', to: null }], '2026-10-12T08:00:00Z');
    const bill = stayBill({ nights, wards: new Map([['w1', { bedDayCode: '001', dailyCodes: [] }]]), tariffByCode: wardTariffLookup([], [], wardCodes) });
    expect(bill.problems).toEqual([]);
    expect(bill.lines.map(line => [line.code, line.unitPrice, line.serviceDate])).toEqual([['001', 1850, '2026-10-10'], ['001', 1850, '2026-10-11']]);
  });

  // 57007 is the one ward code that carries a NAMAF amount. A ward's setup sets the bed's rate, so a night is billed at it
  // under every bed-day code alike; the setup says so instead of calling these codes "without an amount"
  it("bills a night under the day-admission code at the bed's daily rate too, not at the list's amount", () => {
    expect(wardDayTariffs([{ id: 'n-57007', discipline_code: '057', tariff_code: '57007', code: '007', description: 'DAY ADMISSION', amount: 2914.1, units: 0, valid_from: '2026-01-01', valid_to: '2026-12-31' }])[0]).toMatchObject({ code: '007', price: 2914.1, no_fixed_amount: false });
    const nights = stayNights([{ bedId: 'b2', bedLabel: 'D1', wardId: 'w2', wardName: 'Day ward', dailyRate: 1850, from: '2026-10-10T08:00:00Z', to: null }], '2026-10-12T08:00:00Z');
    const bill = stayBill({ nights, wards: new Map([['w2', { bedDayCode: '007', dailyCodes: [] }]]), tariffByCode: wardTariffLookup([], [], wardCodes) });
    expect(bill.problems).toEqual([]);
    expect(bill.lines.map(line => line.unitPrice)).toEqual([1850, 1850]);
  });
});
