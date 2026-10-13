import { describe, expect, it } from 'vitest';
import type { ServiceSelection } from '../../../types/billing';
import {
  billNormally,
  describePackageBalance,
  describePackageType,
  draftFromPackageType,
  normalizePackageType,
  normalizePatientPackage,
  packageFor,
  packageState,
  packageTypePayload,
  payFromPackages,
  sessionsLeft,
  usesOnLines,
  validUntil,
  type PatientPackage
} from '../packages';

const pack = (overrides: Partial<PatientPackage> = {}): PatientPackage => ({
  ...normalizePatientPackage({
    id: 'pack-1',
    name: 'Ten physio sessions',
    codes: ['0190'],
    sessions: 10,
    price: '4500.00',
    sold_on: '2026-10-13',
    expires_on: '2027-04-13',
    sale_invoice_id: 'inv-1',
    sale_invoice_number: 'INV-000101',
    sale_cancelled: false,
    cancelled_at: null,
    cancel_reason: null,
    used: 3
  }),
  ...overrides
});

const line = (overrides: Partial<ServiceSelection> = {}): ServiceSelection => ({
  id: 'line-1',
  tariffId: 'tariff-0190',
  code: '0190',
  description: 'Invented session',
  category: 'Service',
  unitPrice: 520,
  quantity: 1,
  totalPrice: 520,
  ...overrides
});

describe('what is left on a package', () => {
  it('counts the sessions used on saved invoices and those on the bill now', () => {
    expect(sessionsLeft(pack())).toBe(7);
    expect(sessionsLeft(pack(), 2)).toBe(5);
    expect(describePackageBalance(pack(), '2026-11-01', 1)).toBe('6 of 10 left, until 13 Apr 2027');
  });

  it('cannot be used once it expired, was used up, cancelled, or its invoice was cancelled', () => {
    expect(packageState(pack(), '2027-04-14')).toBe('expired');
    expect(packageState(pack({ used: 10 }), '2026-11-01')).toBe('used_up');
    expect(packageState(pack({ cancelledAt: '2026-11-01T08:00:00Z', cancelReason: 'Moved away' }), '2026-11-01')).toBe('cancelled');
    expect(packageState(pack({ saleCancelled: true }), '2026-11-01')).toBe('cancelled');
    expect(describePackageBalance(pack({ saleCancelled: true }), '2026-11-01')).toBe('Its invoice was cancelled');
  });

  it('is valid until the same day months later, as the database dates it (end of a shorter month)', () => {
    expect(validUntil('2026-10-13', 6)).toBe('2027-04-13');
    expect(validUntil('2026-08-31', 6)).toBe('2027-02-28');
  });
});

describe('payFromPackages on the visit\'s bill', () => {
  const options = { lineIds: new Set(['line-1']), visitDateKey: '2026-11-01', hasMedicalAid: false };

  it('bills a covered code at N$ 0.00 and names the package, so the session comes off it', () => {
    const { lines, used } = payFromPackages([line({ discountAmount: 50, promotionId: 'promo-1' })], [pack()], options);
    expect(lines[0]).toMatchObject({ unitPrice: 0, totalPrice: 0, packageId: 'pack-1' });
    expect(lines[0].discountAmount).toBeUndefined();
    expect(lines[0].promotionId).toBeUndefined();
    expect(used.map(item => item.pack.id)).toEqual(['pack-1']);
  });

  it('makes a medical aid patient\'s package line the patient\'s, so the fund is never sent a N$ 0.00 claim line', () => {
    const { lines } = payFromPackages([line()], [pack()], { ...options, hasMedicalAid: true });
    expect(lines[0].paidBy).toBe('patient');
  });

  it('never uses more sessions than are left, counting the other lines on the bill', () => {
    const nearlyUsed = pack({ used: 9 });
    const { lines } = payFromPackages(
      [line({ id: 'line-1' }), line({ id: 'line-2' })],
      [nearlyUsed],
      { ...options, lineIds: new Set(['line-1', 'line-2']) }
    );
    expect(lines.map(item => item.packageId ?? null)).toEqual(['pack-1', null]);
    expect(lines[1].unitPrice).toBe(520);
  });

  it('leaves codes the package does not cover, lines added before, and expired packages alone', () => {
    expect(payFromPackages([line({ code: '0191' })], [pack()], options).used).toEqual([]);
    expect(payFromPackages([line({ id: 'line-0' })], [pack()], options).used).toEqual([]);
    expect(payFromPackages([line()], [pack()], { ...options, visitDateKey: '2027-05-01' }).used).toEqual([]);
  });

  it('uses the package that runs out first when two cover the code', () => {
    const later = pack({ id: 'pack-2', expiresOn: '2027-09-01' });
    expect(packageFor([later, pack()], '0190', '2026-11-01', 1, new Map())?.id).toBe('pack-1');
  });

  it('counts each package\'s sessions on the bill by quantity', () => {
    expect(usesOnLines([{ packageId: 'pack-1', quantity: 2 }, { packageId: 'pack-1', quantity: 1 }, { quantity: 4 }])).toEqual(new Map([['pack-1', 3]]));
  });
});

describe('billNormally', () => {
  it('puts the visit\'s tariff price back when staff do not want to use the package', () => {
    const paid = payFromPackages([line({ quantity: 2, totalPrice: 1040 })], [pack()], { lineIds: new Set(['line-1']), visitDateKey: '2026-11-01', hasMedicalAid: true }).lines[0];
    const back = billNormally(paid, [{ id: 'tariff-0190', price: '520.00', default_paid_by: null }]);
    expect(back).toMatchObject({ unitPrice: 520, totalPrice: 1040 });
    expect(back?.packageId).toBeUndefined();
    expect(back?.paidBy).toBeUndefined();
    expect(billNormally(paid, [])).toBeNull();
  });
});

describe('the administrator\'s package form', () => {
  it('reads the form into what the database checks', () => {
    const result = packageTypePayload({ name: ' Ten physio sessions ', codes: '0190 0191', sessions: '10', price: 'N$ 4,500.00', validMonths: '6', isActive: true }, 'practice-1');
    expect(result.payload).toEqual({ id: null, practice_id: 'practice-1', name: 'Ten physio sessions', codes: ['0190', '0191'], sessions: 10, price: 4500, valid_months: 6, is_active: true });
  });

  it('refuses 0 sessions, no price and more than 60 months', () => {
    const base = { name: 'Pack', codes: '0190', sessions: '10', price: '100', validMonths: '6', isActive: true };
    expect(packageTypePayload({ ...base, sessions: '0' }, 'p').error).toMatch(/number of sessions/);
    expect(packageTypePayload({ ...base, price: '' }, 'p').error).toMatch(/price/);
    expect(packageTypePayload({ ...base, validMonths: '61' }, 'p').error).toMatch(/months/);
  });

  it('describes a package and shows it in the form unchanged', () => {
    const type = normalizePackageType({ id: 't1', name: 'Five consults', codes: ['0190'], sessions: 5, price: 1500, valid_months: 1, is_active: true });
    expect(describePackageType(type)).toBe('5 sessions of 0190 for N$ 1,500.00, valid 1 month');
    expect(packageTypePayload(draftFromPackageType(type), 'p').payload).toMatchObject({ name: 'Five consults', price: 1500, valid_months: 1 });
  });
});
