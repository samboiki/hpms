import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
// The real gateway is never called in tests
vi.mock('../communicationService', () => ({
  communicationService: { sendSMS: vi.fn() },
  getCommunicationErrorMessage: (_channel: string, error?: string) => error ?? 'Failed to send SMS'
}));

import { supabase } from '../../lib/supabase';
import {
  isListsNotEnabledError,
  patientListService,
  toListRecord,
  toSendAttempt,
  type PatientListRow
} from '../patientListService';

const listRow = (overrides: Partial<PatientListRow> = {}): PatientListRow => ({
  id: 'L1',
  practice_id: 'practice-1',
  name: 'Recall due',
  description: null,
  kind: 'smart',
  rule: { type: 'recall_due', months: 6, visitTypes: [] },
  automation: {},
  automation_enabled: false,
  last_run_on: null,
  last_run_at: null,
  last_run_summary: null,
  created_at: '2026-10-07T07:00:00Z',
  ...overrides
});

describe('isListsNotEnabledError', () => {
  it('recognises missing tables and functions, so staff see "not switched on yet" instead of an error', () => {
    expect(isListsNotEnabledError({ code: '42P01', message: 'relation "public.patient_lists" does not exist' })).toBe(true);
    expect(isListsNotEnabledError({ code: 'PGRST205', message: "Could not find the table 'public.patient_lists' in the schema cache" })).toBe(true);
    expect(isListsNotEnabledError({ code: 'PGRST202', message: 'Could not find the function public.patient_list_facts' })).toBe(true);
  });

  it('does not hide a real database error behind "not switched on"', () => {
    expect(isListsNotEnabledError({ code: '42703', message: 'column patients.foo does not exist' })).toBe(false);
    expect(isListsNotEnabledError({ code: '42883', message: 'operator does not exist: uuid = text' })).toBe(false);
    expect(isListsNotEnabledError({ code: '42P01', message: 'relation "public.invoices_enhanced" does not exist' })).toBe(false);
    expect(isListsNotEnabledError({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isListsNotEnabledError(null)).toBe(false);
  });
});

describe('toListRecord', () => {
  it('never evaluates a smart list whose stored rule is damaged: it shows why instead', () => {
    const record = toListRecord(listRow({ rule: { type: 'recall_due', months: 'six' } }));
    expect(record.rule).toBeNull();
    expect(record.ruleError).toMatch(/Months must be a whole number/);
  });

  it('starts message settings from safe defaults (nothing sent automatically)', () => {
    const record = toListRecord(listRow({ kind: 'manual', rule: null }));
    expect(record).toMatchObject({ kind: 'manual', rule: null, ruleError: null, automationEnabled: false });
    expect(record.automation.schedule).toBe('manual');
  });
});

describe('toSendAttempt', () => {
  it('treats a gateway opt-out refusal as one skipped patient, not a reason to stop the run', () => {
    expect(
      toSendAttempt({
        success: false,
        logId: '',
        status: 'failed',
        error: 'Not sent: this patient replied STOP to opt out of non-essential SMS.'
      })
    ).toMatchObject({ ok: false, optedOut: true, stopAll: false });
  });

  it('stops the run when the SMS bundle is used up, so the rest are not marked as messaged', () => {
    expect(toSendAttempt({ success: false, logId: '', status: 'blocked', error: 'SMS_LIMIT_REACHED' })).toMatchObject({
      ok: false,
      stopAll: true
    });
  });

  it('keeps going after a one-off failure for a single number', () => {
    expect(toSendAttempt({ success: false, logId: '', status: 'failed', error: 'Invalid destination' })).toMatchObject({
      ok: false,
      stopAll: false
    });
    expect(toSendAttempt({ success: true, logId: 'log-1', status: 'sent' })).toEqual({ ok: true, logId: 'log-1' });
  });
});

describe('patientListService.addPatients', () => {
  const existing = [
    { patient_id: 'p1', source: 'manual', excluded: false },
    { patient_id: 'p2', source: 'rule', excluded: true }
  ];
  let builder: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(async () => ({ data: existing, error: null })),
      upsert: vi.fn(async () => ({ error: null }))
    };
    vi.mocked(supabase.from).mockReset();
    vi.mocked(supabase.from).mockReturnValue(builder as never);
  });

  it('counts patients already on the list instead of adding them twice, and puts back someone excluded', async () => {
    const result = await patientListService.addPatients('practice-1', 'L1', ['p1', 'p2', 'p2', 'p3']);
    expect(result).toEqual({ added: 2, alreadyOnList: 1 });
    const rows = builder.upsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(rows.map((row) => [row.patient_id, row.source, row.excluded])).toEqual([
      ['p2', 'manual', false],
      ['p3', 'manual', false]
    ]);
  });

  it('keeps the send record when someone is added again, so a "once only" message is never sent twice', async () => {
    await patientListService.addPatients('practice-1', 'L1', ['p3']);
    const rows = builder.upsert.mock.calls[0][0] as Array<Record<string, unknown>>;
    expect(Object.keys(rows[0])).not.toContain('last_sent_period');
    expect(Object.keys(rows[0])).not.toContain('last_sent_at');
    expect(builder.upsert.mock.calls[0][1]).toEqual({ onConflict: 'list_id,patient_id' });
  });
});
