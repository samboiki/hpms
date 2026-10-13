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
    for (const method of ['select', 'eq', 'is', 'in', 'gte', 'order', 'limit', 'insert', 'update', 'delete']) {
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

import {
  addInvoicesToFundBatch,
  FUND_NOT_LINKED_REASON,
  loadInvoiceClaimPlaces,
  loadUnbatchedInvoices,
  NO_MEDICAL_AID_REASON,
  removeInvoiceFromBatch,
  saveInvoiceLineCodes,
  saveLineDiagnoses
} from '../claimsService';

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

// Business rule: a doctor's secondary ICD-10 codes must survive saving (funds may need them to approve a line). Until
// the 20-character column is widened, a save must still succeed with the codes that fit, and report it, not fail.
describe('saving the ICD-10 codes of batch lines', () => {
  const updatesOf = () => callsTo('batch_details', 'update').map(call => (argsOf(call, 'update')[0][0] as { diagnostic_code: string }).diagnostic_code);

  it('saves the primary and secondary codes as the claim writes them', async () => {
    db.state.queues['batch_details.update'] = [{ data: null, error: null }];
    await expect(saveLineDiagnoses('b1', [{ detailId: 'd1', primary: 'k021', secondary: ['K04.0', 'Z01.2'] }])).resolves.toEqual({ shortened: 0 });
    expect(updatesOf()).toEqual(['K02.1/K04.0/Z01.2']);
  });

  it('keeps the codes that fit when the column is still 20 characters, and counts the line', async () => {
    const tooLong = { data: null, error: { message: 'value too long for type character varying(20)', code: '22001' } as { message: string } };
    db.state.queues['batch_details.update'] = [tooLong, { data: null, error: null }];
    await expect(
      saveLineDiagnoses('b1', [{ detailId: 'd1', primary: 'K02.1', secondary: ['K04.0', 'Z01.2', 'K08.1'] }])
    ).resolves.toEqual({ shortened: 1 });
    expect(updatesOf()).toEqual(['K02.1/K04.0/Z01.2/K08.1', 'K02.1/K04.0/Z01.2']);
  });

  it('still fails loudly on any other database error', async () => {
    db.state.queues['batch_details.update'] = [{ data: null, error: { message: 'permission denied' } }];
    await expect(saveLineDiagnoses('b1', [{ detailId: 'd1', primary: 'K02.1', secondary: [] }])).rejects.toThrow(/permission denied/);
  });
});

// Business rule: codes fixed at claim review go onto the invoice lines too, and nothing else on the invoice changes.
// Each change makes the database batch the invoice again, so staff are told when that took it out of this batch.
describe('putting ICD-10 codes on invoice lines', () => {
  const copy = (rebuildsClaim: boolean) => ({
    invoiceId: 'inv-1',
    invoiceNumber: 'A-001',
    rebuildsClaim,
    lines: [
      { invoiceLineId: 'svc-1', primary: 'J06.9', secondary: ['I10'] },
      { invoiceLineId: 'svc-2', primary: 'K02.1', secondary: [] }
    ]
  });

  it('changes only the code columns of that line of that invoice', async () => {
    db.state.queues['invoice_services.update'] = [{ data: [{ id: 'svc-x' }], error: null }];
    db.state.queues['batch_details.select'] = [{ data: [{ id: 'd1' }, { id: 'd2' }], error: null }];
    await expect(saveInvoiceLineCodes('b1', [copy(true)])).resolves.toEqual({ copied: 2, failed: [], left: [] });
    const [first] = callsTo('invoice_services', 'update');
    expect(Object.keys(argsOf(first, 'update')[0][0] as object).sort()).toEqual(['icd10_primary', 'icd10_secondary', 'updated_at']);
    expect(argsOf(first, 'update')[0][0]).toMatchObject({ icd10_primary: 'J06.9', icd10_secondary: ['I10'] });
    expect(argsOf(first, 'eq')).toEqual([['id', 'svc-1'], ['invoice_id', 'inv-1']]);
  });

  // Row security hides another practice's line: no error, but no row changed either
  it('counts a line the database did not change as failed and leaves the rest of that invoice alone', async () => {
    db.state.queues['invoice_services.update'] = [{ data: [], error: null }];
    const result = await saveInvoiceLineCodes('b1', [copy(true)]);
    expect(result).toEqual({ copied: 0, failed: [{ invoiceNumber: 'A-001', message: 'the invoice line was not changed' }], left: [] });
    expect(callsTo('invoice_services', 'update')).toHaveLength(1);
  });

  it("says when the invoice's claim lines are no longer in this batch afterwards", async () => {
    db.state.queues['invoice_services.update'] = [{ data: [{ id: 'svc-x' }], error: null }];
    db.state.queues['batch_details.select'] = [{ data: [], error: null }];
    expect((await saveInvoiceLineCodes('b1', [copy(true)])).left).toEqual(['A-001']);
  });

  // The invoice of a resubmitted line belongs to a sent batch, which the database never rebuilds: nothing to check
  it('does not look for moved lines when the database rebuilds no batch', async () => {
    db.state.queues['invoice_services.update'] = [{ data: [{ id: 'svc-x' }], error: null }];
    await saveInvoiceLineCodes('b1', [copy(false)]);
    expect(db.state.calls.filter(call => call.table === 'batch_details')).toHaveLength(0);
  });
});

// Business rule: an invoice's lines may only take codes when it is known where its claim lines are
describe('where invoices are claimed', () => {
  it("knows each invoice's own batch and every batch holding its lines; an unreadable batch leaves the invoice out", async () => {
    db.state.queues['invoices_enhanced.select'] = [{ data: [{ id: 'inv-1', batch_id: 'b1' }, { id: 'inv-2', batch_id: 'b-gone' }, { id: 'inv-3', batch_id: null }], error: null }];
    db.state.queues['batch_details.select'] = [
      { data: [{ invoice_id: 'inv-1', batch_header_id: 'b1' }, { invoice_id: 'inv-1', batch_header_id: 'b0' }, { invoice_id: 'inv-3', batch_header_id: 'b1' }], error: null }
    ];
    db.state.queues['batch_headers.select'] = [{ data: [{ id: 'b1', status: 'active', sent_at: null }], error: null }];
    const places = await loadInvoiceClaimPlaces(['inv-1', 'inv-2', 'inv-3']);
    expect([...places.keys()]).toEqual(['inv-1', 'inv-3']);
    expect(places.get('inv-1')).toEqual({ ownBatch: { id: 'b1', status: 'active', sent_at: null }, batchIds: ['b1', 'b0'] });
    expect(places.get('inv-3')).toEqual({ ownBatch: null, batchIds: ['b1'] });
  });
});

// Business rule: an invoice billed to a fund that no batch can take (the patient's file no longer names a fund with a
// claim code, or has no medical aid at all) must stay in sight with the reason. The database takes it out of its open
// batch, so this list is the only place left that shows it; without it, it is never claimed or chased
describe('medical aid invoices that are in no batch', () => {
  const funds = [{ id: 'f1', name: 'Test Medical Fund', short_name: 'TMF', email: null, medical_aid_reference: 'TMF1', logo_url: null, theme_color: null }];

  it("lists an invoice whose patient's fund is not linked, or who has no medical aid any more, with the reason", async () => {
    const invoice = (id: string, number: string, patient: string, medicalAid: number) =>
      ({ id, invoice_number: number, issue_date: '2026-10-01', visit_id: null, patient_id: patient, total: 500, medical_aid_total: medicalAid, payment_status: 'pending' });
    db.state.queues['invoices_enhanced.select'] = [{ data: [
      invoice('linked', 'INV-1', 'p-linked', 500),
      invoice('by-name', 'INV-2', 'p-name', 400),
      invoice('no-aid', 'INV-3', 'p-none', 300),
      invoice('private', 'INV-4', 'p-private', 0)
    ], error: null }];
    db.state.queues['medical_aid_details.select'] = [{ data: [
      { patient_id: 'p-linked', medical_aid_provider_id: 'f1', provider: 'Test Medical Fund' },
      // The fund chosen by name only: the batches need the fund itself (its claim code), as the database looks it up
      { patient_id: 'p-name', medical_aid_provider_id: null, provider: 'Test Medical Fund' }
    ], error: null }];
    db.state.queues['account_flags.select'] = [{ data: [], error: null }];
    db.state.queues['patients.select'] = [{ data: [], error: null }];
    db.state.queues['invoice_services.select'] = [{ data: ['linked', 'by-name', 'no-aid', 'private'].map(id => ({ invoice_id: id })), error: null }];

    const listed = await loadUnbatchedInvoices('practice-1', funds, '2025-10-13');

    // A private invoice of a patient without medical aid is no claim, so it is not listed
    expect(listed.map(row => [row.invoiceNumber, row.fundReference, row.notClaimableReason])).toEqual([
      ['INV-1', 'TMF1', null],
      ['INV-2', 'TMF1', FUND_NOT_LINKED_REASON],
      ['INV-3', null, NO_MEDICAL_AID_REASON]
    ]);
    expect(listed.map(row => row.patientId)).toEqual(['p-linked', 'p-name', 'p-none']);
  });
});
