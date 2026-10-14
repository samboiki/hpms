/**
 * Why these rules matter on a ward: a bed shown free while someone lies in it gets a second patient; a stay billed
 * for the wrong nights or at the wrong bed's rate is money lost or a fund query; a nurse must see which dose is due
 * and which was missed; a visitor warning must never stop a caregiver at the door. All data here is invented.
 */
import { describe, expect, it } from 'vitest';
import {
  boardCounts,
  boardState,
  canDo,
  canTakePatient,
  dayOfStay,
  doseKey,
  dueDoses,
  labelOf,
  ROUTES,
  stayBill,
  stayNights,
  visitorWarnings,
  windhoekMoment,
  type StaySegment,
  type TariffForBilling
} from '../inpatientRules';

const bed = (status: string, admissionId: string | null = null, isActive = true) => ({ id: status, status, isActive, admissionId });

describe('the bed board', () => {
  it('shows a bed with a patient in it as occupied, whatever its stored status says', () => {
    expect(boardState(bed('available', 'adm-1'))).toBe('occupied');
  });

  it('never offers a bed marked occupied with nobody recorded in it (older setup data), so it cannot get a second patient', () => {
    expect(boardState(bed('occupied'))).toBe('occupied');
    expect(canTakePatient(bed('occupied'))).toBe(false);
  });

  it('offers free and reserved beds only, never one being cleaned or out of use', () => {
    expect(canTakePatient(bed('available'))).toBe(true);
    expect(canTakePatient(bed('reserved'))).toBe(true);
    expect(canTakePatient(bed('cleaning'))).toBe(false);
    expect(canTakePatient(bed('maintenance'))).toBe(false);
    expect(canTakePatient(bed('available', null, false))).toBe(false);
  });

  it('counts only beds in use, so a bed taken out of the setup does not look free', () => {
    const counts = boardCounts([bed('available'), bed('available', 'a'), bed('cleaning'), bed('blocked'), bed('maintenance'), bed('available', null, false)]);
    expect(counts).toEqual({ free: 1, occupied: 1, cleaning: 1, outOfUse: 2, reserved: 0, total: 5 });
  });
});

describe('who may do what (the same roles the database checks)', () => {
  it('lets only doctors record rounds and prescribe, and nurses and doctors give doses', () => {
    expect(canDo('doctor', 'round')).toBe(true);
    expect(canDo('nurse', 'round')).toBe(false);
    expect(canDo('nurse', 'prescribe')).toBe(false);
    expect(canDo('nurse', 'giveDose')).toBe(true);
    expect(canDo('receptionist', 'giveDose')).toBe(false);
  });

  it('keeps ward setup with administrators and lets reception admit but not discharge', () => {
    expect(canDo('admin', 'setUpWards')).toBe(true);
    expect(canDo('doctor', 'setUpWards')).toBe(false);
    expect(canDo('receptionist', 'admit')).toBe(true);
    expect(canDo('receptionist', 'discharge')).toBe(false);
    expect(canDo(null, 'admit')).toBe(false);
  });
});

const ward = (id: string) => ({ bedDayCode: 'W100', dailyCodes: ['N200'] as const, id });
const segment = (bedLabel: string, wardId: string, dailyRate: number | null, from: string, to: string | null): StaySegment =>
  ({ bedId: bedLabel, bedLabel, wardId, wardName: `Ward ${wardId}`, dailyRate, from, to });
const TARIFFS: Record<string, TariffForBilling> = {
  W100: { id: '11111111-1111-4111-8111-111111111111', code: 'W100', description: 'Bed day', price: 999, can_be_multiplied: 'NO' },
  N200: { id: '22222222-2222-4222-8222-222222222222', code: 'N200', description: 'Nursing day', price: 150.5, can_be_multiplied: 'YES' }
};

describe('the nights a stay is billed for', () => {
  // Windhoek is UTC+2: 22:00 UTC on 10 Oct is already 11 Oct there
  it('counts Windhoek dates from the admission day to the day before discharge', () => {
    const nights = stayNights([segment('A1', 'w1', 500, '2026-10-10T08:00:00Z', null)], '2026-10-13T09:00:00Z');
    expect(nights.map(night => night.date)).toEqual(['2026-10-10', '2026-10-11', '2026-10-12']);
  });

  it('starts on the Windhoek date, not the UTC date, for an admission late at night', () => {
    const nights = stayNights([segment('A1', 'w1', 500, '2026-10-10T22:30:00Z', null)], '2026-10-12T08:00:00Z');
    expect(nights.map(night => night.date)).toEqual(['2026-10-11']);
  });

  it('bills a same-day stay as one day: the bed was still used', () => {
    expect(stayNights([segment('A1', 'w1', 500, '2026-10-10T06:00:00Z', null)], '2026-10-10T14:00:00Z')).toHaveLength(1);
  });

  it('puts each night in the bed the patient slept in after a move', () => {
    const nights = stayNights([
      segment('A1', 'w1', 500, '2026-10-10T08:00:00Z', '2026-10-11T12:00:00Z'),
      segment('ICU2', 'w2', 2500, '2026-10-11T12:00:00Z', null)
    ], '2026-10-13T08:00:00Z');
    expect(nights.map(night => `${night.date}:${night.segment.bedLabel}`)).toEqual(['2026-10-10:A1', '2026-10-11:ICU2', '2026-10-12:ICU2']);
  });
});

