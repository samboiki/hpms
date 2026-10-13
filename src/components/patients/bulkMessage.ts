import { fillPlaceholders } from '../messages/messageText';

// A {{variable}} together with the spaces before it, so dropping one leaves no gap ("Hi {{x}}," -> "Hi,")
const PLACEHOLDER_WITH_LEADING_SPACE = /[ \t]*\{\{\s*\w+\s*\}\}/g;

export interface MessageRecipient {
  first_name?: string | null;
  last_name?: string | null;
}

/**
 * Personalises a message sent to many patients for one recipient. Only real values go in: the
 * patient's own name and the practice name. A variable without a real value is dropped from the
 * text, so a patient never receives a made-up name, offer, price or link. (The SMS and email
 * modals already refuse to send while anything other than the patient's name is unfilled.)
 */
export function personalizePatientMessage(
  text: string,
  recipient: MessageRecipient,
  practiceName?: string | null
): string {
  const firstName = recipient.first_name?.trim() ?? '';
  const lastName = recipient.last_name?.trim() ?? '';
  const filled = fillPlaceholders(text, {
    patientName: `${firstName} ${lastName}`.trim(),
    patientFirstName: firstName,
    patientLastName: lastName,
    practiceName: practiceName?.trim(),
  });
  return filled.replace(PLACEHOLDER_WITH_LEADING_SPACE, '');
}

/** What happened to one SMS of a message to many patients */
export type BulkSmsOutcome = 'sent' | 'opted_out' | 'limit_reached' | 'failed';

/**
 * Reads communicationService.sendSMS's result. A patient who replied STOP was skipped on purpose (the gateway refuses
 * non-essential SMS to them) and a used-up SMS bundle stops every further message: neither is a "failed" send.
 */
export function bulkSmsOutcome(result: { success?: boolean; error?: string | null }): BulkSmsOutcome {
  if (result.success) return 'sent';
  if (result.error === 'SMS_LIMIT_REACHED' || /subscription limit reached/i.test(result.error ?? '')) return 'limit_reached';
  if (/replied STOP/i.test(result.error ?? '')) return 'opted_out';
  return 'failed';
}

export interface BulkSmsCounts {
  sent: number;
  optedOut: number;
  failed: number;
  /** Patients not tried because the SMS bundle ran out */
  notTried: number;
}

/** The one line staff see after a message to many patients, and whether it is good news */
export function bulkSmsSummary(counts: BulkSmsCounts): { tone: 'success' | 'warning' | 'error'; text: string } {
  const people = (count: number) => `${count} patient${count === 1 ? '' : 's'}`;
  const were = (count: number) => (count === 1 ? 'was' : 'were');
  const parts: string[] = [];
  if (counts.sent > 0) parts.push(`SMS sent to ${people(counts.sent)}`);
  if (counts.optedOut > 0) parts.push(`${people(counts.optedOut)} replied STOP and ${were(counts.optedOut)} skipped`);
  if (counts.failed > 0) parts.push(`failed for ${people(counts.failed)}`);
  if (counts.notTried > 0) parts.push(`the SMS limit was reached, so ${people(counts.notTried)} ${were(counts.notTried)} not sent one`);
  const text = parts.length > 0 ? parts.join('; ') : 'No SMS was sent';
  const sentence = text.charAt(0).toUpperCase() + text.slice(1) + '.';
  const tone = counts.sent === 0 ? 'error' : counts.failed > 0 || counts.notTried > 0 || counts.optedOut > 0 ? 'warning' : 'success';
  return { tone, text: sentence };
}
