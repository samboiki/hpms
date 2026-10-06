import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stand-in for the Supabase client: records every call and answers from per-table queues
// ("batch_headers.select", "batch_details.delete", "rpc.add_invoice_to_batch", ...); the last
// queued answer repeats. Nothing here touches the live database.
const db = vi.hoisted(() => {
  type Op = [string, unknown[]];
  type Response = { data?: unknown; error: { message: string } | null };
  const state = {
    calls: [] as Array<{ table: string; ops: Op[] }>,
    queues: {} as Record<string, Response[]>,
    rpcCalls: [] as Array<{ name: string; args: unknown }>
  };
  const next = (key: string): Response => {
    const queue = state.queues[key];
    if (queue && queue.length > 1) return queue.shift() as Response;
    return queue?.[0] ?? { data: null, error: null };
  };
  const makeBuilder = (table: string) => {
    const entry = { table, ops: [] as Op[] };
    state.calls.push(entry);
    const kind = () => ['insert', 'update', 'delete'].find(name => entry.ops.some(([op]) => op === name)) ?? 'select';
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'in', 'order', 'limit', 'insert', 'update', 'delete']) {
      builder[method] = (...args: unknown[]) => {
        entry.ops.push([method, args]);
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve(next(`${table}.${kind()}`));
    builder.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(next(`${table}.${kind()}`)).then(resolve, reject);
    return builder;
  };
  const rpc = (name: string, args: unknown) => {
    state.rpcCalls.push({ name, args });
    return Promise.resolve(next(`rpc.${name}`));
  };
  return { state, makeBuilder, rpc };
});

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: (table: string) => db.makeBuilder(table), rpc: (name: string, args: unknown) => db.rpc(name, args) }
}));
vi.mock('../../../../services/communicationService', () => ({ communicationService: { sendEmail: vi.fn() } }));

import { addInvoicesToFundBatch, removeInvoiceFromBatch } from '../claimsService';

const batch = { id: 'b1', batch_number: 38 };
const linesBefore = [
  { invoice_number: 'INV1', service_amount: 100, discount_amount: 0 },
  { invoice_number: 'INV1', service_amount: 50, discount_amount: 0 },
  { invoice_number: 'INV2', service_amount: 30, discount_amount: 0 }
];
const linesAfter = [{ invoice_number: 'INV2', service_amount: 30, discount_amount: 0 }];
const openHeader = { id: 'b1', status: 'active', sent_at: null, total_invoices: 2, total_amount: 180 };

const callsTo = (table: string, op: string) => db.state.calls.filter(call => call.table === table && call.ops.some(([name]) => name === op));
const argsOf = (call: { ops: Array<[string, unknown[]]> }, op: string) => call.ops.filter(([name]) => name === op).map(([, args]) => args);

beforeEach(() => {
  db.state.calls = [];
  db.state.queues = {};
  db.state.rpcCalls = [];
});

// Business rule: only an UNSENT batch can lose an invoice. Once a batch has gone to the fund its
// lines are the claim on record, so the removal is refused and nothing is changed.
describe('removing an invoice from a batch that was already sent', () => {
  it.each([
    { label: 'status sent', header: { ...openHeader, status: 'sent', sent_at: '2026-10-05T10:00:00Z' } },
    { label: 'sent_at set', header: { ...openHeader, sent_at: '2026-10-05T10:00:00Z' } },
    { label: 'being sent automatically', header: { ...openHeader, status: 'sending' } },
    { label: 'paid', header: { ...openHeader, status: 'paid' } }
  ])('is refused ($label)', async ({ header }) => {
    db.state.queues['batch_headers.select'] = [{ data: header, error: null }];
    const result = await removeInvoiceFromBatch(batch, 'inv-1', 'INV1');
    expect(result.status).toBe('blocked');
    expect(callsTo('batch_details', 'delete')).toHaveLength(0);
    expect(callsTo('invoices_enhanced', 'update')).toHaveLength(0);
  });

  it('is refused when the batch cannot be checked or no longer exists', async () => {
    db.state.queues['batch_headers.select'] = [{ data: null, error: { message: 'timeout' } }];
    expect((await removeInvoiceFromBatch(batch, 'inv-1', 'INV1')).status).toBe('blocked');
    db.state.queues['batch_headers.select'] = [{ data: null, error: null }];
    expect((await removeInvoiceFromBatch(batch, 'inv-1', 'INV1')).status).toBe('blocked');
    expect(callsTo('batch_details', 'delete')).toHaveLength(0);
  });
});