describe('the stay invoice lines', () => {
  const nights = stayNights([
    segment('A1', 'w1', 500, '2026-10-10T08:00:00Z', '2026-10-11T12:00:00Z'),
    segment('ICU2', 'w2', 2500.25, '2026-10-11T12:00:00Z', null)
  ], '2026-10-12T08:00:00Z');
  const wards = new Map([['w1', ward('w1')], ['w2', ward('w2')]]);

  it('bills each night at the daily rate of the bed it was spent in, not the tariff price, dated that night', () => {
    const bill = stayBill({ nights, wards, tariffByCode: code => TARIFFS[code], practitionerId: 'doc-1', icd10Codes: ['J18.9'], authorisationNumber: ' AUTH-9 ' });
    expect(bill.problems).toEqual([]);
    const bedDays = bill.lines.filter(line => line.code === 'W100');
    expect(bedDays.map(line => [line.serviceDate, line.unitPrice, line.quantity])).toEqual([['2026-10-10', 500, 1], ['2026-10-11', 2500.25, 1]]);
    // The fund needs the diagnosis, the authorisation and the practitioner on every line
    expect(bedDays[0]).toMatchObject({ practitionerId: 'doc-1', icd10Codes: ['J18.9'], authorisationNumber: 'AUTH-9', tariffId: TARIFFS.W100.id });
  });

  it("adds the ward's daily codes at their tariff price, once per night", () => {
    const bill = stayBill({ nights, wards, tariffByCode: code => TARIFFS[code] });
    expect(bill.lines.filter(line => line.code === 'N200').map(line => line.totalPrice)).toEqual([150.5, 150.5]);
    expect(bill.totalCents).toBe(50000 + 250025 + 2 * 15050);
  });

  it('bills nothing and says what to set up when a code or the bed-day code is missing (no half invoice)', () => {
    const noRate = stayNights([segment('B3', 'w1', null, '2026-10-10T08:00:00Z', null)], '2026-10-11T08:00:00Z');
    const missing = stayBill({ nights: noRate, wards: new Map([['w1', { bedDayCode: null, dailyCodes: ['X999'] }]]), tariffByCode: code => TARIFFS[code] });
    expect(missing.lines).toEqual([]);
    expect(missing.problems).toEqual([
      'Ward w1 has no bed-day code. An administrator sets it under Wards and beds.',
      'Code X999 (daily, Ward w1) is not on your tariff list.'
    ]);
    expect(missing.totalCents).toBe(0);
  });
});

