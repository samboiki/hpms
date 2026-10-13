/**
 * Receipts plumbing: the RPC payload contract (also used by the coming remittance import), the
 * printed and sent receipt, and how the screens tell "receipts not set up yet" from a real failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => {
  type Op = [string, unknown[]];
  type Response = { data: unknown; error: unknown };
  const state = {
    calls: [] as Array<{ table: string; ops: Op[] }>,
    responses: {} as Record<string, Response>
  };
  const makeBuilder = (table: string) => {
    const entry = { table, ops: [] as Op[] };
    state.calls.push(entry);
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'gte', 'gt', 'in', 'or', 'order', 'range']) {
      builder[method] = (...args: unknown[]) => {
        entry.ops.push([method, args]);
        return builder;
      };
    }
    builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve(state.responses[table] ?? { data: [], error: null }).then(resolve, reject);
    return builder;
  };
  return { state, makeBuilder };
});

vi.mock('../../../../lib/supabase', () => ({
  supabase: { from: (table: string) => db.makeBuilder(table), rpc: vi.fn() }
}));

import { buildAdjustmentPayload, buildReceiptPayload, centsToAmountText } from '../arPayloads';
import { isArNotSetUp, loadArWorkspace } from '../arService';
import { receiptHtml, receiptSmsText, statementHtml, type ReceiptDocument } from '../receiptDocuments';

describe('receipt payload (ar_post_receipt)', () => {
  it('sends amounts as exact 2-decimal text, so N$ 0.10 + N$ 0.20 is never 0.30000000000000004 in the database', () => {
    expect(centsToAmountText(30)).toBe('0.30');
    expect(centsToAmountText(123456)).toBe('1234.56');
    expect(centsToAmountText(-2500)).toBe('-25.00');
    expect(() => centsToAmountText(10.5)).toThrow(RangeError);
  });

  it("is one call with the receipt, its allocations and the fund's shortfalls; empty lines are left out", () => {
    const payload = buildReceiptPayload({
      practiceId: 'p1',
      payerType: 'medical_aid',
      fundName: '  Namibia Health Plan ',
      patientId: null,
      payerName: 'ignored for a fund',
      method: 'eft',
      amountCents: 150000,
      receivedOn: '2026-10-07',
      reference: ' RA 1234 ',
      source: 'remittance_import',
      externalRef: 'sha256:abc',
      allocations: [
        { invoiceId: 'i1', portion: 'medical_aid', amountCents: 100000, externalRef: 'line-1' },
        { invoiceId: 'i2', portion: 'medical_aid', amountCents: 0 }
      ],
      shortfalls: [{ invoiceId: 'i1', amountCents: 20000, reasonCode: '535' }, { invoiceId: 'i2', amountCents: 0 }]
    });
    expect(payload).toMatchObject({
      practice_id: 'p1',
      payer_type: 'medical_aid',
      fund_name: 'Namibia Health Plan',
      payer_name: null,
      amount: '1500.00',
      reference: 'RA 1234',
      source: 'remittance_import',
      external_ref: 'sha256:abc',
      allocations: [{ invoice_id: 'i1', portion: 'medical_aid', amount: '1000.00', external_ref: 'line-1' }],
      shortfalls: [{ invoice_id: 'i1', amount: '200.00', reason: null, reason_code: '535', external_ref: null }],
      write_offs: []
    });
  });

  it('sends a decreasing correction as a negative journal and a shortfall always from the medical aid portion', () => {
    expect(buildAdjustmentPayload({ practiceId: 'p', kind: 'journal', invoiceId: 'i', portion: 'patient', amountCents: -500, reason: ' Typo ' }))
      .toMatchObject({ kind: 'journal', amount: '-5.00', portion: 'patient', reason: 'Typo' });
    expect(buildAdjustmentPayload({ practiceId: 'p', kind: 'shortfall_transfer', invoiceId: 'i', portion: 'patient', amountCents: 100, reason: 'x' }))
      .toMatchObject({ portion: 'medical_aid' });
    expect(buildAdjustmentPayload({ practiceId: 'p', kind: 'refund', receiptId: 'r', amountCents: 2500, method: 'cash', reason: 'Overpaid' }))
      .toEqual({ practice_id: 'p', kind: 'refund', amount: '25.00', reason: 'Overpaid', effective_on: null, receipt_id: 'r', method: 'cash' });
  });
});

describe('receipt documents', () => {
  const doc: ReceiptDocument = {
    practiceName: 'Dr <Shilongo> & Partners',
    receiptNumber: 'RC-000012',
    receivedOn: '2026-10-07',
    payer: 'Ndapewa Shilongo',
    method: 'cash',
    amountCents: 50000,
    lines: [{ invoiceNumber: 'INV-1', portion: 'patient', amountCents: 45000 }],
    unallocatedCents: 5000,
    receivedBy: 'Reception'
  };

  it('prints amounts in N$, dates day first, and escapes names so a patient name can never inject markup', () => {
    const html = receiptHtml(doc);
    expect(html).toContain('Dr &lt;Shilongo&gt; &amp; Partners');
    expect(html).not.toContain('<Shilongo>');
    expect(html).toContain('N$ 500.00');
    expect(html).toContain('7 Oct 2026');
    expect(html).toContain('Credit on the account (not allocated)');
  });

  it('keeps the SMS to the facts a patient needs, including credit left on the account', () => {
    expect(receiptSmsText(doc)).toBe(
      'Dr <Shilongo> & Partners: thank you, we received N$ 500.00 (cash) on 7 Oct 2026. Receipt RC-000012. N$ 50.00 is kept as credit on your account.'
    );
  });

  it('prints a statement with the closing balance per portion', () => {
    const html = statementHtml(
      {
        lines: [{ key: 'a', dateKey: '2026-10-01', kind: 'invoice', reference: 'INV-1', description: 'Invoice INV-1', medicalAid: 80000, patient: 20000, credit: 0, balance: { medicalAid: 80000, patient: 20000, credit: 0, total: 100000 } }],
        closing: { medicalAid: 80000, patient: 20000, credit: 0, total: 100000 }
      },
      { practiceName: 'Clinic', patientName: 'A Patient', asAtKey: '2026-10-07' }
    );
    expect(html).toContain('Medical aid still owes');
    expect(html).toContain('N$ 1,000.00');
  });

  it("prints the account's message under the heading and the practice's lines at the foot, escaped (parity I8, D22, D26)", () => {
    const html = statementHtml(
      { lines: [], closing: { medicalAid: 0, patient: 0, credit: 0, total: 0 } },
      { practiceName: 'Clinic', patientName: 'A Patient', asAtKey: '2026-10-07', notices: ['Arrangement: <N$ 200> a month'], footnotes: ['Paid invoices are left off.', '', 'Payable within 30 days.'] }
    );
    expect(html).toContain('<p>Arrangement: &lt;N$ 200&gt; a month</p>');
    expect(html).toContain('<p class="muted">Paid invoices are left off.</p>');
    expect(html).toContain('<p class="muted">Payable within 30 days.</p>');
    expect(html).not.toContain('<p class="muted"></p>');
  });
});

describe('receipts not set up yet', () => {
  beforeEach(() => {
    db.state.calls = [];
    db.state.responses = {};
  });

  it('recognises a missing table or function (PostgREST and Postgres codes) as "not set up", not as a failure', () => {
    expect(isArNotSetUp({ code: 'PGRST205', message: "Could not find the table 'public.receipts' in the schema cache" })).toBe(true);
    expect(isArNotSetUp({ code: '42P01', message: 'relation "public.receipts" does not exist' })).toBe(true);
    expect(isArNotSetUp({ code: 'PGRST202', message: 'Could not find the function public.ar_post_receipt' })).toBe(true);
    expect(isArNotSetUp({ code: '42501', message: 'permission denied for table receipts' })).toBe(false);
    expect(isArNotSetUp(new Error('Failed to fetch'))).toBe(false);
  });

  it('lets Finance fall back to invoices marked paid when the receipts view does not exist', async () => {
    db.state.responses.ar_receipt_balances = { data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.ar_receipt_balances' in the schema cache" } };
    const ar = await loadArWorkspace('practice-1', '2025-11-01');
    expect(ar.state).toBe('not_set_up');
    expect(ar.error).toBeNull();
  });

  it('reports a real failure instead of silently showing no receipts', async () => {
    db.state.responses.ar_receipt_balances = { data: null, error: { code: '42501', message: 'permission denied for view ar_receipt_balances' } };
    const ar = await loadArWorkspace('practice-1', '2025-11-01');
    expect(ar.state).toBe('error');
    expect(ar.error).toMatch(/permission denied/);
  });

  it("reads only the practice's receipts: the window's, plus older ones with money still unallocated", async () => {
    await loadArWorkspace('practice-1', '2025-11-01');
    const receipts = db.state.calls.find(call => call.table === 'ar_receipt_balances')!;
    expect(receipts.ops).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(receipts.ops).toContainEqual(['or', ['received_on.gte.2025-11-01,unallocated.gt.0']]);
    const balances = db.state.calls.find(call => call.table === 'ar_invoice_balances')!;
    // invoices without entries follow their status, so only invoices with entries are read
    expect(balances.ops).toContainEqual(['eq', ['has_entries', true]]);
    expect(balances.ops).toContainEqual(['eq', ['practice_id', 'practice-1']]);
  });
});