// Business rule: removal deletes ONLY that invoice's lines in THIS batch, unlinks the invoice only if
// it still points to this batch, and leaves the header totals to the database unless their basis is
// proven - so the batch and its totals stay consistent.
describe('removing an invoice from an open batch', () => {
  beforeEach(() => {
    db.state.queues['batch_details.select'] = [{ data: linesBefore, error: null }, { data: linesAfter, error: null }];
    db.state.queues['batch_details.delete'] = [{ data: [{ id: 'd1' }, { id: 'd2' }], error: null }];
    db.state.queues['invoices_enhanced.update'] = [{ error: null }];
  });

  it('deletes only this invoice in this batch and lets the database update the totals', async () => {
    db.state.queues['batch_headers.select'] = [
      { data: openHeader, error: null },
      { data: { total_invoices: 1, total_amount: 30 }, error: null }
    ];
    const result = await removeInvoiceFromBatch(batch, 'inv-1', 'INV1');

    expect(result).toMatchObject({ status: 'removed', linesRemoved: 2, totals: 'database' });
    const [deleteCall] = callsTo('batch_details', 'delete');
    expect(argsOf(deleteCall, 'eq')).toEqual([['batch_header_id', 'b1'], ['invoice_id', 'inv-1']]);
    const [unlinkCall] = callsTo('invoices_enhanced', 'update');
    expect(argsOf(unlinkCall, 'update')[0][0]).toMatchObject({ batch_id: null });
    expect(argsOf(unlinkCall, 'eq')).toEqual([['id', 'inv-1'], ['batch_id', 'b1']]);
    expect(callsTo('batch_headers', 'update')).toHaveLength(0);
  });

  it('recomputes stale totals on the proven basis, only while the batch is unsent', async () => {
    db.state.queues['batch_headers.select'] = [
      { data: openHeader, error: null },
      { data: { total_invoices: 2, total_amount: 180 }, error: null }
    ];
    db.state.queues['batch_headers.update'] = [{ error: null }];
    const result = await removeInvoiceFromBatch(batch, 'inv-1', 'INV1');

    expect(result.totals).toBe('recomputed');
    const [totalsCall] = callsTo('batch_headers', 'update');
    expect(argsOf(totalsCall, 'update')[0][0]).toMatchObject({ total_invoices: 1, total_amount: 30 });
    expect(argsOf(totalsCall, 'is')).toEqual([['sent_at', null]]);
  });

  it('does not touch totals whose basis is unknown', async () => {
    db.state.queues['batch_headers.select'] = [
      { data: { ...openHeader, total_invoices: null, total_amount: null }, error: null },
      { data: { total_invoices: null, total_amount: null }, error: null }
    ];
    const result = await removeInvoiceFromBatch(batch, 'inv-1', 'INV1');
    expect(result).toMatchObject({ status: 'removed', totals: 'not_recomputed' });
    expect(callsTo('batch_headers', 'update')).toHaveLength(0);
  });

  it('changes nothing else when the lines cannot be deleted', async () => {
    db.state.queues['batch_headers.select'] = [{ data: openHeader, error: null }];
    db.state.queues['batch_details.delete'] = [{ data: null, error: { message: 'permission denied' } }];
    const result = await removeInvoiceFromBatch(batch, 'inv-1', 'INV1');
    expect(result.status).toBe('blocked');
    expect(result.message).toMatch(/Nothing was changed/);
    expect(callsTo('invoices_enhanced', 'update')).toHaveLength(0);
  });

  it('says exactly what is left to fix when the invoice cannot be unlinked', async () => {
    db.state.queues['batch_headers.select'] = [{ data: openHeader, error: null }];
    db.state.queues['invoices_enhanced.update'] = [{ error: { message: 'permission denied' } }];
    const result = await removeInvoiceFromBatch(batch, 'inv-1', 'INV1');
    expect(result.status).toBe('partial');
    expect(result.message).toMatch(/still points to the batch/);
  });
});

// Business rule: add_invoice_to_batch() inserts every invoice line without checking for existing
// lines, and the database batches invoices automatically, so an invoice is re-checked right before
// it is added and is never added twice.
describe('adding invoices to a fund batch', () => {
  it('adds unbatched invoices and skips ones that were batched in the meantime', async () => {
    db.state.queues['rpc.get_or_create_active_batch_id'] = [{ data: 'b9', error: null }];
    db.state.queues['invoices_enhanced.select'] = [
      { data: { id: 'inv-1', batch_id: null }, error: null },
      { data: { id: 'inv-2', batch_id: 'b-auto' }, error: null }
    ];
    db.state.queues['rpc.add_invoice_to_batch'] = [{ error: null }];

    const result = await addInvoicesToFundBatch('p1', 'NMC1', ['inv-1', 'inv-2']);

    expect(result.batchId).toBe('b9');
    expect(result.added).toEqual(['inv-1']);
    expect(result.failed).toEqual([{ invoiceId: 'inv-2', message: expect.stringMatching(/already in a batch/) }]);
    expect(db.state.rpcCalls.filter(call => call.name === 'add_invoice_to_batch')).toEqual([
      { name: 'add_invoice_to_batch', args: { p_batch_id: 'b9', p_invoice_id: 'inv-1' } }
    ]);
  });

  it('stops when no batch can be opened for the fund', async () => {
    db.state.queues['rpc.get_or_create_active_batch_id'] = [{ data: null, error: { message: 'practice_number not set' } }];
    await expect(addInvoicesToFundBatch('p1', 'NMC1', ['inv-1'])).rejects.toThrow(/practice_number not set/);
  });
});
