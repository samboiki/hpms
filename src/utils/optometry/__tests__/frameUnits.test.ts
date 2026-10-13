import { describe, expect, it } from 'vitest';
import {
  barcodeCheck,
  emptyReceiveLine,
  parseBarcodeList,
  toFrameUnit,
  toFrameUnitEvent,
  unitActions,
  unitCounts,
  unitStory,
  validateReceive,
  validateReturn,
  type FrameUnitEvent
} from '../frameUnits';

const event = (values: Partial<FrameUnitEvent>): FrameUnitEvent => ({
  unitId: 'u1', status: 'in_stock', fromStatus: null, reason: null, patientId: null, labOrderId: null, invoiceId: null, deliveryId: null,
  on: '2026-10-13', changedAt: '2026-10-13T08:00:00Z', changedBy: null, ...values
});

// Business rule: each physical frame on the wall has its own barcode and one status, so the practice knows where
// every frame is (on the wall, put aside for a patient, sold, back with the supplier, lost) and who moved it when
describe('a frame\'s barcode record', () => {
  it('reads the record with who changed it and who sold it', () => {
    const unit = toFrameUnit({
      id: 'u1', item_id: 'i1', barcode: 'FR000012', status: 'sold', patient_id: 'p1', invoice_id: 'inv1', sold_on: '2026-10-12',
      status_on: '2026-10-12', status_changed_at: '2026-10-12T09:00:00Z', changer: { full_name: 'Anna Reception' }, seller: [{ full_name: 'Ben Optom' }]
    });
    expect(unit).toMatchObject({ barcode: 'FR000012', status: 'sold', patientId: 'p1', soldOn: '2026-10-12', statusChangedBy: 'Anna Reception', soldBy: 'Ben Optom' });
    expect(toFrameUnit({ id: 'u2', status: 'made_up' }).status).toBe('in_stock');
  });

  it('counts the barcodes by status', () => {
    expect(unitCounts([{ status: 'in_stock' }, { status: 'in_stock' }, { status: 'sold' }, { status: 'reserved' }])).toEqual({
      in_stock: 2, reserved: 1, sold: 1, returned: 0, written_off: 0
    });
  });

  it('compares the barcodes on the shelf with the stock ledger, which is the truth', () => {
    // Two frames came in through the Stock page without barcodes yet
    expect(barcodeCheck(3, [{ status: 'in_stock' }, { status: 'sold' }])).toEqual({ withoutBarcode: 2, extraBarcodes: 0 });
    // A frame was written off on the Stock page: one barcode too many says which to look for
    expect(barcodeCheck(1, [{ status: 'in_stock' }, { status: 'reserved' }])).toEqual({ withoutBarcode: 0, extraBarcodes: 1 });
    expect(barcodeCheck(-2, [])).toEqual({ withoutBarcode: 0, extraBarcodes: 0 });
  });
});

// Business rule: the history must show what really happened; saving a visit's bill again takes the frame off the
// invoice and puts it back a moment later, which is not something staff need to read
describe('a frame\'s history', () => {
  it('hides a bill saved again, and keeps a real return of the frame', () => {
    const story = unitStory([
      event({ status: 'in_stock', changedAt: '2026-10-01T08:00:00Z', on: '2026-10-01' }),
      event({ status: 'sold', fromStatus: 'in_stock', invoiceId: 'inv1', changedAt: '2026-10-13T09:00:00Z' }),
      event({ status: 'reserved', fromStatus: 'sold', invoiceId: 'inv1', changedAt: '2026-10-13T09:05:00Z' }),
      event({ status: 'sold', fromStatus: 'reserved', invoiceId: 'inv1', changedAt: '2026-10-13T09:05:01Z' }),
      event({ status: 'in_stock', fromStatus: 'sold', invoiceId: 'inv1', changedAt: '2026-10-20T10:00:00Z', on: '2026-10-20', reason: 'Credited' })
    ]);
    expect(story.map(entry => entry.status)).toEqual(['in_stock', 'sold', 'in_stock']);
    expect(story[2].reason).toBe('Credited');
  });

  it('reads an event with its people', () => {
    expect(toFrameUnitEvent({ unit_id: 'u1', status: 'returned', from_status: 'in_stock', happened_on: '2026-10-13', changer: { full_name: 'Anna' } }))
      .toMatchObject({ status: 'returned', fromStatus: 'in_stock', on: '2026-10-13', changedBy: 'Anna' });
  });
});

