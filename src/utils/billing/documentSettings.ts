/**
 * The practice's own words on its documents (parity D22) and its statement default (parity D26), kept in one
 * practice_settings row ('document_settings'):
 * - a message printed on invoices, quotes and statements (each can be left out), for example "Accounts are payable
 *   within 30 days" or "We close from 20 December to 3 January";
 * - whether statements leave settled items off unless a statement run says otherwise.
 * Only practice administrators change it (the practice_settings policies); every document reads it, and a document
 * is never held up when it cannot be read (the defaults below: no message, settled items shown, as before).
 */

export const DOCUMENT_SETTINGS_KEY = 'document_settings';

/** The longest practice message: a few lines at the foot of a page */
export const DOCUMENT_MESSAGE_MAX = 300;

export type DocumentKind = 'invoice' | 'quote' | 'statement';

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = { invoice: 'Invoices', quote: 'Quotes', statement: 'Statements' };

export interface DocumentSettings {
  /** Printed on the documents ticked in printOn; empty: no message */
  message: string;
  printOn: Record<DocumentKind, boolean>;
  /** Statements leave settled items off unless a statement run chooses otherwise */
  leaveSettledOff: boolean;
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  message: '',
  printOn: { invoice: true, quote: true, statement: true },
  leaveSettledOff: false
};

/** The stored value (an object, or JSON text from older writers) made safe; anything unreadable falls back to the defaults */
export function parseDocumentSettings(value: unknown): DocumentSettings {
  let json: unknown = value;
  if (typeof value === 'string') {
    try {
      json = JSON.parse(value);
    } catch {
      json = null;
    }
  }
  const row = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
  const printOn = row.print_on && typeof row.print_on === 'object' ? (row.print_on as Record<string, unknown>) : {};
  const flag = (key: DocumentKind) => (typeof printOn[key] === 'boolean' ? (printOn[key] as boolean) : DEFAULT_DOCUMENT_SETTINGS.printOn[key]);
  return {
    message: typeof row.message === 'string' ? row.message.trim().slice(0, DOCUMENT_MESSAGE_MAX) : '',
    printOn: { invoice: flag('invoice'), quote: flag('quote'), statement: flag('statement') },
    leaveSettledOff: row.leave_settled_off === true
  };
}

export const documentSettingsJson = (settings: DocumentSettings): Record<string, unknown> => ({
  message: settings.message.trim(),
  print_on: { ...settings.printOn },
  leave_settled_off: settings.leaveSettledOff
});

export function checkDocumentSettings(settings: DocumentSettings): { ok: boolean; error: string | null } {
  const message = settings.message.trim();
  if (message.length > DOCUMENT_MESSAGE_MAX) return { ok: false, error: `Keep the message under ${DOCUMENT_MESSAGE_MAX} characters` };
  if (message && !Object.values(settings.printOn).some(Boolean)) return { ok: false, error: 'Choose at least one document to print the message on, or clear the message' };
  return { ok: true, error: null };
}

/** The message a document of this kind prints; null when there is none for it */
export function practiceMessageFor(settings: DocumentSettings | null | undefined, kind: DocumentKind): string | null {
  const message = settings?.message.trim() ?? '';
  return message && settings?.printOn[kind] ? message : null;
}
