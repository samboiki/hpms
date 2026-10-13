import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { withReplyInvite } from '../../_shared/smsMessagePolicy';
import {
  AUTOMATION_REPLY_INVITES,
  AUTOMATION_SMS_MAX,
  DEFAULT_AUTOMATION_MESSAGES,
  SAMPLE_AUTOMATION_VALUES,
  WIRED_AUTOMATION_IDS,
  automationSettingFromRow,
  checkAutomationMessages,
  htmlToPlainText,
  isQuietTime,
  renderAutomationHtml,
  renderAutomationText,
  unknownAutomationPlaceholders
} from '../automationRules';

// Windhoek is UTC+2 all year: 05:00Z is 07:00 at the practice
const at = (utc: string) => new Date(`2026-10-08T${utc}Z`);

describe('one list of automations the sender handles', () => {
  // The database queues and claims only these; if the two lists drift, a card could look switched on while the
  // sender ignores its items (or the sender could pick up items no card controls)
  it('the SQL proposal lists the same automations as the app and the sender', () => {
    const sql = readFileSync('proposals/2026-10-08-automations.sql', 'utf8');
    const body = /FUNCTION public\.automation_wired_ids\(\)[\s\S]*?ARRAY\[([^\]]*)\]/.exec(sql);
    expect(body).not.toBeNull();
    const ids = [...(body?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
    expect(ids).toEqual([...WIRED_AUTOMATION_IDS]);
  });
});

describe('never at night', () => {
  // Patients must not be woken by an automatic SMS: the same 07:00-20:00 window as the diary reminders
  it('sends from 07:00 until 19:59 Windhoek time only', () => {
    expect(isQuietTime(at('04:59:00'))).toBe(true); // 06:59
    expect(isQuietTime(at('05:00:00'))).toBe(false); // 07:00
    expect(isQuietTime(at('17:59:00'))).toBe(false); // 19:59
    expect(isQuietTime(at('18:00:00'))).toBe(true); // 20:00
    expect(isQuietTime(at('23:30:00'))).toBe(true); // 01:30
  });
});

describe('the default messages', () => {
  // A practice that only flips the switch must send something sensible: never "{{...}}", and a confirmation
  // always says when to come
  it('pass the same checks staff edits must pass', () => {
    for (const id of WIRED_AUTOMATION_IDS) {
      expect(checkAutomationMessages(id, DEFAULT_AUTOMATION_MESSAGES[id], false).ok).toBe(true);
    }
  });

  // Each SMS part costs the practice from its bundle: the defaults stay one SMS with ordinary names, reply line included
  it('fit one SMS with typical names', () => {
    for (const id of WIRED_AUTOMATION_IDS) {
      const template = withReplyInvite(DEFAULT_AUTOMATION_MESSAGES[id].smsTemplate, AUTOMATION_REPLY_INVITES[id], true);
      const sms = renderAutomationText(template, { ...SAMPLE_AUTOMATION_VALUES, practiceName: 'Eros Family Clinic' });
      expect(sms).not.toContain('{{');
      expect(sms.length).toBeLessThanOrEqual(160);
    }
  });

  // The welcome said "Reply STOP" and the confirmation "Reply 2 to cancel" while no reply reached anyone: until the
  // practice's replies are collected neither may ask for one
  it('ask for no reply on their own: the reply line is added only while replies are collected', () => {
    for (const id of WIRED_AUTOMATION_IDS) expect(DEFAULT_AUTOMATION_MESSAGES[id].smsTemplate).not.toMatch(/reply/i);
  });
});

describe('messages saved with the old reply lines', () => {
  // Two practices saved the old welcome ending "Reply STOP to opt out.": it must not reach patients while STOP replies
  // are not collected, and must not be doubled once they are
  it('are read without the reply line, which the sender adds back only while replies are collected', () => {
    const saved = `${DEFAULT_AUTOMATION_MESSAGES['welcome-new-patient'].smsTemplate} ${AUTOMATION_REPLY_INVITES['welcome-new-patient']}`;
    const setting = automationSettingFromRow('welcome-new-patient', { enabled: true, sms_template: saved });
    expect(setting.smsTemplate).toBe(DEFAULT_AUTOMATION_MESSAGES['welcome-new-patient'].smsTemplate);
    expect(checkAutomationMessages('welcome-new-patient', setting, false).ok).toBe(true);
  });

  it("refuse a practice's own reply request while replies are not collected", () => {
    const confirmation = DEFAULT_AUTOMATION_MESSAGES['appointment-confirmation'];
    const asking = { ...confirmation, smsTemplate: `${confirmation.smsTemplate} Reply NO to cancel.` };
    const refused = checkAutomationMessages('appointment-confirmation', asking, false);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.errors.join(' ')).toMatch(/replies are not collected yet/);
    expect(checkAutomationMessages('appointment-confirmation', asking, true).ok).toBe(true);
  });
});