// Why a bed without a daily rate is not a dead end: a practice that never entered rates still has to bill its ward. The code's
// own amount on the list (NAMAF's ward fee) is the next best price, and when even that is missing the person billing knows the
// amount and types it, instead of the stay being refused or a night going to the fund at N$ 0.
describe('a night in a bed with no daily rate', () => {
  const NAMAF_DAY: TariffForBilling = { id: '33333333-3333-4333-8333-333333333333', code: '007', description: 'Day admission', price: 2914.1, priceSource: 'NAMAF 2026' };
  const NO_AMOUNT: TariffForBilling = { id: '44444444-4444-4444-8444-444444444444', code: '001', description: 'Surgical cases: per day', price: 0, priceSource: 'NAMAF 2026' };
  const nightsIn = (bedLabel: string, dailyRate: number | null, from = '2026-10-10T08:00:00Z', to: string | null = null, wardId = 'w1') =>
    stayNights([segment(bedLabel, wardId, dailyRate, from, to)], '2026-10-12T08:00:00Z');
  const billWith = (tariff: TariffForBilling, nights: ReturnType<typeof stayNights>, typedAmounts?: Record<string, number>, dailyCodes: string[] = []) =>
    stayBill({ nights, wards: new Map([['w1', { bedDayCode: tariff.code, dailyCodes }]]), tariffByCode: code => (code === tariff.code ? tariff : TARIFFS[code]), typedAmounts });

  it("bills the code's amount on the list for each night, and says it came from NAMAF", () => {
    const bill = billWith(NAMAF_DAY, nightsIn('B3', null));
    expect(bill.problems).toEqual([]);
    expect(bill.asks).toEqual([]);
    expect(bill.lines.map(line => [line.code, line.unitPrice, line.serviceDate])).toEqual([['007', 2914.1, '2026-10-10'], ['007', 2914.1, '2026-10-11']]);
    expect(bill.lines.map(line => bill.sources[line.id])).toEqual(['NAMAF 2026', 'NAMAF 2026']);
    expect(bill.totalCents).toBe(2 * 291410);
  });

  it("says 'price list' when the amount is the practice's own, and 'bed rate' when the bed has one, which wins over the list", () => {
    const own = billWith({ ...NAMAF_DAY, priceSource: null, price: 1200 }, nightsIn('B3', null));
    expect(own.lines.map(line => [line.unitPrice, own.sources[line.id]])).toEqual([[1200, 'price list'], [1200, 'price list']]);
    const withRate = billWith(NAMAF_DAY, nightsIn('B3', 1850));
    expect(withRate.lines.map(line => [line.unitPrice, withRate.sources[line.id]])).toEqual([[1850, 'bed rate'], [1850, 'bed rate']]);
  });

  it('asks for the amount when neither the bed nor the list has one, bills nothing yet, and does not block with a problem', () => {
    const bill = billWith(NO_AMOUNT, nightsIn('B3', null));
    expect(bill.problems).toEqual([]);
    expect(bill.lines).toEqual([]);
    expect(bill.asks).toEqual([{
      key: 'bed:B3', what: 'Bed B3, Ward w1', nights: 2,
      why: "Bed B3 has no daily rate and code 001 has no amount on the price list. An administrator can set the bed's daily rate under Wards and beds."
    }]);
  });

  it('bills every night at the amount typed, and says it was typed in', () => {
    const bill = billWith(NO_AMOUNT, nightsIn('B3', null), { 'bed:B3': 1500.5 });
    expect(bill.asks).toEqual([]);
    expect(bill.lines.map(line => [line.unitPrice, bill.sources[line.id]])).toEqual([[1500.5, 'typed in'], [1500.5, 'typed in']]);
    expect(bill.totalCents).toBe(300100);
  });

  it.each([[0], [-20], [Number.NaN], [10.005]])('does not take %s as the amount: a night is never billed for nothing or for a mistyped figure', amount => {
    const bill = billWith(NO_AMOUNT, nightsIn('B3', null), { 'bed:B3': amount });
    expect(bill.lines).toEqual([]);
    expect(bill.asks.map(ask => ask.key)).toEqual(['bed:B3']);
  });

  it('asks once per bed, not once per night, so a patient moved between two such beds is asked twice and no more', () => {
    const nights = stayNights([
      segment('B3', 'w1', null, '2026-10-10T08:00:00Z', '2026-10-11T12:00:00Z'),
      segment('B4', 'w1', null, '2026-10-11T12:00:00Z', null)
    ], '2026-10-13T08:00:00Z');
    const bill = billWith(NO_AMOUNT, nights);
    expect(bill.asks.map(ask => [ask.key, ask.nights])).toEqual([['bed:B3', 1], ['bed:B4', 2]]);
    // Answering one still leaves the other open: still no half invoice
    expect(billWith(NO_AMOUNT, nights, { 'bed:B3': 900 }).lines).toEqual([]);
  });

  it('asks for a daily code that has no fixed amount too, instead of billing it at N$ 0', () => {
    const noAmountDaily: TariffForBilling = { ...TARIFFS.N200, price: 0 };
    const nights = nightsIn('B3', 500);
    const asked = stayBill({ nights, wards: new Map([['w1', ward('w1')]]), tariffByCode: code => (code === 'N200' ? noAmountDaily : TARIFFS[code]) });
    expect(asked.lines).toEqual([]);
    expect(asked.asks).toEqual([{ key: 'code:N200', what: 'Code N200, Nursing day', why: 'Code N200 has no amount on the price list.', nights: 2 }]);
    const typed = stayBill({ nights, wards: new Map([['w1', ward('w1')]]), tariffByCode: code => (code === 'N200' ? noAmountDaily : TARIFFS[code]), typedAmounts: { 'code:N200': 175 } });
    expect(typed.lines.filter(line => line.code === 'N200').map(line => [line.unitPrice, typed.sources[line.id]])).toEqual([[175, 'typed in'], [175, 'typed in']]);
  });

  // A practice may price a bed at N$ 0 on purpose (a mother's cot); only a bed with no rate at all falls back to the list
  it('still bills a bed whose rate is N$ 0 at that rate: the fallback is for a rate that was never set', () => {
    const bill = billWith(NAMAF_DAY, nightsIn('COT', 0));
    expect(bill.lines.map(line => [line.unitPrice, bill.sources[line.id]])).toEqual([[0, 'bed rate'], [0, 'bed rate']]);
  });

  it('passes the date of each night to the lookup, so a list that changes during a stay prices each night with its own version', () => {
    const asked: string[] = [];
    stayBill({ nights: nightsIn('B3', null), wards: new Map([['w1', { bedDayCode: '007', dailyCodes: [] }]]), tariffByCode: (code, date) => { asked.push(`${code}@${date}`); return NAMAF_DAY; } });
    expect(asked).toEqual(['007@2026-10-10', '007@2026-10-11']);
  });
});