// Business rule: only what can really be done is offered; writing a frame off changes the stock count, which only a
// practice admin or practitioner may do (the stock module's rule)
describe('what can be done with a frame', () => {
  it('offers the steps of its status to the right people', () => {
    expect(unitActions('in_stock', 'receptionist')).toEqual(['hold', 'return']);
    expect(unitActions('in_stock', 'admin')).toEqual(['hold', 'return', 'lost']);
    expect(unitActions('reserved', 'nurse')).toEqual(['release', 'return']);
    expect(unitActions('sold', 'receptionist')).toEqual([]);
    expect(unitActions('sold', 'doctor')).toEqual(['seller']);
    expect(unitActions('returned', 'admin')).toEqual([]);
    expect(unitActions('written_off', 'doctor')).toEqual(['found']);
    expect(unitActions('in_stock', null)).toEqual([]);
  });
});

// Business rule: frames arrive in boxes; a scanner types each barcode and Enter, so a list must be read the way a
// scanner sends it, and a frame scanned twice must not become two frames
describe('receiving and returning frames', () => {
  it('reads scanned barcodes and catches typos and double scans', () => {
    expect(parseBarcodeList('FR000001\nFR000002, fr000001 ab')).toEqual({ barcodes: ['FR000001', 'FR000002'], invalid: ['ab'], repeated: ['fr000001'] });
  });

  it('builds the delivery, without a cost for frames the supplier owns', () => {
    const result = validateReceive(
      {
        supplierId: 's1',
        reference: ' DN-77 ',
        lines: [
          { ...emptyReceiveLine('own'), quantity: '2', unitCost: '450' },
          { ...emptyReceiveLine('consigned'), quantity: '2', unitCost: '', barcodes: '6001\n6002' },
          emptyReceiveLine()
        ]
      },
      { practiceId: 'p1', consignment: new Set(['consigned']) }
    );
    expect(result).toEqual({
      ok: true,
      frames: 4,
      payload: {
        practice_id: 'p1', supplier_id: 's1', supplier_reference: 'DN-77',
        lines: [
          { item_id: 'own', quantity: 2, unit_cost: 450, barcodes: [] },
          { item_id: 'consigned', quantity: 2, unit_cost: 0, barcodes: ['6001', '6002'] }
        ]
      }
    });
  });

  it('needs one scanned barcode per frame, or none', () => {
    const result = validateReceive(
      { supplierId: 's1', reference: 'X1', lines: [{ ...emptyReceiveLine('own'), quantity: '3', unitCost: '100', barcodes: 'AB12' }] },
      { practiceId: 'p1', consignment: new Set() }
    );
    expect(result).toMatchObject({ ok: false, errors: { lines: [{ barcodes: expect.stringContaining('1 barcode for 3 frames') }] } });
    expect(validateReceive({ supplierId: '', reference: '', lines: [] }, { practiceId: 'p1', consignment: new Set() }))
      .toMatchObject({ ok: false, errors: { supplierId: expect.any(String), reference: expect.any(String), form: expect.any(String) } });
  });

  it('sends frames back with the supplier\'s document and why', () => {
    expect(validateReturn({ supplierId: 's1', reference: 'CN 5', reason: 'Slow sellers', unitIds: ['u1', 'u1', 'u2'] }, 'p1')).toEqual({
      ok: true,
      payload: { practice_id: 'p1', supplier_id: 's1', supplier_reference: 'CN 5', reason: 'Slow sellers', unit_ids: ['u1', 'u2'] }
    });
    expect(validateReturn({ supplierId: 's1', reference: 'CN 5', reason: 'x', unitIds: [] }, 'p1')).toMatchObject({ ok: false, errors: { reason: expect.any(String), unitIds: expect.any(String) } });
  });
});
