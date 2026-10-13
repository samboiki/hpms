import { describe, expect, it } from 'vitest';
import {
  NEXT_DENTAL_LAB_STATUSES,
  canMoveDentalLabOrder,
  daysInStep,
  daysLate,
  dentalLabStatusNeedsReason,
  describeLabWork,
  dueState,
  emptyDentalLabOrderDraft,
  groupByLab,
  isAtLab,
  isOpenDentalLabOrder,
  sortedTeeth,
  trackingCounts,
  validateDentalLabOrderDraft,
  type DentalLabOrderDraft,
  type TrackableOrder
} from '../labOrders';

const TODAY = '2026-10-13';
const form = (values: Partial<DentalLabOrderDraft>): DentalLabOrderDraft => ({ ...emptyDentalLabOrderDraft(TODAY), workType: 'crown', teeth: ['11'], ...values });
const errorsOf = (values: Partial<DentalLabOrderDraft>) => {
  const result = validateDentalLabOrderDraft(form(values), { today: TODAY });
  return result.ok ? {} : result.errors;
};

// Business rule: the lab makes exactly what the order names; an order without its teeth, a bridge on one tooth or a
// date that cannot be comes back wrong or not at all, and the patient waits for a second appointment
describe('what the lab needs on an order', () => {
  it('accepts a crown on one tooth and sends the teeth once each, in FDI order', () => {
    const result = validateDentalLabOrderDraft(form({ teeth: ['21', '11', '21'], shade: ' A2 ', supplierId: 'lab-1', dueOn: '2026-10-20' }), { today: TODAY });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toMatchObject({ work_type: 'crown', teeth: ['11', '21'], jaw: null, shade: 'A2', supplier_id: 'lab-1', sent_on: TODAY, due_on: '2026-10-20' });
    }
  });

  it('needs the work, and the teeth or the jaw it is for', () => {
    expect(errorsOf({ workType: '' }).workType).toBeDefined();
    expect(errorsOf({ workType: 'full_denture', teeth: [] }).teeth).toMatch(/teeth or the jaw/);
    expect(errorsOf({ workType: 'full_denture', teeth: [], jaw: 'upper' }).teeth).toBeUndefined();
  });

  it('needs the tooth for work made for teeth, and at least two teeth for a bridge', () => {
    expect(errorsOf({ workType: 'crown', teeth: [], jaw: 'upper' }).teeth).toMatch(/tooth/);
    expect(errorsOf({ workType: 'bridge', teeth: ['14'] }).teeth).toMatch(/two teeth/);
    expect(errorsOf({ workType: 'bridge', teeth: ['14', '15', '16'] }).teeth).toBeUndefined();
  });

  it('refuses numbers that are not teeth (the database checks the same FDI rule)', () => {
    expect(errorsOf({ teeth: ['19'] }).teeth).toMatch(/19 is not a tooth/);
    expect(errorsOf({ teeth: ['55'] }).teeth).toBeUndefined();
  });

  it('keeps the dates possible: sent today or before, back not before it went', () => {
    expect(errorsOf({ sentOn: '2026-10-14' }).sentOn).toMatch(/future/);
    expect(errorsOf({ sentOn: '2026-10-10', dueOn: '2026-10-09' }).dueOn).toMatch(/before it went/);
    expect(errorsOf({ sentOn: '2026-10-10', dueOn: '2026-10-10' }).dueOn).toBeUndefined();
  });

  it('keeps the shade and the notes to what the slip and the database hold', () => {
    expect(errorsOf({ shade: 'A'.repeat(21) }).shade).toBeDefined();
    expect(errorsOf({ notes: 'x'.repeat(501) }).notes).toBeDefined();
  });
});

// Business rule: the steps match the work's real path (and the database's dental_lab_order_set_status): what is still
// at the lab cannot be fitted, what came back was made and charged so it cannot be cancelled, and a remake says why
describe('the steps of an order', () => {
  it('moves from the lab to fitted only through "back from the lab"', () => {
    expect(canMoveDentalLabOrder('sent', 'fitted')).toBe(false);
    expect(canMoveDentalLabOrder('sent', 'received')).toBe(true);
    expect(canMoveDentalLabOrder('received', 'fitted')).toBe(true);
  });

  it('sends work back to be remade from back or fitted, and a remake comes back like the first work', () => {
    expect(canMoveDentalLabOrder('received', 'remake')).toBe(true);
    expect(canMoveDentalLabOrder('fitted', 'remake')).toBe(true);
    expect(NEXT_DENTAL_LAB_STATUSES.remake).toEqual(['received', 'cancelled']);
  });

  it('cancels only what is still at the lab, and a cancelled order goes nowhere', () => {
    expect(canMoveDentalLabOrder('received', 'cancelled')).toBe(false);
    expect(canMoveDentalLabOrder('sent', 'cancelled')).toBe(true);
    expect(NEXT_DENTAL_LAB_STATUSES.cancelled).toEqual([]);
  });

  it('asks why for a remake and a cancellation only', () => {
    expect(dentalLabStatusNeedsReason('remake')).toBe(true);
    expect(dentalLabStatusNeedsReason('cancelled')).toBe(true);
    expect(dentalLabStatusNeedsReason('received')).toBe(false);
  });

  it('counts work being remade as at the lab, and fitted or cancelled work as closed', () => {
    expect(isAtLab('remake')).toBe(true);
    expect(isAtLab('received')).toBe(false);
    expect(isOpenDentalLabOrder('received')).toBe(true);
    expect(isOpenDentalLabOrder('fitted')).toBe(false);
    expect(isOpenDentalLabOrder('cancelled')).toBe(false);
  });
});

