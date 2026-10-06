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
