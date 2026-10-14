import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stand-in for the Supabase client: records every call per table and answers from canned
// responses, so the submission flow is tested without touching the live database.
const db = vi.hoisted(() => {
  type Op = [string, unknown[]];
  type Response = { data?: unknown; error: { message: string } | null };
  type RpcResponse = { data?: unknown; error: { code?: string; message: string } | null };
  const state = {
    calls: [] as Array<{ table: string; ops: Op[] }>,
    responses: {} as Record<string, Response>,
    rpcCalls: [] as Array<[string, unknown]>,
    rpc: {} as Record<string, RpcResponse>
  };
  const makeBuilder = (table: string) => {
    const entry = { table, ops: [] as Op[] };
    state.calls.push(entry);
    const respond = () => {
      const kind = entry.ops.some(([op]) => op === 'insert') ? 'insert' : entry.ops.some(([op]) => op === 'update') ? 'update' : 'select';
      return state.responses[`${table}.${kind}`] ?? { data: null, error: null };
    };
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'is', 'in', 'order', 'limit', 'insert', 'update']) {
      builder[method] = (...args: unknown[]) => {
        entry.ops.push([method, args]);
        return builder;
      };
    }
    builder.maybeSingle = () => {
      entry.ops.push(['maybeSingle', []]);
      return Promise.resolve(respond());
    };
    builder.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) =>
      Promise.resolve(respond()).then(resolve, reject);
    return builder;
  };
  return { state, makeBuilder };
});

const email = vi.hoisted(() => ({ sendEmail: vi.fn() }));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => db.makeBuilder(table),
    // The database answers "no line is missing a code" unless a test says otherwise
    rpc: (name: string, args: unknown) => {
      db.state.rpcCalls.push([name, args]);
      return Promise.resolve(db.state.rpc[name] ?? { data: 0, error: null });
    }
  }
}));
vi.mock('../../../../services/communicationService', () => ({ communicationService: email }));

import { submitBatch, toBase64 } from '../claimsService';
import type { BatchHeaderRow, PracticeInfo } from '../types';

const practice: PracticeInfo = { id: 'p1', name: 'Smile Dental', practice_number: '0540001133241', practice_type: 'dental', contact_email: 'claims@smile.example' };
const batch = {
  id: 'b1', practice_id: 'p1', practice_number: '0540001133241', batch_number: 38, batch_date: '2026-10-06', medical_aid_reference: 'NMC1',
  status: 'active', total_amount: 373.9, total_invoices: 1, generated_file_content: null, recipient_email: null, sent_at: null,
  confirmed_at: null, created_at: null, transaction_type: 'D', source_software: null, source_software_version: null, system_identification: 1
} as BatchHeaderRow;
const file = { fileName: '0540001133241_38_NMC1.Dat', content: '1,0540001133241\r\nZ,1,373.90\r\n', lineCount: 1, totalCents: 37390 };
const params = { practice, batch, file, recipientEmail: 'claims@fund.example', fundName: 'Namibia Medical Care', submittedBy: 'user-1' };

const opsOf = (table: string, op: string) =>
  db.state.calls.filter(call => call.table === table && call.ops.some(([name]) => name === op));

beforeEach(() => {
  db.state.calls = [];
  db.state.responses = {};
  db.state.rpcCalls = [];
  db.state.rpc = {};
  email.sendEmail.mockReset();
});

// Business rule: a batch is sent to a fund once. If it was already submitted (another user, or a
// second click), nothing is emailed and nothing is written.
describe('a batch that was already submitted', () => {
  it.each([
    { status: 'sent', sent_at: '2026-10-05T10:00:00Z' },
    { status: 'paid', sent_at: null },
    { status: 'active', sent_at: '2026-10-05T10:00:00Z' }
  ])('is not sent again ($status)', async current => {
    db.state.responses['batch_headers.select'] = { data: { id: 'b1', ...current }, error: null };
    const result = await submitBatch(params);
    expect(result.status).toBe('blocked');
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(opsOf('batch_submissions', 'insert')).toHaveLength(0);
    expect(opsOf('batch_headers', 'update')).toHaveLength(0);
  });

  it('is not sent when the batch cannot be checked', async () => {
    db.state.responses['batch_headers.select'] = { data: null, error: { message: 'network down' } };
    expect((await submitBatch(params)).status).toBe('blocked');
    expect(email.sendEmail).not.toHaveBeenCalled();
  });
});