describe('the medication chart', () => {
  const now = new Date('2026-10-13T10:30:00Z'); // 12:30 in Windhoek
  const med = (records: { due_at: string; outcome: 'given' | 'refused' }[] = []) => ({
    startDatetime: '2026-10-12T05:00:00Z',
    endDatetime: null,
    scheduledTimes: ['08:00:00', '14:00:00', '20:00:00'],
    records: records.map(record => ({ ...record, recorded_at: record.due_at, recorded_by: null, note: null }))
  });

  it('stores a dose under the minute in UTC, the key the database checks for doubles', () => {
    expect(doseKey(windhoekMoment('2026-10-13', '08:00'))).toBe('2026-10-13T06:00:00Z');
  });

  it("shows today's doses up to two hours ahead, and a dose more than an hour past its time as late", () => {
    const doses = dueDoses(med([{ due_at: '2026-10-12T06:00:00Z', outcome: 'given' }]), now);
    const today = doses.filter(dose => dose.date === '2026-10-13');
    expect(today.map(dose => [dose.time, dose.late])).toEqual([['08:00', true], ['14:00', false]]);
  });

  it("keeps yesterday's unrecorded doses on the chart until someone records them, and drops recorded ones", () => {
    const doses = dueDoses(med([{ due_at: '2026-10-12T06:00:00Z', outcome: 'given' }]), now);
    expect(doses.filter(dose => dose.date === '2026-10-12').map(dose => dose.time)).toEqual(['14:00', '20:00']);
  });

  it('shows what was recorded for a dose today, so it is not given twice', () => {
    const doses = dueDoses(med([{ due_at: '2026-10-13T06:00:00Z', outcome: 'refused' }]), now);
    expect(doses.find(dose => dose.dueAt === '2026-10-13T06:00:00Z')?.record?.outcome).toBe('refused');
  });

  it('never lists doses after the medicine was stopped', () => {
    const stopped = { ...med(), endDatetime: '2026-10-12T13:00:00Z' };
    expect(dueDoses(stopped, now).map(dose => dose.dueAt)).toEqual(['2026-10-12T06:00:00Z', '2026-10-12T12:00:00Z']);
  });
});

describe('visitors', () => {
  const rules = { visitingStart: '14:00:00', visitingEnd: '16:00:00', maxVisitors: 2 };

  it('warns outside visiting hours, by the Windhoek clock', () => {
    expect(visitorWarnings(rules, 0, new Date('2026-10-13T10:30:00Z'))).toEqual(['It is outside visiting hours (14:00 to 16:00).']);
    expect(visitorWarnings(rules, 0, new Date('2026-10-13T12:30:00Z'))).toEqual([]);
  });

  it('warns when the patient already has the most visitors allowed at a time', () => {
    expect(visitorWarnings(rules, 2, new Date('2026-10-13T12:30:00Z'))).toEqual(['The patient already has 2 visitors (at most 2 at a time).']);
  });

  it('says nothing when the ward has no visiting hours set', () => {
    expect(visitorWarnings({ visitingStart: null, visitingEnd: null, maxVisitors: null }, 5)).toEqual([]);
  });
});

describe('plain words', () => {
  it('shows a code the list does not know as it is, never a blank', () => {
    expect(labelOf(ROUTES, 'iv')).toBe('Into a vein (IV)');
    expect(labelOf(ROUTES, 'nasal')).toBe('nasal');
  });

  it('counts the day of stay by Windhoek dates (admitted today is day 1)', () => {
    expect(dayOfStay('2026-10-10T23:00:00Z', new Date('2026-10-13T10:00:00Z'))).toBe(3);
  });
});
