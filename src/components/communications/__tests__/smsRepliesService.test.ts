import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, getSession, sendSMS } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  getSession: vi.fn(),
  sendSMS: vi.fn(),
}));

// No database or SMS gateway in unit tests
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: fromMock, auth: { getSession }, channel: vi.fn(), removeChannel: vi.fn() },
}));
vi.mock('../../../services/communicationService', () => ({
  communicationService: { sendSMS },
  getCommunicationErrorMessage: (_channel: string, error?: string) =>
    error === 'SMS_LIMIT_REACHED' ? 'SMS limit reached for this billing period.' : error || 'Failed to send SMS',
}));

import {
  isMissingTableError,
  loadSmsReplies,
  loadSmsRepliesLive,
  normalizeSmsReplyRow,
  sendSmsReplyAnswer,
  setSmsReplyHandled,
  smsParts,
  type SmsReply,
} from '../smsRepliesService';

/** A PostgREST query stand-in: every filter returns itself and awaiting it gives the result. */
function query(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'limit', 'update', 'in', 'not', 'or', 'maybeSingle']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, count: null, ...result }).then(resolve, reject);
  return { builder, calls };
}

const PRACTICE_ID = 'practice-1';
const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'reply-1',
  practice_id: PRACTICE_ID,
  patient_id: 'patient-1',
  visit_id: 'visit-1',
  source_phone: '264811234567',
  message: 'Can I come at 11 instead?',
  original_message: 'Kalahari Medical: reminder for Fri 9 Oct at 10:30.',
  original_message_type: 'appointment_reminder',
  intent: 'free_text',
  rating: null,
  action_taken: 'Needs a person: the reply has no keyword the system acts on.',
  status: 'new',
  handled_by: null,
  handled_at: null,
  received_at: '2026-10-07T07:59:00.000Z',
  patient: { first_name: 'Maria', last_name: 'Shikongo' },
  handler: null,
  ...overrides,
});
const reply = normalizeSmsReplyRow(row()) as SmsReply;

beforeEach(() => {
  fromMock.mockReset();
  sendSMS.mockReset();
  getSession.mockReset();
  getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } });
});

describe('loadSmsReplies', () => {
  it('reports "not switched on" instead of an error while the database has no replies table', async () => {
    const missing = { code: 'PGRST205', message: "Could not find the table 'public.practice_sms_replies' in the schema cache" };
    fromMock.mockReturnValueOnce(query({ error: missing }).builder).mockReturnValueOnce(query({ error: missing }).builder);

    expect(await loadSmsReplies(PRACTICE_ID, 'all')).toEqual({ state: 'not_enabled' });
    expect(isMissingTableError({ code: '42P01', message: 'relation "public.practice_sms_replies" does not exist' })).toBe(true);
    expect(isMissingTableError({ code: '42501', message: 'permission denied for table practice_sms_replies' })).toBe(false);
  });

  it("loads the practice's replies waiting for staff, newest first, with the waiting count", async () => {
    const list = query({ data: [row(), row({ id: 'reply-2', received_at: '2026-10-07T06:00:00.000Z' })] });
    fromMock.mockReturnValueOnce(list.builder).mockReturnValueOnce(query({ count: 7 }).builder);

    const result = await loadSmsReplies(PRACTICE_ID, 'needs_reply');
    expect(result).toMatchObject({ state: 'ready', needsReplyCount: 7 });
    expect(list.calls).toContainEqual(['eq', ['practice_id', PRACTICE_ID]]);
    expect(list.calls).toContainEqual(['eq', ['status', 'new']]);
    expect(list.calls).toContainEqual(['order', ['received_at', { ascending: false }]]);
  });

  it('shows a real database error as an error', async () => {
    fromMock.mockReturnValueOnce(query({ error: { code: '42501', message: 'permission denied' } }).builder).mockReturnValueOnce(query({}).builder);
    expect(await loadSmsReplies(PRACTICE_ID, 'all')).toEqual({ state: 'error', message: 'permission denied' });
  });
});

describe('normalizeSmsReplyRow', () => {
  it('names the patient and says whether staff or the system handled the reply', () => {
    expect(reply).toMatchObject({ patientName: 'Maria Shikongo', status: 'new', handledAutomatically: false });
    expect(normalizeSmsReplyRow(row({ status: 'handled', handled_at: '2026-10-07T08:00:00Z' }))).toMatchObject({
      handledAutomatically: true,
    });
    expect(
      normalizeSmsReplyRow(row({ status: 'handled', handled_by: 'user-1', handler: { full_name: 'Anna Nghipandulwa' } }))
    ).toMatchObject({ handledAutomatically: false, handledByName: 'Anna Nghipandulwa' });
  });

  it('shows an intent it does not know as a plain message, and skips rows it cannot show', () => {
    expect(normalizeSmsReplyRow(row({ intent: 'something_new' }))?.intent).toBe('free_text');
    expect(normalizeSmsReplyRow(row({ id: null }))).toBeNull();
  });
});

