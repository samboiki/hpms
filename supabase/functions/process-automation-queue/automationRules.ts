/**
 * Automations OneHealth sends by itself, end to end through one engine:
 *   a database trigger queues an item in automation_queue (only while the practice has the automation switched on),
 *   process-automation-queue (run by the scheduler with the service role key) claims the due items with
 *   automation_queue_claim(), sends each through centralized-sms-gateway / centralized-email-gateway (they log every
 *   message, count it against the practice's bundle and respect STOP) and records the outcome with
 *   automation_queue_finish(). The database side is proposals/2026-10-08-automations.sql.
 *
 * This file holds the rules the app (Communications > Automations) and the edge function share: which automations
 * are wired, their default messages, which {{placeholders}} each may use, how a message is checked and filled in,
 * and when nothing is sent (at night). Pure TypeScript (no Deno APIs): unit tested with Vitest.
 */
import {
  REMINDER_PLACEHOLDERS,
  REMINDER_QUIET_FROM,
  REMINDER_QUIET_UNTIL,
  REMINDER_TEMPLATE_MAX,
  SAMPLE_REMINDER_VALUES,
  clinicMinutes,
  renderReminderMessage,
  type ReminderPlaceholder,
  type ReminderValues
} from '../_shared/appointmentReminders.ts';
import { replyInviteProblem, withReplyInvite } from '../_shared/smsMessagePolicy.ts';

/**
 * The automations the sender handles. Every other automation card says where its job is done in OneHealth, or that
 * it is not offered yet. The SQL function automation_wired_ids() lists the same ids (a unit test compares them).
 */
export const WIRED_AUTOMATION_IDS = ['welcome-new-patient', 'appointment-confirmation'] as const;
export type WiredAutomationId = (typeof WIRED_AUTOMATION_IDS)[number];

export const isWiredAutomationId = (value: unknown): value is WiredAutomationId =>
  typeof value === 'string' && (WIRED_AUTOMATION_IDS as readonly string[]).includes(value);

/** Nothing is sent before 07:00 or from 20:00 (Windhoek time): the diary reminders' rule, shared. */
export function isQuietTime(now: Date): boolean {
  const minutes = clinicMinutes(now);
  return minutes < REMINDER_QUIET_UNTIL || minutes >= REMINDER_QUIET_FROM;
}

/** A welcome sent days later reads oddly, so a welcome waiting longer than this is not sent. */
export const WELCOME_MAX_AGE_HOURS = 72;

// ---------------------------------------------------------------------------------------------
// The messages
// ---------------------------------------------------------------------------------------------

export interface AutomationMessages {
  smsEnabled: boolean;
  emailEnabled: boolean;
  smsTemplate: string;
  emailSubject: string;
  /** Plain text (a few older practices saved HTML: the sender sends that as HTML) */
  emailBody: string;
}

/**
 * Each SMS's reply line, added only while the practice's replies are collected (withReplyInvite, smsMessagePolicy.ts).
 * The words are the ones the reply webhook understands (smsReplyIntent.ts): STOP opts out; on a booking message
 * 2 cancels and 3 asks for a new time.
 */
export const AUTOMATION_REPLY_INVITES: Readonly<Record<WiredAutomationId, string>> = {
  'welcome-new-patient': 'Reply STOP to opt out.',
  'appointment-confirmation': 'Reply 2 to cancel, 3 for a new time.'
};

export const DEFAULT_AUTOMATION_MESSAGES: Readonly<Record<WiredAutomationId, AutomationMessages>> = {
  'welcome-new-patient': {
    smsEnabled: true,
    emailEnabled: true,
    smsTemplate:
      '{{practiceName}}: Welcome, {{patientFirstName}}! We look forward to caring for you. Questions? Call {{practicePhone}}.',
    emailSubject: 'Welcome to {{practiceName}}',
    emailBody:
      'Dear {{patientFirstName}},\n\nWelcome to {{practiceName}}. We look forward to caring for you.\n\nIf you have any questions, call us on {{practicePhone}}.\n\nKind regards,\n{{practiceName}}'
  },
  'appointment-confirmation': {
    smsEnabled: true,
    emailEnabled: false,
    smsTemplate:
      '{{practiceName}}: Hi {{patientFirstName}}, you are booked with {{practitionerName}} on {{appointmentDate}} at {{appointmentTime}}.',
    emailSubject: 'Your appointment at {{practiceName}}',
    emailBody:
      'Dear {{patientFirstName}},\n\nYour appointment with {{practitionerName}} is on {{appointmentDate}} at {{appointmentTime}}.\n\nTo change it, call us on {{practicePhone}}.\n\nKind regards,\n{{practiceName}}'
  }
};

