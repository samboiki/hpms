import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  parseProviderTime,
  parseSmsPortalReply,
  replyIdempotencyKey,
  smsLogIdFromCustomerId,
} from '../../../../supabase/functions/_shared/smsReplyPayload.ts';

const NOW = new Date('2026-10-07T08:00:00Z');
const LOG_ID = '3f1c2b9a-7d4e-4c1a-9b2f-0a1b2c3d4e5f';

/** The owner's SMSPortal Custom Body with the placeholders already substituted, as SMSPortal sends it. */
const body = (fields: Record<string, string> = {}) => {
  const v = {
    eventId: '50123',
    sourcePhoneNumber: '"264811234567"',
    destinationPhoneNumber: '"31234"',
    customerId: `"${LOG_ID}"`,
    optOutPhrase: '""',
    optOut: 'false',
    campaign: '""',
    groupData: 'null',
    incomingId: '90017',
    incomingData: '"Ja"',
    incomingUtc: '1791360000',
    sentId: '70011',
    sentData: '"Reminder: your appointment is on Fri 9 Oct at 10:30. Reply 1 to confirm, 2 to cancel."',
    sentUtc: '1791273600',
    ...fields,
  };
  return `{ "eventId": ${v.eventId}, "sourcePhoneNumber": ${v.sourcePhoneNumber}, "destinationPhoneNumber": ${v.destinationPhoneNumber}, "customerId": ${v.customerId}, "optOutPhrase": ${v.optOutPhrase}, "optOut": ${v.optOut}, "campaign": ${v.campaign}, "groupData": ${v.groupData}, "incomingId": ${v.incomingId}, "incomingData": ${v.incomingData}, "incomingUtc": ${v.incomingUtc}, "sentId": ${v.sentId}, "sentData": ${v.sentData}, "sentUtc": ${v.sentUtc} }`;
};

const parsed = (raw: string) => {
  const result = parseSmsPortalReply(raw, NOW);
  if (!result.ok) throw new Error(result.error);
  return result;
};

describe('parseSmsPortalReply', () => {
  it('reads every field of a well-formed SMSPortal reply', () => {
    const { reply, repaired } = parsed(body());
    expect(repaired).toBe(false);
    expect(reply).toMatchObject({
      eventId: '50123',
      incomingId: '90017',
      sentId: '70011',
      sourcePhone: '264811234567',
      customerId: LOG_ID,
      optOut: false,
      incomingText: 'Ja',
      incomingAt: new Date(1791360000 * 1000).toISOString(),
    });
    expect(reply.sentText).toMatch(/^Reminder/);
  });

  it('keeps every digit of large ids, so two different replies are never taken for one', () => {
    // JSON numbers lose digits above 2^53: both of these would become 9007199254740992
    const first = parsed(body({ incomingId: '9007199254740993' })).reply;
    const second = parsed(body({ incomingId: '9007199254740995' })).reply;
    expect(first.incomingId).toBe('9007199254740993');
    expect(replyIdempotencyKey(first)).not.toBe(replyIdempotencyKey(second));
  });

  it('accepts ids and flags sent as text', () => {
    const { reply } = parsed(body({ incomingId: '"90017"', eventId: '"50123"', optOut: '"true"' }));
    expect(reply.incomingId).toBe('90017');
    expect(reply.eventId).toBe('50123');
    expect(reply.optOut).toBe(true);
  });

  it('still reads a reply with a line break or quotes in it, which SMSPortal does not escape', () => {
    const { reply, repaired } = parsed(body({ incomingData: '"Yes "doctor"\nsee you then"' }));
    expect(repaired).toBe(true);
    expect(reply.incomingText).toBe('Yes "doctor"\nsee you then');
    expect(reply.incomingId).toBe('90017');
    expect(reply.customerId).toBe(LOG_ID);
  });

  it('treats empty placeholders as missing instead of losing the whole reply', () => {
    const { reply } = parsed(body({ eventId: '', groupData: '', sentId: '', sentUtc: '' }));
    expect(reply.eventId).toBeNull();
    expect(reply.sentId).toBeNull();
    expect(reply.incomingId).toBe('90017');
    expect(reply.incomingText).toBe('Ja');
  });

  it('treats placeholders SMSPortal did not fill in as missing', () => {
    expect(parsed(body({ customerId: '"@@CustomerId@@"' })).reply.customerId).toBeNull();
  });

  it('refuses a body without the patient number or that is not JSON', () => {
    expect(parseSmsPortalReply(body({ sourcePhoneNumber: '""' }), NOW).ok).toBe(false);
    expect(parseSmsPortalReply('eventId=1&incomingData=yes', NOW).ok).toBe(false);
    expect(parseSmsPortalReply('', NOW).ok).toBe(false);
  });
});

describe('parseProviderTime', () => {
  it('reads epoch seconds, epoch milliseconds and UTC text', () => {
    expect(parseProviderTime(1791360000, NOW)).toBe('2026-10-07T08:00:00.000Z');
    expect(parseProviderTime('1791360000000', NOW)).toBe('2026-10-07T08:00:00.000Z');
    expect(parseProviderTime('2026-10-07 08:00:00', NOW)).toBe('2026-10-07T08:00:00.000Z');
    expect(parseProviderTime('2026-10-07T10:00:00+02:00', NOW)).toBe('2026-10-07T08:00:00.000Z');
  });

  it('ignores ambiguous or impossible times, so the receive time is used instead', () => {
    expect(parseProviderTime('07/10/2026 07:20', NOW)).toBeNull(); // 7 October or 10 July?
    expect(parseProviderTime('2027-01-01T00:00:00Z', NOW)).toBeNull(); // in the future
    expect(parseProviderTime(0, NOW)).toBeNull();
    expect(parseProviderTime(null, NOW)).toBeNull();
  });
});

describe('replyIdempotencyKey', () => {
  it('gives a repeated delivery of the same SMS the same key, even with a new event id', () => {
    const first = parsed(body({ eventId: '50123' })).reply;
    const retry = parsed(body({ eventId: '50999' })).reply;
    expect(replyIdempotencyKey(first)).toBe('smsportal:incoming:90017');
    expect(replyIdempotencyKey(retry)).toBe(replyIdempotencyKey(first));
  });

  it('falls back to the event id, and has no key without either', () => {
    expect(replyIdempotencyKey({ incomingId: null, eventId: '50123' })).toBe('smsportal:event:50123');
    expect(replyIdempotencyKey({ incomingId: null, eventId: null })).toBeNull();
  });
});

describe('constantTimeEqual (webhook secret)', () => {
  it('accepts only the exact secret', () => {
    const secret = 'kalahari-replies-2026-secret';
    expect(constantTimeEqual(secret, secret)).toBe(true);
    expect(constantTimeEqual('kalahari-replies-2026-secreT', secret)).toBe(false);
    expect(constantTimeEqual('kalahari', secret)).toBe(false);
    expect(constantTimeEqual('', secret)).toBe(false);
    expect(constantTimeEqual(`${secret}x`, secret)).toBe(false);
  });
});

describe('smsLogIdFromCustomerId', () => {
  it('returns the message log id the gateway sent as customerId, and nothing for older references', () => {
    expect(smsLogIdFromCustomerId(LOG_ID.toUpperCase())).toBe(LOG_ID);
    expect(smsLogIdFromCustomerId('msg-1759737600000')).toBeNull();
    expect(smsLogIdFromCustomerId(null)).toBeNull();
  });
});