describe('sendSmsReplyAnswer', () => {
  it('answers through the SMS gateway to the number that wrote, in international form, then marks it handled', async () => {
    sendSMS.mockResolvedValue({ success: true, logId: 'log-9', status: 'sent' });
    const update = query({ data: [{ id: 'reply-1' }] });
    fromMock.mockReturnValueOnce(update.builder);

    expect(await sendSmsReplyAnswer(reply, '  Yes, 11:00 is fine. See you Friday.  ')).toEqual({ ok: true, markedHandled: true });
    expect(sendSMS).toHaveBeenCalledWith({
      practiceId: PRACTICE_ID,
      recipientPhone: '+264811234567',
      messageContent: 'Yes, 11:00 is fine. See you Friday.',
      messageType: 'custom',
      patientId: 'patient-1',
      visitId: 'visit-1',
      metadata: { source: 'sms_replies_inbox', in_reply_to: 'reply-1' },
    });
    expect(update.calls).toContainEqual(['update', [{ status: 'handled', handled_by: 'user-1', handled_at: expect.any(String) }]]);
    expect(update.calls).toContainEqual(['eq', ['id', 'reply-1']]);
  });

  it('keeps the reply waiting and explains why when the SMS was not sent', async () => {
    sendSMS.mockResolvedValue({ success: false, logId: '', status: 'blocked', error: 'SMS_LIMIT_REACHED' });

    expect(await sendSmsReplyAnswer(reply, 'See you Friday')).toEqual({
      ok: false,
      message: 'SMS limit reached for this billing period.',
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('sends nothing for an empty answer', async () => {
    expect(await sendSmsReplyAnswer(reply, '   ')).toMatchObject({ ok: false });
    expect(sendSMS).not.toHaveBeenCalled();
  });
});

describe('setSmsReplyHandled', () => {
  it('says so when nothing was saved (another practice, or the reply is gone) instead of pretending', async () => {
    fromMock.mockReturnValueOnce(query({ data: [] }).builder);
    expect(await setSmsReplyHandled('reply-1', true)).toMatchObject({ ok: false, message: expect.stringMatching(/another practice/) });
  });

  it('clears who handled it when moving a reply back to Needs reply', async () => {
    const update = query({ data: [{ id: 'reply-1' }] });
    fromMock.mockReturnValueOnce(update.builder);
    expect(await setSmsReplyHandled('reply-1', false)).toEqual({ ok: true });
    expect(update.calls).toContainEqual(['update', [{ status: 'new', handled_by: null, handled_at: null }]]);
  });
});

describe('smsParts', () => {
  it('counts the SMS a staff answer costs (160 characters, then 153 per part)', () => {
    expect(smsParts('')).toBe(0);
    expect(smsParts('a'.repeat(160))).toBe(1);
    expect(smsParts('a'.repeat(161))).toBe(2);
    expect(smsParts('a'.repeat(306))).toBe(2);
    expect(smsParts('a'.repeat(307))).toBe(3);
  });
});

// Reminders, booking confirmations and the welcome ask for a reply only while this is true: when in doubt it is false
describe('loadSmsRepliesLive', () => {
  it("is true only once OneHealth support switched the practice's sms_replies feature on", async () => {
    const { builder, calls } = query({ data: { is_enabled: true } });
    fromMock.mockReturnValue(builder);
    expect(await loadSmsRepliesLive(PRACTICE_ID)).toBe(true);
    expect(fromMock).toHaveBeenCalledWith('practice_features');
    expect(calls).toContainEqual(['eq', ['practice_id', PRACTICE_ID]]);
    expect(calls).toContainEqual(['eq', ['feature_key', 'sms_replies']]);
  });

  it('is false without a row, when switched off, or when it cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const result of [{ data: null }, { data: { is_enabled: false } }, { error: { message: 'permission denied' } }]) {
      fromMock.mockReturnValue(query(result).builder);
      expect(await loadSmsRepliesLive(PRACTICE_ID)).toBe(false);
    }
    warn.mockRestore();
  });
});