const placeholdersNamed = (names: readonly string[]): readonly ReminderPlaceholder[] =>
  REMINDER_PLACEHOLDERS.filter((placeholder) => names.includes(placeholder.name));

/** The {{placeholders}} each automation can fill (labels from the diary reminders, so both screens say the same). */
export const AUTOMATION_PLACEHOLDERS: Readonly<Record<WiredAutomationId, readonly ReminderPlaceholder[]>> = {
  'welcome-new-patient': placeholdersNamed(['patientFirstName', 'patientName', 'practiceName', 'practicePhone']),
  'appointment-confirmation': REMINDER_PLACEHOLDERS
};

/** A booking confirmation must say when, or the patient cannot act on it. */
export const REQUIRED_PLACEHOLDERS: Readonly<Record<WiredAutomationId, readonly string[]>> = {
  'welcome-new-patient': [],
  'appointment-confirmation': ['appointmentDate', 'appointmentTime']
};

/** Up to 3 SMS, like a reminder */
export const AUTOMATION_SMS_MAX = REMINDER_TEMPLATE_MAX;
export const AUTOMATION_SUBJECT_MAX = 150;
export const AUTOMATION_EMAIL_MAX = 5000;

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;
// Older templates call the practitioner {{doctorName}}; it is filled like {{practitionerName}}
const PLACEHOLDER_ALIASES: Readonly<Record<string, string>> = { doctorName: 'practitionerName' };

const hasPlaceholder = (template: string, name: string): boolean =>
  [...template.matchAll(PLACEHOLDER)].some((match) => (PLACEHOLDER_ALIASES[match[1]] ?? match[1]) === name);

/** Placeholders in a template this automation cannot fill ("{{portalLink}}"), each once. */
export function unknownAutomationPlaceholders(automationId: WiredAutomationId, template: string): string[] {
  const known = new Set(AUTOMATION_PLACEHOLDERS[automationId].map((placeholder) => placeholder.name));
  const unknown: string[] = [];
  for (const match of template.matchAll(PLACEHOLDER)) {
    const name = PLACEHOLDER_ALIASES[match[1]] ?? match[1];
    if (!known.has(name) && !unknown.includes(match[0])) unknown.push(match[0]);
  }
  return unknown;
}

export type AutomationMessagesCheck = { ok: true; messages: AutomationMessages } | { ok: false; errors: string[] };

/**
 * Checks the message form in plain words. The SQL save function enforces the same limits. `repliesLive`: the
 * practice's SMS replies are collected; until then the SMS may not ask patients to reply.
 */
