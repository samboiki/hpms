import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizePhoneNumber as appNormalize } from '../../patients/patientContact';
import { getVisitStage } from '../../../utils/visitStage';
import {
  AUTO_REPLY_MESSAGE_TYPE,
  ESSENTIAL_SMS_TYPES,
  isAutoReplyMessage,
  isEssentialSmsType,
  maySendToOptedOutPatient,
  NON_ESSENTIAL_SMS_TYPES,
  replyContextFor,
  replyInviteProblem,
  withReplyInvite,
} from '../../../../supabase/functions/_shared/smsMessagePolicy.ts';
import { normalizePhoneNumber as edgeNormalize, storedPhoneSearchPattern } from '../../../../supabase/functions/_shared/smsPhone.ts';
import { SMS_REPLY_INTENTS } from '../../../../supabase/functions/_shared/smsReplyIntent.ts';
import { smsVisitStage } from '../../../../supabase/functions/_shared/smsReplyPlan.ts';

// Edge functions cannot import from src/, so the reply webhook carries copies of two app rules.
// If a copy drifts, a reply is matched to a different patient than the app would text, or an SMS
// changes a visit the scheduler considers under way.
describe('phone rules shared with the patient screens', () => {
  it.each([
    '0811234567',
    '081 123 4567',
    '(081) 123-4567',
    '+264 (0)81 123 4567',
    '+2640811234567',
    '264811234567',
    '00264811234567',
    '811234567',
    '061 123 456',
    '+27 82 123 4567',
    '0811234567 / 0857654321',
    '061 123 456 ext 12',
    'N/A',
    '',
    '8112345678',
    '+2648112345',
    '+1234567890123456',
  ])('normalises %j exactly like the app', (raw) => {
    expect(edgeNormalize(raw)).toBe(appNormalize(raw));
  });

  it('finds the number in every format staff type it in', () => {
    const pattern = storedPhoneSearchPattern('+264811234567') ?? '';
    const like = new RegExp(`^${pattern.split('%').join('.*')}$`);
    for (const stored of ['0811234567', '081 123 4567', '+264 81 123 4567', '(081) 123-4567', '264811234567']) {
      expect(like.test(stored)).toBe(true);
    }
    expect(storedPhoneSearchPattern(null)).toBeNull();
  });
});

describe('visit stages shared with the scheduler', () => {
  it('derives the same stage as getVisitStage for every combination of status and flags', () => {
    const statuses = [null, '', 'scheduled', 'pending', 'confirmed', 'ready', 'in-progress', 'completed', 'cancelled', 'no-show'];
    const flags = [null, false, true];
    for (const status of statuses) {
      for (const is_cancelled of flags) {
        for (const is_checked_in of flags) {
          for (const is_ready of flags) {
            for (const is_handoff of flags) {
              const visit = { status, is_cancelled, is_checked_in, is_ready, is_handoff };
              expect(smsVisitStage(visit)).toBe(getVisitStage(visit));
            }
          }
        }
      }
    }
  });
});

describe('database contract', () => {
  it('lets practice_sms_replies store every intent the webhook produces (else the reply would be lost)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const sql = readFileSync(resolve(here, '../../../../proposals/2026-10-07-two-way-sms.sql'), 'utf8');
    const check = /practice_sms_replies_intent_check CHECK \(intent IN \(([^)]*)\)\)/.exec(sql);
    expect(check).not.toBeNull();
    const allowed = (check?.[1].match(/'([^']+)'/g) ?? []).map((value) => value.slice(1, -1));
    expect([...allowed].sort()).toEqual([...SMS_REPLY_INTENTS].sort());
  });
});

