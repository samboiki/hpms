import { beforeEach, describe, expect, it, vi } from 'vitest';

// Whether the database has stock_deliveries.consignment (proposals/2026-10-13-consignment-supplier-ledger.sql), and the
// columns each read of stock_deliveries asked for. Nothing reaches the database; every row is invented.
const db = vi.hoisted(() => ({ hasColumn: false, deliveryReads: [] as string[] }));

vi.mock('../../../lib/supabase', () => {
  const answer = (table: string, columns: string) => {
    if (table !== 'stock_deliveries') return { data: [], error: null };
    db.deliveryReads.push(columns);
    if (!db.hasColumn && columns.includes('consignment')) {
      return { data: null, error: { code: '42703', message: 'column stock_deliveries.consignment does not exist' } };
    }
    return {
      data: [{
        id: 'g1', number: 'GRV2026-0001', kind: 'received', supplier_id: 's1', supplier_reference: 'W-1', document_date: '2026-08-01',
        total_excl_vat: '100.00', vat_amount: '15.00', total_incl_vat: '115.00', on_account: true, expense_id: null,
        created_at: '2026-08-01T08:00:00Z', ...(db.hasColumn ? { consignment: false } : {})
      }],
      error: null
    };
  };
  interface Query extends PromiseLike<unknown> {
    eq: () => Query;
    in: () => Query;
    order: () => Query;
    limit: () => Query;
    range: () => Query;
  }
  const query = (table: string, columns: string): Query => {
    const chain: Query = {
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      limit: () => chain,
      range: () => chain,
      then: (onFulfilled, onRejected) => Promise.resolve(answer(table, columns)).then(onFulfilled, onRejected)
    };
    return chain;
  };
  return { supabase: { from: (table: string) => ({ select: (columns: string) => query(table, columns) }), rpc: vi.fn() } };
});

import { isConsignmentColumnMissing, loadSupplierLedger } from '../supplierLedgerService';
import { loadDeliveries } from '../stockService';

beforeEach(() => {
  db.deliveryReads = [];
});

// The app must keep working before the SQL is applied: a missing column must not take the supplier ledger (or the whole
// Stock page, which treats a missing stock column as "not set up yet") down with it
describe('supplier invoices before the consignment update is applied', () => {
  it('still loads the supplier ledger, reading the deliveries again without the new column', async () => {
    db.hasColumn = false;
    const ledger = await loadSupplierLedger('practice-1');
    expect(ledger.deliveries).toHaveLength(1);
    expect(ledger.deliveries[0]).toMatchObject({ number: 'GRV2026-0001', consignment: false, inclVatCents: 11500 });
    expect(db.deliveryReads).toHaveLength(2);
    expect(db.deliveryReads[1]).not.toMatch(/consignment/);
  });

  it('still lists the deliveries on Stock > Deliveries', async () => {
    db.hasColumn = false;
    const deliveries = await loadDeliveries('practice-1');
    expect(deliveries.map(row => [row.number, row.consignment])).toEqual([['GRV2026-0001', false]]);
  });

  it('reads once, with the column, once the update is applied', async () => {
    db.hasColumn = true;
    await loadSupplierLedger('practice-1');
    expect(db.deliveryReads).toHaveLength(1);
    expect(db.deliveryReads[0]).toMatch(/consignment/);
  });

  it('only steps around the consignment column itself: any other missing column is a real error', () => {
    expect(isConsignmentColumnMissing({ code: '42703', message: 'column stock_deliveries.consignment does not exist' })).toBe(true);
    expect(isConsignmentColumnMissing({ code: '42703', message: 'column stock_deliveries.on_account does not exist' })).toBe(false);
    expect(isConsignmentColumnMissing({ code: '42501', message: 'permission denied for table stock_deliveries (consignment)' })).toBe(false);
  });
});
