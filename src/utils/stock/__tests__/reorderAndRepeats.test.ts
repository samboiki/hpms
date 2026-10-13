import { describe, expect, it } from 'vitest';
import { reorderQuantity, reorderReport, type ReorderItem } from '../reorder';
import { dueText, summarizeScripts, type DispensingRecord } from '../repeats';
import { canStock, whoCan } from '../stockRoles';

const item = (overrides: Partial<ReorderItem>): ReorderItem => ({
  id: 'i', name: 'Item', unit: 'tablet', onHand: 0, minimum: null, maximum: null, packSize: null, supplierId: null,
  unitCostCents: 100, isActive: true, ...overrides
});

describe('reorder report', () => {
  it('orders an item at or below its minimum back up to its maximum', () => {
    expect(reorderQuantity(item({ onHand: 15, minimum: 15, maximum: 60 }))).toBe(45);
    expect(reorderQuantity(item({ onHand: 16, minimum: 15, maximum: 60 }))).toBe(0);
  });

  it('rounds up to whole packs, because suppliers sell packs, not tablets', () => {
    expect(reorderQuantity(item({ onHand: 12, minimum: 15, maximum: 60, packSize: 28 }))).toBe(56);
  });

  it('fills to twice the minimum when no maximum is set, so the item does not come straight back on the report', () => {
    expect(reorderQuantity(item({ onHand: 3, minimum: 10 }))).toBe(17);
  });

  it('leaves out items without a minimum and items no longer used (as the inventory\'s "low stock" does)', () => {
    expect(reorderQuantity(item({ onHand: 0, minimum: null }))).toBe(0);
    expect(reorderQuantity(item({ onHand: 0, minimum: 0 }))).toBe(0);
    expect(reorderQuantity(item({ onHand: 0, minimum: 5, isActive: false }))).toBe(0);
  });

  it('groups the lines by supplier, items without a supplier last, so each group can become one order', () => {
    const groups = reorderReport([
      item({ id: 'a', name: 'A', onHand: 1, minimum: 5, supplierId: null }),
      item({ id: 'b', name: 'B', onHand: 2, minimum: 5, supplierId: 's1', unitCostCents: 250 }),
      item({ id: 'c', name: 'C', onHand: 9, minimum: 5, supplierId: 's1' })
    ]);
    expect(groups.map(group => [group.supplierId, group.lines.map(line => line.item.id)])).toEqual([['s1', ['b']], [null, ['a']]]);
    expect(groups[0].estimateCents).toBe(8 * 250);
  });
});

const record = (overrides: Partial<DispensingRecord>): DispensingRecord => ({
  id: 'd1', number: 'RX2026-0001', patientId: 'p1', visitId: null, itemId: 'i1', quantity: 30, directions: 'Take 1 three times a day.',
  directionsCode: '1 tds', prescribedAs: null, daysSupply: 10, repeatsAllowed: 2, repeatOf: null, isChronic: true,
  validUntil: '2027-04-01', prescriberId: null, billed: true, unitPriceCents: null, dispensedOn: '2026-10-01',
  createdAt: '2026-10-01T09:00:00Z', cancelledAt: null, cancelReason: null, ...overrides
});

describe('repeats', () => {
  it('counts repeats left and sets the next one due when the last supply runs out', () => {
    const [script] = summarizeScripts([record({}), record({ id: 'd2', repeatOf: 'd1', repeatsAllowed: 0, dispensedOn: '2026-10-11', createdAt: '2026-10-11T09:00:00Z' })], '2026-10-12');
    expect(script.repeatsLeft).toBe(1);
    expect(script.lastDispensedOn).toBe('2026-10-11');
    expect(script.nextDueOn).toBe('2026-10-21');
    expect(script.state).toBe('repeats_left');
  });

  it('has no due day once every repeat is dispensed, so the patient is not reminded about a used-up script', () => {
    const [script] = summarizeScripts([record({ repeatsAllowed: 1 }), record({ id: 'd2', repeatOf: 'd1', repeatsAllowed: 0, dispensedOn: '2026-10-11' })], '2026-10-12');
    expect(script.state).toBe('all_used');
    expect(script.nextDueOn).toBeNull();
  });

  it('ignores a cancelled repeat (it was never given) and stops an expired script', () => {
    const [withCancelled] = summarizeScripts([record({}), record({ id: 'd2', repeatOf: 'd1', repeatsAllowed: 0, cancelledAt: '2026-10-11T10:00:00Z', dispensedOn: '2026-10-11' })], '2026-10-12');
    expect(withCancelled.repeatsLeft).toBe(2);
    const [expired] = summarizeScripts([record({ validUntil: '2026-10-05' })], '2026-10-12');
    expect(expired.state).toBe('expired');
    expect(expired.nextDueOn).toBeNull();
  });

  it('says when a repeat is due in words', () => {
    const format = (key: string) => key;
    expect(dueText('2026-10-12', '2026-10-12', format)).toBe('Due today');
    expect(dueText('2026-10-15', '2026-10-12', format)).toBe('Due in 3 days (2026-10-15)');
    expect(dueText('2026-10-10', '2026-10-12', format)).toBe('2 days overdue (since 2026-10-10)');
  });
});

describe('who may do what with stock (the database enforces the same lists)', () => {
  it('lets only admins change the price rule and dispensing switch', () => {
    expect(canStock('admin', 'settings')).toBe(true);
    expect(canStock('doctor', 'settings')).toBe(false);
  });

  it('lets any staff member receive a delivery or count stock, but only admins and doctors write stock off', () => {
    expect(canStock('receptionist', 'receive')).toBe(true);
    expect(canStock('receptionist', 'count')).toBe(true);
    expect(canStock('receptionist', 'adjust')).toBe(false);
    expect(canStock('nurse', 'dispense')).toBe(true);
    expect(canStock(null, 'receive')).toBe(false);
    expect(whoCan('adjust')).toBe('Only a practice admin or doctor can do this.');
  });
});