// A patient who replied STOP must still hear about appointments and results, and must never get
// marketing again: which types are which decides whether the gateway sends or refuses.
describe('which SMS still reach a patient who replied STOP', () => {
  it('sends appointment, results and one-to-one messages, including timing variants', () => {
    for (const type of ['appointment_reminder', 'appointment_reminder_24h', 'appointment_confirmation_sms', 'lab_results', 'custom', AUTO_REPLY_MESSAGE_TYPE]) {
      expect(maySendToOptedOutPatient(type, {})).toBe(true);
    }
  });

  it('refuses marketing, birthday, recall, campaign and automation-list messages', () => {
    for (const type of NON_ESSENTIAL_SMS_TYPES) expect(maySendToOptedOutPatient(type)).toBe(false);
  });

  it('refuses types nobody classified, and look-alikes of essential types', () => {
    expect(isEssentialSmsType('summer_special')).toBe(false);
    expect(isEssentialSmsType('custom_campaign')).toBe(false);
    expect(isEssentialSmsType(null)).toBe(false);
  });

  it('refuses a bulk send whatever type it carries: a message to many patients is a campaign', () => {
    expect(maySendToOptedOutPatient('custom', { bulkSend: true })).toBe(false);
  });

  it('keeps the two lists apart', () => {
    const essential = new Set<string>(ESSENTIAL_SMS_TYPES);
    expect(NON_ESSENTIAL_SMS_TYPES.filter((type) => essential.has(type))).toEqual([]);
  });
});

describe('what a reply refers to', () => {
  it('reads appointment reminders (and their variants), waitlist offers and feedback requests', () => {
    expect(replyContextFor({ messageType: 'appointment_reminder_2h' })).toBe('appointment');
    expect(replyContextFor({ messageType: 'appointment_confirmation' })).toBe('appointment');
    expect(replyContextFor({ messageType: 'appointment_reminder', metadata: { source: 'waitlist_notification' } })).toBe('waitlist_offer');
    expect(replyContextFor({ messageType: 'feedback_request' })).toBe('feedback');
    expect(replyContextFor({ messageType: 'marketing' })).toBe('none');
    expect(replyContextFor(null)).toBe('none');
  });

  it("recognises the webhook's own answers, by type or by metadata", () => {
    expect(isAutoReplyMessage({ messageType: AUTO_REPLY_MESSAGE_TYPE })).toBe(true);
    expect(isAutoReplyMessage({ messageType: 'custom', metadata: { auto_reply: true } })).toBe(true);
    expect(isAutoReplyMessage({ messageType: 'appointment_reminder' })).toBe(false);
  });
});

// While the reply webhook does not serve a practice, a patient who answers "2" believes the booking is cancelled and
// nobody sees it: no SMS may ask for a reply until OneHealth support switches the practice's replies on
describe('asking patients to reply', () => {
  const INVITE = 'Reply 2 to cancel, 3 for a new time.';
  const BODY = 'Eros Clinic: you are booked on Fri 9 Oct at 09:30.';

  it('adds the reply line only while replies are collected', () => {
    expect(withReplyInvite(BODY, INVITE, false)).toBe(BODY);
    expect(withReplyInvite(BODY, INVITE, true)).toBe(`${BODY} ${INVITE}`);
  });

  it('drops the line from a message saved with it (the old defaults) and never adds it twice', () => {
    expect(withReplyInvite(`${BODY} ${INVITE}`, INVITE, false)).toBe(BODY);
    expect(withReplyInvite(`${BODY} ${INVITE} `, INVITE, true)).toBe(`${BODY} ${INVITE}`);
  });

  it("keeps a practice's own reply wording once replies are collected instead of adding a second one", () => {
    expect(withReplyInvite(`${BODY} Reply YES to confirm.`, INVITE, true)).toBe(`${BODY} Reply YES to confirm.`);
  });

  it("refuses a practice's own reply request while replies are not collected, in plain words", () => {
    expect(replyInviteProblem(`${BODY} Reply YES to confirm.`, INVITE, false)).toMatch(/not collected yet/);
    expect(replyInviteProblem(`${BODY} Reply YES to confirm.`, INVITE, true)).toBeNull();
    // The old default line is taken out on sending, so it is not the practice's request
    expect(replyInviteProblem(`${BODY} ${INVITE}`, INVITE, false)).toBeNull();
  });
});