describe('the order in words', () => {
  it('names the work with its teeth or jaw, as the slip and the lists say it', () => {
    expect(describeLabWork({ workType: 'crown', teeth: ['11'], jaw: null })).toBe('Crown on 11');
    expect(describeLabWork({ workType: 'bridge', teeth: ['16', '14', '15'], jaw: null })).toBe('Bridge on 14, 15, 16');
    expect(describeLabWork({ workType: 'full_denture', teeth: [], jaw: 'upper' })).toBe('Full denture, upper jaw');
    expect(describeLabWork({ workType: 'other', teeth: [], jaw: 'both' })).toBe('Lab work, both jaws');
  });

  it('orders teeth by FDI number', () => {
    expect(sortedTeeth(['21', ' 11', '48', '11', ''])).toEqual(['11', '21', '48']);
  });
});

// Business rule: the front desk phones the lab about work that is late before the patient arrives for the fitting
describe('when work is due back', () => {
  const order = (dueOn: string | null, status: TrackableOrder['status'] = 'sent') => ({ status, dueOn });

  it('says overdue, due today, due soon or later for work at the lab', () => {
    expect(dueState(order('2026-10-12'), TODAY)).toBe('overdue');
    expect(dueState(order(TODAY), TODAY)).toBe('due_today');
    expect(dueState(order('2026-10-15'), TODAY)).toBe('due_soon');
    expect(dueState(order('2026-10-20'), TODAY)).toBe('later');
    expect(dueState(order(null), TODAY)).toBe('no_date');
  });

  it('says nothing about due dates once the work is back', () => {
    expect(dueState(order('2026-10-01', 'received'), TODAY)).toBeNull();
  });

  it('counts the days late and the days in a step', () => {
    expect(daysLate('2026-10-10', TODAY)).toBe(3);
    expect(daysLate('2026-10-20', TODAY)).toBe(0);
    expect(daysInStep('received', '2026-10-11', TODAY)).toBe(2);
    expect(daysInStep('fitted', '2026-10-11', TODAY)).toBeNull();
  });
});

describe('the practice view by lab', () => {
  const tracked = (values: Partial<TrackableOrder>): TrackableOrder => ({
    id: `o${values.orderNo}`,
    orderNo: 1,
    status: 'sent',
    sentOn: '2026-10-01',
    dueOn: null,
    supplierId: 'lab-a',
    labName: 'Alpha Dental Lab',
    ...values
  });

  it('counts what is at the lab, overdue, due today and back to be fitted', () => {
    const counts = trackingCounts(
      [tracked({ orderNo: 1, dueOn: '2026-10-12' }), tracked({ orderNo: 2, dueOn: TODAY }), tracked({ orderNo: 3, status: 'received' }), tracked({ orderNo: 4, status: 'remake' })],
      TODAY
    );
    expect(counts).toEqual({ atLab: 3, overdue: 1, dueToday: 1, back: 1 });
  });

  it('groups the open orders by lab, labs with overdue work first and orders without a lab last, most urgent first', () => {
    const groups = groupByLab(
      [
        tracked({ orderNo: 1, supplierId: 'lab-a', labName: 'Alpha Dental Lab', dueOn: '2026-10-20' }),
        tracked({ orderNo: 2, supplierId: 'lab-b', labName: 'Beta Lab', dueOn: '2026-10-11' }),
        tracked({ orderNo: 3, supplierId: null, labName: null }),
        tracked({ orderNo: 4, supplierId: 'lab-a', labName: 'Alpha Dental Lab', dueOn: TODAY }),
        tracked({ orderNo: 5, supplierId: 'lab-a', labName: 'Alpha Dental Lab', status: 'fitted' })
      ],
      TODAY
    );
    expect(groups.map(group => group.labName)).toEqual(['Beta Lab', 'Alpha Dental Lab', 'Lab not named']);
    expect(groups[1].orders.map(order => order.orderNo)).toEqual([4, 1]);
    expect(groups.flatMap(group => group.orders).some(order => order.orderNo === 5)).toBe(false);
  });
});
