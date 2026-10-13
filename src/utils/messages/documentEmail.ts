/**
 * Emailing a document (invoice, statement, quote, receipt) as a PDF: who it goes to by default, and the subject and
 * message staff can change before it is sent. Pure: the screens send through the centralized email gateway
 * (services/documentEmailService.ts), which logs it on the patient's file.
 *
 * Who pays gets money documents: a patient on someone's account (a child, a spouse) has their documents sent to the
 * account holder, as Eminance sends them to the main member, unless staff pick the patient instead.
 */

export type DocumentKind = 'invoice' | 'statement' | 'quote' | 'receipt';

export const DOCUMENT_NAMES: Readonly<Record<DocumentKind, string>> = {
  invoice: 'Invoice',
  statement: 'Statement of account',
  quote: 'Quote',
  receipt: 'Receipt'
};

export interface DocumentEmailFacts {
  kind: DocumentKind;
  /** "INV-0042"; a statement has none */
  number: string | null;
  practiceName: string;
  practicePhone: string | null;
  /** The amount the document is about, formatted ("N$ 450.00"): the invoice total, the balance, the payment */
  amount: string | null;
  /** A statement's "as at" date, a quote's "valid until" date ("12 October 2026") */
  date: string | null;
}

const NUMBERED: Readonly<Record<DocumentKind, string>> = { invoice: 'Invoice', statement: 'Statement', quote: 'Quote', receipt: 'Receipt' };

/** "Invoice INV-0042 from Example Family Practice" */
export function documentEmailSubject(facts: DocumentEmailFacts): string {
  const what = facts.number ? `${NUMBERED[facts.kind]} ${facts.number}` : DOCUMENT_NAMES[facts.kind];
  return `${what} from ${facts.practiceName}`;
}

/** The message under the greeting: what is attached, the amount, and who to ask. Staff can change all of it. */
export function documentEmailMessage(facts: DocumentEmailFacts, recipientName: string | null): string {
  const number = facts.number ? ` ${facts.number}` : '';
  const amount = facts.amount;
  const lines: Record<DocumentKind, string> = {
    invoice: `Please find invoice${number}${amount ? ` for ${amount}` : ''} attached.`,
    statement: `Please find your statement of account${facts.date ? ` as at ${facts.date}` : ''} attached.${amount ? ` The balance is ${amount}.` : ''}`,
    quote: `Please find quote${number}${amount ? ` for ${amount}` : ''} attached.${facts.date ? ` It is valid until ${facts.date}.` : ''}`,
    receipt: `Thank you for your payment${amount ? ` of ${amount}` : ''}. Receipt${number} is attached for your records.`
  };
  const contact = facts.practicePhone ? `please contact us on ${facts.practicePhone}` : 'please contact us';
  return [
    recipientName ? `Dear ${recipientName},` : 'Good day,',
    lines[facts.kind],
    `If you have any questions, ${contact}.`,
    `Kind regards,\n${facts.practiceName}`
  ].join('\n\n');
}

export interface DocumentRecipient {
  /** Whose address it is */
  who: 'account_holder' | 'patient';
  name: string;
  email: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmailAddress = (value: string): boolean => EMAIL.test(value.trim());

/**
 * The addresses a document can go to, the default first: the account holder (who pays) when the patient is on
 * someone's account, then the patient. Without an address a person is left out; one address is offered once.
 */
export function documentRecipients(
  patient: { name: string; email: string | null } | null,
  accountHolder: { name: string; email: string | null } | null
): DocumentRecipient[] {
  const options: DocumentRecipient[] = [];
  const add = (who: DocumentRecipient['who'], person: { name: string; email: string | null } | null) => {
    const email = person?.email?.trim() ?? '';
    if (!person || !isEmailAddress(email)) return;
    if (options.some(option => option.email.toLowerCase() === email.toLowerCase())) return;
    options.push({ who, name: person.name, email });
  };
  add('account_holder', accountHolder);
  add('patient', patient);
  return options;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The message as simple HTML: a paragraph per blank line, line breaks kept, nothing staff typed is read as HTML. */
export function messageHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map(paragraph => paragraph.trim())
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** "invoice-INV-0042.pdf": letters, digits and dashes only */
export function documentFileName(kind: DocumentKind, label: string): string {
  const safe = label.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `${kind}${safe ? `-${safe}` : ''}.pdf`;
}
