import { describe, expect, it } from 'vitest';
import {
  canMoveLabOrder,
  daysWaiting,
  emptyLabOrderDraft,
  isOpenLabOrder,
  labStatusNeedsReason,
  orderTurnaround,
  validateLabOrderDraft,
  type LabOrderDraft,
  type LabOrderEvent
} from '../labOrders';
import type { EyeRx, Rx } from '../prescription';

const TODAY = '2026-10-08';
const eye = (values: Partial<EyeRx> = {}): EyeRx => ({
  sphere: -1, cylinder: null, axis: null, prism: null, base: null, add: null, va: null, baseCurve: null, diameter: null, ...values
});
const distanceRx: Rx = { right: eye(), left: eye() };
const readingRx: Rx = { right: eye({ add: 2 }), left: eye({ add: 2 }) };
const form = (values: Partial<LabOrderDraft>): LabOrderDraft => ({
  ...emptyLabOrderDraft('rx-1'),
  lensType: 'single_vision',
  material: 'cr39',
  pdRight: '31.5',
  pdLeft: '32',
  frameNote: 'Patient\'s own frame',
  ...values
});
const errorsOf = (values: Partial<LabOrderDraft>, prescription: Rx | null = distanceRx) => {
  const result = validateLabOrderDraft(form(values), { rx: prescription, today: TODAY });
  return result.ok ? {} : result.errors;
};

// Business rule: an order that reaches the lab without what the lab needs comes back wrong, and a remake costs the
// practice the lenses and the patient another wait
describe('what the lab needs on an order', () => {
  it('accepts a complete single-vision order and sends the measurements', () => {
    const result = validateLabOrderDraft(form({ coatings: ['anti_reflective', 'anti_reflective'] }), { rx: distanceRx, today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toMatchObject({ prescription_id: 'rx-1', eyes: 'both', pd_right: 31.5, pd_left: 32, coatings: ['anti_reflective'], tint_percent: null });
    }
  });

  it('needs the prescription the lenses are made to', () => {
    expect(errorsOf({ prescriptionId: '' }).prescriptionId).toBeDefined();
    expect(errorsOf({}, null).prescriptionId).toBeDefined();
  });

  it('needs a pupil distance for every eye ordered, in half millimetres from 20 to 40', () => {
    expect(errorsOf({ pdLeft: '' }).pdLeft).toMatch(/needed/);
    expect(errorsOf({ pdRight: '31.3' }).pdRight).toBeDefined();
    expect(errorsOf({ pdRight: '45' }).pdRight).toBeDefined();
    // Only the right eye ordered: the left measurement is not asked for
    expect(errorsOf({ eyes: 'right', pdLeft: '' }).pdLeft).toBeUndefined();
  });

  it('needs fitting heights and a reading addition for multifocals, bifocals and office lenses', () => {
    expect(errorsOf({ lensType: 'multifocal' }, readingRx).heightRight).toMatch(/needed/);
    expect(errorsOf({ lensType: 'multifocal', heightRight: '18', heightLeft: '18' }, distanceRx).lensType).toMatch(/reading addition/);
    expect(errorsOf({ lensType: 'bifocal', heightRight: '18', heightLeft: '18.5' }, readingRx)).toEqual({});
  });

  it('needs the tint density when a tint is ticked (it goes in claim field 47) and drops it otherwise', () => {
    expect(errorsOf({ coatings: ['tint'] }).tintPercent).toBeDefined();
    expect(errorsOf({ coatings: ['tint'], tintPercent: '100' }).tintPercent).toBeDefined();
    const untinted = validateLabOrderDraft(form({ tintPercent: '35' }), { rx: distanceRx, today: TODAY });
    expect(untinted.ok && untinted.payload.tint_percent).toBe(null);
  });

  it('needs a frame: one from stock, or the patient\'s own described', () => {
    expect(errorsOf({ frameNote: '' }).frameNote).toBeDefined();
    expect(errorsOf({ frameNote: '', frameItemId: 'frame-1' })).toEqual({});
  });

  it('refuses a "needed by" day in the past', () => {
    expect(errorsOf({ requiredBy: '2026-10-07' }).requiredBy).toBeDefined();
    expect(errorsOf({ requiredBy: TODAY }).requiredBy).toBeUndefined();
  });
});

describe('the steps of an order', () => {
  it('goes to the lab, comes back, is fitted and collected, and can be sent back for a remake', () => {
    expect(canMoveLabOrder('ordered', 'received')).toBe(true);
    expect(canMoveLabOrder('received', 'collected')).toBe(true);
    expect(canMoveLabOrder('collected', 'remake')).toBe(true);
    expect(canMoveLabOrder('remake', 'received')).toBe(true);
  });

  it('never skips the lab or reopens a cancelled order', () => {
    expect(canMoveLabOrder('ordered', 'collected')).toBe(false);
    expect(canMoveLabOrder('cancelled', 'ordered')).toBe(false);
    expect(canMoveLabOrder('collected', 'cancelled')).toBe(false);
  });

  it('asks why for a remake or a cancellation', () => {
    expect(labStatusNeedsReason('remake')).toBe(true);
    expect(labStatusNeedsReason('cancelled')).toBe(true);
    expect(labStatusNeedsReason('received')).toBe(false);
  });

  it('counts an order as open until it is collected or cancelled', () => {
    expect(isOpenLabOrder('remake')).toBe(true);
    expect(isOpenLabOrder('collected')).toBe(false);
    expect(daysWaiting('ordered', '2026-10-01', TODAY)).toBe(7);
    expect(daysWaiting('collected', '2026-10-01', TODAY)).toBeNull();
  });
});

describe('how long the lab took', () => {
  const event = (status: LabOrderEvent['status'], on: string): LabOrderEvent => ({
    status, fromStatus: null, reason: null, on, changedAt: `${on}T10:00:00Z`, changedBy: null
  });

  it('measures to the first time the lenses came back, and to the last collection after a remake', () => {
    const turnaround = orderTurnaround('2026-09-01', [
      event('received', '2026-09-08'),
      event('remake', '2026-09-09'),
      event('received', '2026-09-15'),
      event('collected', '2026-09-16')
    ]);
    expect(turnaround).toEqual({ daysAtLab: 7, daysToCollect: 15, remakes: 1 });
  });

  it('has no figures for an order still at the lab', () => {
    expect(orderTurnaround('2026-09-01', [])).toEqual({ daysAtLab: null, daysToCollect: null, remakes: 0 });
  });
});
