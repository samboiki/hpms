/**
 * The practice's saved SMS and email templates (message_templates): the ones the patient file's Message and Email
 * windows offer. Their categories in plain words, the checks before saving, and who may change them (the same rule
 * as the table's policy).
 */
import { getSmsLength } from '../../components/messages/messageText';
import { singleBraceSlips, unknownFields } from './mergeFields';

export type MessageChannel = 'sms' | 'email' | 'both';
export type MessageCategory = 'appointment' | 'billing' | 'health' | 'engagement' | 'marketing' | 'custom';

/** The categories message_templates allows, in plain words */
export const MESSAGE_CATEGORIES: ReadonlyArray<{ value: MessageCategory; label: string }> = [
  { value: 'appointment', label: 'Appointments' },
  { value: 'billing', label: 'Accounts and payments' },
  { value: 'health', label: 'Health and care' },
  { value: 'engagement', label: 'Keeping in touch' },
  { value: 'marketing', label: 'News and offers' },
  { value: 'custom', label: 'Other' }
];

export const CHANNEL_LABELS: Readonly<Record<MessageChannel, string>> = { sms: 'SMS', email: 'Email', both: 'SMS and email' };

export const categoryLabel = (category: string | null | undefined): string =>
  MESSAGE_CATEGORIES.find(option => option.value === category)?.label ?? 'Other';

export const isMessageCategory = (value: unknown): value is MessageCategory => MESSAGE_CATEGORIES.some(option => option.value === value);

export interface MessageTemplateDraft {
  name: string;
  channel: MessageChannel;
  category: MessageCategory;
  /** Emails only */
  subject: string;
  body: string;
}

export interface MessageTemplate extends MessageTemplateDraft {
  id: string;
  updatedAt: string | null;
}

/** Up to 4 SMS parts: a longer message costs more than most practices expect */
export const SMS_TEMPLATE_MAX_PARTS = 4;
export const EMAIL_SUBJECT_MAX = 150;
export const EMAIL_BODY_MAX = 5000;

export function checkMessageTemplate(draft: MessageTemplateDraft): string[] {
  const problems: string[] = [];
  const name = draft.name.trim();
  if (name.length < 1 || name.length > 80) problems.push('Give the template a name (up to 80 characters).');
  const body = draft.body.trim();
  if (!body) problems.push('Write the message.');
  if (draft.channel !== 'email' && getSmsLength(body).parts > SMS_TEMPLATE_MAX_PARTS) {
    problems.push(`An SMS template can be up to ${SMS_TEMPLATE_MAX_PARTS} SMS long. Shorten the message.`);
  }
  if (draft.channel !== 'sms') {
    const subject = draft.subject.trim();
    if (!subject) problems.push('Give the email a subject.');
    if (subject.length > EMAIL_SUBJECT_MAX) problems.push(`Keep the subject to ${EMAIL_SUBJECT_MAX} characters.`);
    if (body.length > EMAIL_BODY_MAX) problems.push(`Keep the email to ${EMAIL_BODY_MAX.toLocaleString('en-ZA')} characters.`);
  }
  const text = `${draft.channel === 'sms' ? '' : draft.subject}\n${draft.body}`;
  for (const field of unknownFields(text, 'message')) problems.push(`{{${field}}} is not a field a message can fill. Pick fields from the list.`);
  for (const slip of singleBraceSlips(text)) problems.push(`${slip} needs two braces on each side, like {{patientName}}.`);
  return problems;
}

/** Roles message_templates' policy lets change templates ("Admin users can manage templates"). */
const MESSAGE_TEMPLATE_ROLES = ['admin', 'super_admin', 'doctor', 'receptionist'];

export const canChangeMessageTemplates = (user: { role?: string | null } | null | undefined): boolean =>
  !!user?.role && MESSAGE_TEMPLATE_ROLES.includes(user.role);

/** Examples a practice starts from (nothing is saved until someone saves it). */
export const MESSAGE_TEMPLATE_EXAMPLES: readonly MessageTemplateDraft[] = [
  {
    name: 'Appointment reminder',
    channel: 'sms',
    category: 'appointment',
    subject: '',
    body: '{{practiceName}}: Hi {{patientFirstName}}, a reminder of your appointment on {{appointmentDate}} at {{appointmentTime}}. Call {{practicePhone}} to change it.'
  },
  {
    name: 'Results ready',
    channel: 'sms',
    category: 'health',
    subject: '',
    body: '{{practiceName}}: Hi {{patientFirstName}}, your results are ready. Please call {{practicePhone}} to discuss them with us.'
  },
  {
    name: 'Account reminder',
    channel: 'email',
    category: 'billing',
    subject: 'Your account at {{practiceName}}',
    body:
      'Dear {{patientFormalName}},\n\nOur records show an amount still open on your account. Please contact us on {{practicePhone}} or {{practiceEmail}} if you have any questions.\n\nKind regards,\n{{practiceName}}'
  }
];
