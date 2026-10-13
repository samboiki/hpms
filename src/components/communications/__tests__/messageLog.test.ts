import { describe, expect, it } from 'vitest';
import { logTime, mergeLogPage, messageKindLabel, searchText, toLogEntry, type MessageLogEntry } from '../messageLog';

const entry = (key: string, at: string): MessageLogEntry => ({
  key,
  id: key,
  channel: 'sms',
  at,
  to: '081 000 0000',
  recipientName: null,
  patientId: null,
  summary: 'Reminder',
  what: 'Appointment reminder',
  outcome: 'sent',
  failureReason: null,
  invoiceId: null,
  visitId: null,
  attachments: []
});

describe('what a logged message was, in plain words', () => {
  // Staff look for "the statement we emailed", not for email_type 'invoice'
  it("names a document by the sender's own note before the gateway's type", () => {
    expect(messageKindLabel('invoice', { kind: 'statement' })).toBe('Statement');
    expect(messageKindLabel('invoice', { kind: 'payment_receipt' })).toBe('Receipt');
    expect(messageKindLabel('report', { kind: 'referral', source: 'patient_letter' })).toBe('Referral letter');
    expect(messageKindLabel('appointment_reminder', null)).toBe('Appointment reminder');
  });

  it('turns a type nobody named yet into words rather than showing a code', () => {
    expect(messageKindLabel('post_op_check', {})).toBe('Post op check');
    expect(messageKindLabel(null, null)).toBe('Message');
  });
});

describe('toLogEntry', () => {
  it('reads an email row: who it went to, the subject, the patient, the invoice and the attachment names', () => {
    const logged = toLogEntry('email', {
      id: 'e1',
      created_at: '2026-10-12T08:30:00+00:00',
      recipient_email: 'maria@example.test',
      recipient_name: 'Mrs M Testing',
      subject: 'Invoice INV-0042 from Example Family Practice',
      email_type: 'invoice',
      status: 'opened',
      patient_id: 'p1',
      invoice_id: 'inv-1',
      metadata: { kind: 'invoice', attachmentNames: ['invoice-INV-0042.pdf'] }
    });
    expect(logged).toMatchObject({
      key: 'email-e1',
      to: 'maria@example.test',
      recipientName: 'Mrs M Testing',
      what: 'Invoice',
      outcome: 'delivered',
      patientId: 'p1',
      invoiceId: 'inv-1',
      attachments: ['invoice-INV-0042.pdf']
    });
  });

  it('shows the start of a long SMS, never the whole text, in the list', () => {
    const logged = toLogEntry('sms', { id: 's1', created_at: '2026-10-12T08:30:00Z', message_content: 'x'.repeat(300), status: 'failed', failure_reason: 'Number not reachable' });
    expect(logged.summary.length).toBeLessThanOrEqual(120);
    expect(logged.outcome).toBe('failed');
    expect(logged.failureReason).toBe('Number not reachable');
  });
});

describe('mergeLogPage', () => {
  it('puts both logs together newest first and leaves out what is already on screen', () => {
    const page = mergeLogPage(
      [entry('sms-1', '2026-10-12T10:00:00Z'), entry('sms-2', '2026-10-12T08:00:00Z')],
      [{ ...entry('email-1', '2026-10-12T09:00:00Z'), channel: 'email' }],
      2,
      new Set(['sms-1'])
    );
    expect(page.entries.map(item => item.key)).toEqual(['email-1', 'sms-2']);
    expect(page.more).toBe(false);
  });

  it('says there may be more when either log filled its page', () => {
    const many = Array.from({ length: 3 }, (_, index) => entry(`sms-${index}`, `2026-10-1${index}T08:00:00Z`));
    expect(mergeLogPage(many, [], 2).more).toBe(true);
  });
});

describe('searchText', () => {
  // A comma or bracket would break the database filter; a name, number or address must still work
  it('keeps names, numbers and addresses and drops what has a meaning in a filter', () => {
    expect(searchText('  Shikongo, (Maria)  ')).toBe('Shikongo Maria');
    expect(searchText('maria@example.test')).toBe('maria@example.test');
    expect(searchText('+264 81 000')).toBe('+264 81 000');
    expect(searchText('a*b"c')).toBe('a b c');
  });
});

describe('logTime', () => {
  it('shows Windhoek time, day first, whatever the computer is set to', () => {
    expect(logTime('2026-10-12T22:30:00Z')).toBe('13 Oct 2026, 00:30');
    expect(logTime('not a date')).toBe('');
  });
});
