import { describe, expect, it } from 'vitest';
import { documentEmailMessage, documentEmailSubject, documentFileName, documentRecipients, messageHtml, type DocumentEmailFacts } from '../documentEmail';

const facts = (overrides: Partial<DocumentEmailFacts> = {}): DocumentEmailFacts => ({
  kind: 'invoice',
  number: 'INV-0042',
  practiceName: 'Example Family Practice',
  practicePhone: '061 000 000',
  amount: 'N$ 450.00',
  date: null,
  ...overrides
});

describe('who a document goes to', () => {
  // Who pays gets the money documents (as Eminance sends them to the main member); staff can still pick the patient
  it('offers the account holder first when the patient is on someone else\'s account, then the patient', () => {
    expect(documentRecipients({ name: 'Kim Testing', email: 'kim@example.test' }, { name: 'Mrs M Testing', email: 'maria@example.test' })).toEqual([
      { who: 'account_holder', name: 'Mrs M Testing', email: 'maria@example.test' },
      { who: 'patient', name: 'Kim Testing', email: 'kim@example.test' }
    ]);
  });

  it('leaves out people without a usable address and offers a shared address once', () => {
    expect(documentRecipients({ name: 'Kim Testing', email: 'not an address' }, { name: 'Mrs M Testing', email: null })).toEqual([]);
    expect(documentRecipients({ name: 'Kim Testing', email: 'Family@example.test' }, { name: 'Mrs M Testing', email: 'family@example.test' })).toHaveLength(1);
  });
});

describe('the default subject and message (staff can change both)', () => {
  it('names the document, its number and the practice in the subject', () => {
    expect(documentEmailSubject(facts())).toBe('Invoice INV-0042 from Example Family Practice');
    expect(documentEmailSubject(facts({ kind: 'statement', number: null }))).toBe('Statement of account from Example Family Practice');
  });

  it('greets the recipient, says what is attached and the amount, and who to call', () => {
    expect(documentEmailMessage(facts(), 'Mrs M Testing')).toBe(
      'Dear Mrs M Testing,\n\nPlease find invoice INV-0042 for N$ 450.00 attached.\n\nIf you have any questions, please contact us on 061 000 000.\n\nKind regards,\nExample Family Practice'
    );
    expect(documentEmailMessage(facts({ kind: 'statement', number: null, date: '12 October 2026' }), null)).toContain(
      'Please find your statement of account as at 12 October 2026 attached. The balance is N$ 450.00.'
    );
    expect(documentEmailMessage(facts({ kind: 'receipt', number: 'RC-0012', amount: 'N$ 300.00' }), null)).toContain(
      'Thank you for your payment of N$ 300.00. Receipt RC-0012 is attached for your records.'
    );
    expect(documentEmailMessage(facts({ kind: 'quote', number: 'Q-0005', date: '30 November 2026' }), null)).toContain('It is valid until 30 November 2026.');
  });
});

describe('messageHtml', () => {
  it('never reads what staff typed as HTML, and keeps their paragraphs and line breaks', () => {
    expect(messageHtml('Dear <b>you</b>,\n\nLine one\nLine two')).toBe('<p>Dear &lt;b&gt;you&lt;/b&gt;,</p><p>Line one<br>Line two</p>');
  });
});

describe('documentFileName', () => {
  it('keeps letters, digits and dashes so every mail program opens the attachment', () => {
    expect(documentFileName('invoice', 'INV/0042 (copy)')).toBe('invoice-INV-0042-copy.pdf');
  });
});
