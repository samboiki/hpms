/**
 * Glue between the patient file and ProfessionalSmsModal / ProfessionalEmailModal.
 *
 * Those modals call onSend(recipients, ...) with recipient objects and keep themselves open
 * unless the result says success. The patient file used to read the first argument as a bare
 * phone number or address, so every SMS and email sent from it failed.
 */

/** A person the modals send to: the patient, or (for SMS) their next of kin. */
export interface MessageRecipient {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  cell_number?: string | null;
  email?: string | null;
}

/** What the modals expect back from onSend. */
export interface SendOutcome {
  success: boolean;
  successCount: number;
  failureCount: number;
}

export const SEND_FAILED: SendOutcome = { success: false, successCount: 0, failureCount: 1 };
export const SENT_ONE: SendOutcome = { success: true, successCount: 1, failureCount: 0 };

/**
 * The patient file sends to one person at a time, passed as the first recipient. Returns their
 * name and the number or address to use, or null when there is nothing to send to.
 */
export function getSingleRecipient(
  recipients: readonly MessageRecipient[] | null | undefined,
  channel: 'sms' | 'email'
): { name: string; contact: string } | null {
  const recipient = recipients?.[0];
  if (!recipient) return null;
  const contact = (channel === 'sms' ? recipient.cell_number : recipient.email)?.trim();
  if (!contact) return null;
  const name = `${recipient.first_name ?? ''} ${recipient.last_name ?? ''}`.trim();
  return { name, contact };
}
