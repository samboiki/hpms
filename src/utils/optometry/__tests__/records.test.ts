import { describe, expect, it } from 'vitest';
import { currentPrescriptions, previousPrescription, rxJson, toFundNote, toLabOrder, toPrescription } from '../records';

const row = (values: Record<string, unknown>) => ({
  id: 'rx', patient_id: 'p1', kind: 'spectacles', prescribed_on: '2026-10-08', recorded_at: '2026-10-08T08:00:00Z',
  r_sphere: '-1.25', r_cylinder: '-0.50', r_axis: 90, r_add: '2.00', r_va: '6/6', l_sphere: '-1.00', l_cylinder: null, l_axis: null,
  recorder: { full_name: 'Optometrist A', hpcsa_number: 'OPT00001' },
  ...values
});

// Business rule: the numbers on the screen and the printed prescription are the ones the database holds; numeric
// columns come back as text and must not turn into wrong numbers or lose the practitioner's registration number
describe('reading prescriptions', () => {
  it('reads both eyes, the recorder and the registration number printed on the slip', () => {
    const record = toPrescription(row({}));
    expect(record.right).toMatchObject({ sphere: -1.25, cylinder: -0.5, axis: 90, add: 2, va: '6/6' });
    expect(record.left).toMatchObject({ sphere: -1, cylinder: null, axis: null, add: null });
    expect(record).toMatchObject({ recordedBy: 'Optometrist A', recordedByNumber: 'OPT00001', kind: 'spectacles', voidedAt: null });
  });

  it('lists the current ones newest first, leaves out mistakes and compares each with the one before', () => {
    const records = [
      toPrescription(row({ id: 'old', prescribed_on: '2024-03-01' })),
      toPrescription(row({ id: 'new', prescribed_on: '2026-10-08' })),
      toPrescription(row({ id: 'mistake', prescribed_on: '2026-10-09', voided_at: '2026-10-09T09:00:00Z', void_reason: 'Wrong patient' })),
      toPrescription(row({ id: 'contact', kind: 'contact_lenses' }))
    ];
    expect(currentPrescriptions(records, 'spectacles').map(record => record.id)).toEqual(['new', 'old']);
    expect(previousPrescription(records, records[1])?.id).toBe('old');
    expect(previousPrescription(records, records[0])).toBeNull();
  });
});

describe('sending a prescription to the database', () => {
  it('sends no axis without a cylinder and no base without a prism, whatever the form held', () => {
    const json = rxJson({
      right: { sphere: -1, cylinder: null, axis: 90, prism: null, base: 'in', add: null, va: null, baseCurve: null, diameter: null },
      left: { sphere: 0, cylinder: -0.5, axis: 180, prism: 1, base: 'out', add: 1.5, va: '6/9', baseCurve: null, diameter: null }
    }, { validUntil: '2028-10-08', notes: '  ' });
    expect(json.right).toMatchObject({ axis: null, base: null });
    expect(json.left).toMatchObject({ cylinder: -0.5, axis: 180, prism: 1, base: 'out', add: 1.5 });
    expect(json).toMatchObject({ valid_until: '2028-10-08', notes: null, lens_name: null });
  });
});

describe('reading orders and notes', () => {
  it('keeps the steps in the order they happened and only known coatings', () => {
    const order = toLabOrder({ id: 'o1', order_no: 12, status: 'remake', coatings: ['tint', 'gold plating'], supplier: [{ name: 'Lab One' }] }, [
      { status: 'received', fromStatus: 'ordered', reason: null, on: '2026-10-05', changedAt: '2026-10-05T10:00:00Z', changedBy: null },
      { status: 'ordered', fromStatus: null, reason: null, on: '2026-10-01', changedAt: '2026-10-01T10:00:00Z', changedBy: null }
    ]);
    expect(order.events.map(event => event.status)).toEqual(['ordered', 'received']);
    expect(order).toMatchObject({ orderNo: 12, status: 'remake', coatings: ['tint'], supplierName: 'Lab One' });
  });

  it('reads a benefit limit in cents without rounding errors', () => {
    expect(toFundNote({ id: 'n', fund_reference: 'nmc1', note: 'Every 24 months', limit_amount: '1499.99', cycle_months: 24 })).toEqual({
      id: 'n', fundReference: 'NMC1', planOption: null, note: 'Every 24 months', limitCents: 149999, cycleMonths: 24
    });
  });
});
