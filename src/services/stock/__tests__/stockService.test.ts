import { describe, expect, it, vi } from 'vitest';

// Every query is answered from this table of results; nothing reaches the database
const results: Record<string, { data: unknown; error: unknown }> = {};
vi.mock('../../../lib/supabase', () => {
  const chain = (table: string) => {
    const query = {
      select: () => query,
      in: () => query,
      not: () => query,
      then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(results[table] ?? { data: [], error: null })
    };
    return query;
  };
  return { supabase: { from: (table: string) => chain(table), rpc: vi.fn() } };
});

import { isStockNotSetUpError, loadBilledStockByVisit, StockNotSetUpError } from '../stockService';

describe('is stock set up yet?', () => {
  it('says "not set up" for our own missing tables, columns and functions, so the screens wait for the database update', () => {
    expect(isStockNotSetUpError({ code: 'PGRST205', message: "Could not find the table 'public.stock_settings' in the schema cache" })).toBe(true);
    expect(isStockNotSetUpError({ code: '42P01', message: 'relation "public.stock_movements" does not exist' })).toBe(true);
    expect(isStockNotSetUpError({ code: '42703', message: 'column practice_inventory.nappi_code does not exist' })).toBe(true);
    expect(isStockNotSetUpError({ code: 'PGRST202', message: 'Could not find the function public.stock_dispense(p_payload)' })).toBe(true);
    expect(isStockNotSetUpError(new StockNotSetUpError())).toBe(true);
  });

  it('never hides a real error behind "not set up" (another table missing, a refusal, a network failure)', () => {
    expect(isStockNotSetUpError({ code: '42P01', message: 'relation "public.invoices_enhanced" does not exist' })).toBe(false);
    expect(isStockNotSetUpError({ code: '42501', message: 'Only a practice admin can change the stock and dispensing settings' })).toBe(false);
    expect(isStockNotSetUpError(new Error('Failed to fetch'))).toBe(false);
    expect(isStockNotSetUpError(null)).toBe(false);
  });
});

describe('medicine on the visit\'s invoice', () => {
  it('counts the stock units of the visit\'s standing invoice, and ignores a cancelled one, so "billed" means charged', async () => {
    results.invoices_enhanced = {
      data: [
        { id: 'inv-1', visit_id: 'v1', invoice_number: 'INV-0101', payment_status: 'pending' },
        { id: 'inv-2', visit_id: 'v2', invoice_number: 'INV-0102', payment_status: 'cancelled' }
      ],
      error: null
    };
    results.invoice_services = {
      data: [
        { invoice_id: 'inv-1', stock_item_id: 'item-1', quantity: 20 },
        { invoice_id: 'inv-1', stock_item_id: 'item-1', quantity: 10 }
      ],
      error: null
    };
    const bills = await loadBilledStockByVisit(['v1', 'v2', 'v1']);
    expect(bills.get('v1')).toEqual({ invoiceId: 'inv-1', invoiceNumber: 'INV-0101', units: new Map([['item-1', 30]]) });
    expect(bills.has('v2')).toBe(false);
  });
});