describe('checking a message staff wrote', () => {
  const confirmation = DEFAULT_AUTOMATION_MESSAGES['appointment-confirmation'];

  it('refuses a confirmation that does not say when', () => {
    const check = checkAutomationMessages('appointment-confirmation', { ...confirmation, smsTemplate: 'Hi {{patientFirstName}}, you are booked.' }, false);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.errors.join(' ')).toContain('{{appointmentDate}} and {{appointmentTime}}');
  });

  // The old screen offered {{portalLink}} and {{confirmationCode}}, which nothing can fill: patients would get gaps
  it('refuses placeholders the automation cannot fill', () => {
    expect(unknownAutomationPlaceholders('welcome-new-patient', 'Visit {{portalLink}} or call {{practicePhone}}')).toEqual(['{{portalLink}}']);
    const check = checkAutomationMessages('welcome-new-patient', {
      ...DEFAULT_AUTOMATION_MESSAGES['welcome-new-patient'],
      emailBody: 'Your code is {{confirmationCode}}'
    }, false);
    expect(check.ok).toBe(false);
  });

  it('accepts {{doctorName}} from older templates as the practitioner', () => {
    expect(unknownAutomationPlaceholders('appointment-confirmation', 'With {{doctorName}} on {{appointmentDate}}')).toEqual([]);
  });

  it('needs at least one way to reach the patient, and an SMS of at most 3 parts', () => {
    expect(checkAutomationMessages('welcome-new-patient', { ...DEFAULT_AUTOMATION_MESSAGES['welcome-new-patient'], smsEnabled: false, emailEnabled: false }, false).ok).toBe(false);
    const long = 'x'.repeat(AUTOMATION_SMS_MAX + 1);
    expect(checkAutomationMessages('welcome-new-patient', { ...DEFAULT_AUTOMATION_MESSAGES['welcome-new-patient'], smsTemplate: long }, false).ok).toBe(false);
  });
});

describe('older HTML emails', () => {
  // Two practices saved HTML welcome emails in the old screen. A name must never be able to change that HTML
  it('escapes the values filled into an HTML body', () => {
    const html = renderAutomationHtml('<p>Welcome {{patientName}}</p>', { patientName: 'Ana <b>Kaura</b>' });
    expect(html).toBe('<p>Welcome Ana &lt;b&gt;Kaura&lt;/b&gt;</p>');
  });

  it('show as readable text in the editor', () => {
    expect(htmlToPlainText('<h2>Welcome {{patientName}}!</h2><p>Thank you for choosing us.</p><p>Best regards,<br>The team</p>')).toBe(
      'Welcome {{patientName}}!\n\nThank you for choosing us.\n\nBest regards,\nThe team'
    );
  });
});

describe('a practice settings row', () => {
  // `enabled` is the one switch: the old screen also wrote is_active and is_enabled, and the old triggers each read a
  // different one, so a card could look off while items were still queued
  it('reads only `enabled` as the switch', () => {
    expect(automationSettingFromRow('welcome-new-patient', { enabled: false, is_active: true, is_enabled: true }).enabled).toBe(false);
    expect(automationSettingFromRow('welcome-new-patient', { enabled: true, is_active: false }).enabled).toBe(true);
  });

  it('is off with the default messages when the practice never saved one', () => {
    const setting = automationSettingFromRow('appointment-confirmation', null);
    expect(setting.enabled).toBe(false);
    expect(setting.smsTemplate).toBe(DEFAULT_AUTOMATION_MESSAGES['appointment-confirmation'].smsTemplate);
  });
});