export function checkAutomationMessages(automationId: WiredAutomationId, input: AutomationMessages, repliesLive: boolean): AutomationMessagesCheck {
  const errors: string[] = [];
  const sms = input.smsTemplate.trim();
  const subject = input.emailSubject.trim();
  const body = input.emailBody.trim();
  const required = REQUIRED_PLACEHOLDERS[automationId];
  const missingIn = (template: string) => required.filter((name) => !hasPlaceholder(template, name));
  const placeholderList = (names: readonly string[]) => names.map((name) => `{{${name}}}`).join(' and ');

  if (!input.smsEnabled && !input.emailEnabled) errors.push('Choose SMS, email or both.');

  if (input.smsEnabled) {
    if (!sms) errors.push('Write the SMS.');
    else {
      // What is sent, the reply line included while replies are collected
      if (withReplyInvite(sms, AUTOMATION_REPLY_INVITES[automationId], repliesLive).length > AUTOMATION_SMS_MAX) {
        errors.push(`Keep the SMS under ${AUTOMATION_SMS_MAX} characters (3 SMS).`);
      }
      const unknown = unknownAutomationPlaceholders(automationId, sms);
      if (unknown.length > 0) errors.push(`${unknown.join(', ')} cannot be filled in this SMS. Use the buttons below the message.`);
      const missing = missingIn(sms);
      if (missing.length > 0) errors.push(`The SMS must include ${placeholderList(missing)} so the patient knows when to come.`);
      const replyProblem = replyInviteProblem(sms, AUTOMATION_REPLY_INVITES[automationId], repliesLive);
      if (replyProblem) errors.push(replyProblem);
    }
  }

  if (input.emailEnabled) {
    if (!subject) errors.push('Write the email subject.');
    else if (subject.length > AUTOMATION_SUBJECT_MAX) errors.push(`Keep the subject under ${AUTOMATION_SUBJECT_MAX} characters.`);
    if (!body) errors.push('Write the email.');
    else if (body.length > AUTOMATION_EMAIL_MAX) errors.push(`Keep the email under ${AUTOMATION_EMAIL_MAX} characters.`);
    const unknown = unknownAutomationPlaceholders(automationId, `${subject}\n${body}`);
    if (unknown.length > 0) errors.push(`${unknown.join(', ')} cannot be filled in this email. Use the buttons below the message.`);
    const missing = body ? missingIn(body) : [];
    if (missing.length > 0) errors.push(`The email must include ${placeholderList(missing)} so the patient knows when to come.`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    messages: {
      smsEnabled: input.smsEnabled,
      emailEnabled: input.emailEnabled,
      // Saved without the reply line: OneHealth adds it while replies are collected
      smsTemplate: withReplyInvite(sms, AUTOMATION_REPLY_INVITES[automationId], false),
      emailSubject: subject,
      emailBody: body
    }
  };
}

/** Fills the placeholders of an SMS, a subject or a plain-text email (never leaves "{{...}}" behind). */
export const renderAutomationText = (template: string, values: ReminderValues): string => renderReminderMessage(template, values);

const HTML_TAG = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?>/i;

/** True for a body some practices saved as HTML in the older automation screen. */
export const looksLikeHtml = (text: string): boolean => HTML_TAG.test(text);

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** An HTML body with its placeholders filled; names are escaped, so a name can never add HTML. */
export function renderAutomationHtml(template: string, values: ReminderValues): string {
  const escaped: ReminderValues = {};
  for (const [key, value] of Object.entries(values) as Array<[keyof ReminderValues, string | null | undefined]>) {
    escaped[key] = typeof value === 'string' ? escapeHtml(value) : value;
  }
  // The fallbacks renderReminderMessage uses ("Your clinic", "us") hold no HTML characters
  return renderReminderMessage(template, escaped);
}

/** An older HTML body as plain text for the editor (paragraphs and line breaks kept, tags dropped). */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|h[1-6]|li|tr)\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------------------------
// A practice's settings (practice_automation_settings: `enabled` is the one switch)
// ---------------------------------------------------------------------------------------------

export interface AutomationSetting extends AutomationMessages {
  automationId: WiredAutomationId;
  /** practice_automation_settings.enabled. The older is_active and is_enabled columns are not read. */
  enabled: boolean;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

/**
 * The practice's settings for one automation; a missing row (or column) falls back to the defaults, switched off. A
 * saved SMS that ends in the reply line (the defaults before 2026-10-08) is read without it: OneHealth adds the line
 * only while replies are collected.
 */
export function automationSettingFromRow(automationId: WiredAutomationId, row: unknown): AutomationSetting {
  const defaults = DEFAULT_AUTOMATION_MESSAGES[automationId];
  const r = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
  return {
    automationId,
    enabled: r.enabled === true,
    smsEnabled: typeof r.sms_enabled === 'boolean' ? r.sms_enabled : defaults.smsEnabled,
    emailEnabled: typeof r.email_enabled === 'boolean' ? r.email_enabled : defaults.emailEnabled,
    smsTemplate: withReplyInvite(text(r.sms_template) ?? defaults.smsTemplate, AUTOMATION_REPLY_INVITES[automationId], false),
    emailSubject: text(r.email_subject) ?? defaults.emailSubject,
    emailBody: text(r.email_body) ?? defaults.emailBody
  };
}

/** The editor's preview uses the diary reminders' example values (invented names). */
export const SAMPLE_AUTOMATION_VALUES: ReminderValues = SAMPLE_REMINDER_VALUES;
