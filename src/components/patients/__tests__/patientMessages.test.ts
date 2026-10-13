import { describe, expect, it } from 'vitest';
import { mergePatientMessages, messageOutcome } from '../patientMessages';

describe('messageOutcome', () => {
  it('turns the gateways\' statuses into four plain words reception understands', () => {
    expect(messageOutcome('delivered')).toBe('delivered');
    expect(messageOutcome('opened')).toBe('delivered');
    expect(messageOutcome('sent')).toBe('sent');
    expect(messageOutcome('pending')).toBe('waiting');
    expect(messageOutcome('bounced')).toBe('failed');
    expect(messageOutcome('blocked')).toBe('failed');
  });
});

describe('mergePatientMessages', () => {
  it('lists SMS and emails together, newest first, so the file shows the last contact at a glance', () => {
    const messages = mergePatientMessages(
      [
        { id: 1, message_content: 'Reminder: appointment tomorrow at 09:00', recipient_phone: '+264810000000', status: 'delivered', created_at: '2026-10-05T08:00:00Z' },
        { id: 2, message_content: 'Your results are ready', recipient_phone: '+264810000000', status: 'failed', created_at: '2026-10-07T08:00:00Z' }
      ],
      [{ id: 9, subject: 'Your invoice', recipient_email: 'patient@example.test', status: 'sent', created_at: '2026-10-06T08:00:00Z' }],
      5
    );
    expect(messages.map(message => message.id)).toEqual(['sms-2', 'email-9', 'sms-1']);
    expect(messages[0]).toMatchObject({ channel: 'sms', outcome: 'failed', summary: 'Your results are ready' });
    expect(messages[1]).toMatchObject({ channel: 'email', summary: 'Your invoice', to: 'patient@example.test' });
  });

  it('keeps the list short: long texts are cut and only the newest few are shown', () => {
    const long = 'x'.repeat(200);
    const messages = mergePatientMessages(
      [1, 2, 3].map(id => ({ id, message_content: long, recipient_phone: '', status: 'sent', created_at: `2026-10-0${id}T08:00:00Z` })),
      [],
      2
    );
    expect(messages).toHaveLength(2);
    expect(messages[0].summary.length).toBe(90);
    expect(messages[0].summary.endsWith('...')).toBe(true);
  });
});