// Business rule: every attempt is recorded in batch_submissions; only a successful email marks
// the batch as sent (with the exact file that was sent), and only if it was still unsent.
describe('sending through the email gateway', () => {
  beforeEach(() => {
    db.state.responses['batch_headers.select'] = { data: { id: 'b1', status: 'active', sent_at: null }, error: null };
  });

  it('sends the file as an attachment to the fund and records the submission', async () => {
    email.sendEmail.mockResolvedValue({ success: true, logId: 'log-1', messageId: 'msg-1', status: 'sent' });
    const result = await submitBatch(params);

    expect(result.status).toBe('sent');
    const request = email.sendEmail.mock.calls[0][0];
    expect(request.recipientEmail).toBe('claims@fund.example');
    expect(request.practiceId).toBe('p1');
    expect(request.attachments).toEqual([{ filename: file.fileName, content: toBase64(file.content), type: 'application/octet-stream' }]);

    const [insert] = opsOf('batch_submissions', 'insert');
    const row = insert.ops.find(([name]) => name === 'insert')?.[1][0] as Record<string, unknown>;
    expect(row).toMatchObject({ batch_header_id: 'b1', status: 'sent', recipient_email: 'claims@fund.example', total_claims: 1, total_amount: 373.9, email_id: 'msg-1' });

    const [update] = opsOf('batch_headers', 'update');
    expect(update.ops).toContainEqual(['is', ['sent_at', null]]);
    const values = update.ops.find(([name]) => name === 'update')?.[1][0] as Record<string, unknown>;
    expect(values).toMatchObject({ status: 'sent', recipient_email: 'claims@fund.example', generated_file_content: file.content });
  });

  it('records a failed email and leaves the batch open so it can be sent again', async () => {
    email.sendEmail.mockResolvedValue({ success: false, logId: '', status: 'failed', error: 'No active email subscription' });
    const result = await submitBatch(params);

    expect(result.status).toBe('failed');
    expect(result.message).toMatch(/No active email subscription/);
    const row = opsOf('batch_submissions', 'insert')[0].ops.find(([name]) => name === 'insert')?.[1][0] as Record<string, unknown>;
    expect(row).toMatchObject({ status: 'failed', sent_at: null });
    expect(opsOf('batch_headers', 'update')).toHaveLength(0);
  });

  it('warns not to resend when the email went out but the batch could not be marked as sent', async () => {
    email.sendEmail.mockResolvedValue({ success: true, logId: 'log-1', status: 'sent' });
    db.state.responses['batch_headers.update'] = { error: { message: 'permission denied' } };
    const result = await submitBatch(params);
    expect(result.status).toBe('sent_not_recorded');
    expect(result.message).toMatch(/Do not send it again/);
  });
});

// Business rule: a claim line without an ICD-10 code is not paid (NAMAF Circular 4 of 2025), and the database refuses to
// record a batch as sent while a line has none saved. So the file must be held back BEFORE it is emailed: emailing it and
// then failing to record it would leave a sent file on an open batch that could be sent twice.
describe('a batch with lines that have no usable main ICD-10 code saved', () => {
  beforeEach(() => {
    db.state.responses['batch_headers.select'] = { data: { id: 'b1', status: 'active', sent_at: null }, error: null };
  });

  it('is not emailed and nothing is written', async () => {
    db.state.rpc.claim_batch_icd10_gaps = { data: 3, error: null };
    const result = await submitBatch(params);

    expect(result.status).toBe('blocked');
    expect(result.message).toMatch(/3 lines have no valid main ICD-10 code saved/);
    expect(result.message).toMatch(/Save ICD-10 codes/);
    expect(db.state.rpcCalls).toEqual([['claim_batch_icd10_gaps', { p_batch_id: 'b1' }]]);
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(opsOf('batch_submissions', 'insert')).toHaveLength(0);
    expect(opsOf('batch_headers', 'update')).toHaveLength(0);
  });

  it('is told apart for a single line', async () => {
    db.state.rpc.claim_batch_icd10_gaps = { data: 1, error: null };
    expect((await submitBatch(params)).message).toMatch(/^1 line has no valid main ICD-10 code saved/);
  });

  it('is sent as before while the database update is not applied yet (the function is missing)', async () => {
    db.state.rpc.claim_batch_icd10_gaps = {
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function public.claim_batch_icd10_gaps(p_batch_id) in the schema cache' }
    };
    email.sendEmail.mockResolvedValue({ success: true, logId: 'log-1', status: 'sent' });
    expect((await submitBatch(params)).status).toBe('sent');
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('is not emailed when the check itself cannot be made', async () => {
    db.state.rpc.claim_batch_icd10_gaps = { data: null, error: { message: 'network down' } };
    const result = await submitBatch(params);

    expect(result.status).toBe('blocked');
    expect(result.message).toMatch(/Could not check the ICD-10 codes before sending/);
    expect(email.sendEmail).not.toHaveBeenCalled();
    expect(opsOf('batch_headers', 'update')).toHaveLength(0);
  });

  it('is sent when no line is missing a code', async () => {
    db.state.rpc.claim_batch_icd10_gaps = { data: 0, error: null };
    email.sendEmail.mockResolvedValue({ success: true, logId: 'log-1', status: 'sent' });
    expect((await submitBatch(params)).status).toBe('sent');
  });
});

describe('attachment encoding', () => {
  it('base64-encodes the claim file exactly, including CRLF line ends', () => {
    expect(atob(toBase64('1,054\r\nZ,1,1.00\r\n'))).toBe('1,054\r\nZ,1,1.00\r\n');
  });
});
