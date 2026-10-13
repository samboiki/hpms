import { describe, expect, it } from 'vitest';
import { FRAME_GROUP, emptyFrameDraft, frameName, frameStatus, soldUnits, validateFrameDraft, type FrameDraft } from '../frames';

const form = (values: Partial<FrameDraft>): FrameDraft => ({ ...emptyFrameDraft(), brand: 'Kenzo', model: 'KZ 2201', colour: 'Black', size: '52-18-140', ...values });

// Business rule: a frame is stock like any other item (deliveries, counts, valuation, the sale on the invoice), so it
// must pass the stock module's own checks and land in the Frames group the stock screens and reports filter on
describe('a frame as a stock item', () => {
  it('names the item after the frame, so invoices and stock lists show what it is', () => {
    expect(frameName({ brand: 'Kenzo', model: 'KZ 2201', colour: 'Black', size: '52-18-140' })).toBe('Kenzo KZ 2201 Black 52-18-140');
    expect(frameName({ brand: 'Kenzo', model: 'KZ 2201', colour: null, size: null })).toBe('Kenzo KZ 2201');
  });

  it('saves it in the Frames group, sold per frame, with the barcode and billing code', () => {
    const result = validateFrameDraft(form({ barcode: '6001234567890', tariffCode: '3020', costPrice: '450', sellingPrice: '1200', openingQuantity: '2' }), {
      practiceId: 'p1',
      costLocked: false
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.item).toMatchObject({
        practice_id: 'p1',
        name: 'Kenzo KZ 2201 Black 52-18-140',
        category: 'other',
        unit: 'each',
        item_group: FRAME_GROUP,
        barcode: '6001234567890',
        tariff_code: '3020',
        unit_cost: 450,
        selling_price: 1200,
        opening_quantity: 2
      });
      expect(result.frame).toEqual({ brand: 'Kenzo', model: 'KZ 2201', colour: 'Black', size: '52-18-140' });
    }
  });

  it('shows the stock module\'s complaints on the frame form\'s own fields', () => {
    const result = validateFrameDraft(form({ barcode: '12', costPrice: 'cheap' }), { practiceId: 'p1', costLocked: false });
    expect(result).toMatchObject({ ok: false, errors: { barcode: expect.any(String), costPrice: expect.any(String) } });
  });

  // Business rule: a consignment frame is the supplier's until it is sold, so it carries no stock value and the
  // practice must know who it owes and how much per frame sold
  it('saves a consignment frame without stock value, with its supplier and what is owed per frame', () => {
    const missing = validateFrameDraft(form({ consignment: true, consignmentCost: '', supplierId: '' }), { practiceId: 'p1', costLocked: false });
    expect(missing).toMatchObject({ ok: false, errors: { supplierId: expect.any(String), consignmentCost: expect.any(String) } });
    const result = validateFrameDraft(form({ consignment: true, consignmentCost: '400', supplierId: 's1', costPrice: '450' }), { practiceId: 'p1', costLocked: false });
    expect(result).toMatchObject({ ok: true, item: { unit_cost: 0, preferred_supplier_id: 's1' }, consignment: { consignment: true, consignment_cost: 400 } });
    const own = validateFrameDraft(form({ costPrice: '450' }), { practiceId: 'p1', costLocked: false });
    expect(own).toMatchObject({ ok: true, item: { unit_cost: 450 }, consignment: { consignment: false, consignment_cost: null } });
  });

  it('needs the brand and the model', () => {
    const result = validateFrameDraft(form({ brand: '', model: ' ' }), { practiceId: 'p1', costLocked: false });
    expect(result).toMatchObject({ ok: false, errors: { brand: expect.any(String), model: expect.any(String) } });
  });
});

describe('a frame\'s status from its stock movements and open orders', () => {
  it('counts frames billed, less those taken off an invoice again', () => {
    expect(soldUnits([{ kind: 'sold', quantity: -1 }, { kind: 'sold', quantity: -1 }, { kind: 'sale_reversed', quantity: 1 }, { kind: 'received', quantity: 5 }])).toBe(1);
  });

  it('follows one frame from the shelf to the patient', () => {
    expect(frameStatus({ onHand: 1, onOrder: 0, sold: 0 })).toBe('in_stock');
    // Chosen for an order: still on the shelf count until billed, but promised to the patient
    expect(frameStatus({ onHand: 1, onOrder: 1, sold: 0 })).toBe('on_order');
    expect(frameStatus({ onHand: 0, onOrder: 1, sold: 1 })).toBe('on_order');
    expect(frameStatus({ onHand: 0, onOrder: 0, sold: 1 })).toBe('sold');
    expect(frameStatus({ onHand: 0, onOrder: 0, sold: 0 })).toBe('none');
  });

  it('still shows a model as in stock while more are on hand than are promised', () => {
    expect(frameStatus({ onHand: 3, onOrder: 1, sold: 4 })).toBe('in_stock');
  });
});
