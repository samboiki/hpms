import { describe, expect, it } from 'vitest';
import { toDentalLabEvent, toDentalLabOrder, toSlipLine } from '../labOrderRecords';

// Business rule: the screens, the slip and the claim read an order exactly as stored; money stays in whole cents so
// the lab's lines add up to the 8099 line to the cent
describe('a lab order as the screens use it', () => {
  const row = {
    id: 'o-1',
    order_no: 7,
    patient_id: 'p-1',
    visit_id: 'v-1',
    billed_visit_id: 'v-2',
    status: 'received',
    status_on: '2026-10-12',
    sent_on: '2026-10-05',
    due_on: '2026-10-12',
    supplier_id: 's-1',
    work_type: 'bridge',
    teeth: ['16', '14', '15'],
    jaw: null,
    shade: 'A3',
    notes: null,
    slip_number: 'LS-12',
    creator: { full_name: 'Dr Test Practitioner' },
    supplier: { name: 'Alpha Dental Lab' },
    started: { visit_date: '2026-10-05T09:00:00+02:00', scheduled_date: null },
    billed: [{ visit_date: null, scheduled_date: '2026-10-19' }]
  };

  it('reads the order, its lab, its visits and its teeth in FDI order', () => {
    const order = toDentalLabOrder(row);
    expect(order).toMatchObject({
      id: 'o-1',
      orderNo: 7,
      status: 'received',
      workType: 'bridge',
      teeth: ['14', '15', '16'],
      jaw: null,
      labName: 'Alpha Dental Lab',
      createdBy: 'Dr Test Practitioner',
      visitDate: '2026-10-05',
      billedVisitDate: '2026-10-19',
      slipNumber: 'LS-12'
    });
  });

  it('keeps the lab\'s lines in their order, in cents, and the steps in the order they happened', () => {
    const lines = [toSlipLine({ line_no: 2, lab_code: null, description: 'Model', amount: '120.00' }), toSlipLine({ line_no: 1, lab_code: '9350', description: 'Bridge', amount: 4080.1 })];
    const events = [
      toDentalLabEvent({ status: 'received', from_status: 'sent', happened_on: '2026-10-12', changed_at: '2026-10-12T10:00:00Z', changer: { full_name: 'Reception' } }),
      toDentalLabEvent({ status: 'sent', from_status: null, happened_on: '2026-10-05', changed_at: '2026-10-05T09:00:00Z' })
    ];
    const order = toDentalLabOrder(row, events, lines);
    expect(order.slipLines).toEqual([
      { code: '9350', description: 'Bridge', amountCents: 408010 },
      { code: null, description: 'Model', amountCents: 12000 }
    ]);
    expect(order.events.map(event => event.status)).toEqual(['sent', 'received']);
    expect(order.events[1]).toMatchObject({ fromStatus: 'sent', changedBy: 'Reception', on: '2026-10-12' });
  });

  it('never shows an unknown status or work as something else silently: they fall back to the first step and "other"', () => {
    const order = toDentalLabOrder({ ...row, status: 'lost', work_type: 'spaceship', jaw: 'middle' });
    expect(order.status).toBe('sent');
    expect(order.workType).toBe('other');
    expect(order.jaw).toBeNull();
  });
});
