/**
 * The practice's message on its invoices, quotes and statements (parity D22) and its statement default for settled
 * items (parity D26): a document is never held up by them, and each prints only where the practice chose.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DOCUMENT_SETTINGS,
  DOCUMENT_MESSAGE_MAX,
  checkDocumentSettings,
  documentSettingsJson,
  parseDocumentSettings,
  practiceMessageFor
} from '../documentSettings';

describe('the practice document settings', () => {
  it('without a saved row there is no message and statements show settled items, as before', () => {
    expect(parseDocumentSettings(null)).toEqual(DEFAULT_DOCUMENT_SETTINGS);
    expect(parseDocumentSettings('not json')).toEqual(DEFAULT_DOCUMENT_SETTINGS);
    expect(practiceMessageFor(parseDocumentSettings(undefined), 'invoice')).toBeNull();
  });

  it('round-trips what an administrator saved, from the stored object or from older JSON text', () => {
    const saved = { message: 'Accounts are payable within 30 days.', printOn: { invoice: true, quote: false, statement: true }, leaveSettledOff: true };
    expect(parseDocumentSettings(documentSettingsJson(saved))).toEqual(saved);
    expect(parseDocumentSettings(JSON.stringify(documentSettingsJson(saved)))).toEqual(saved);
  });

  it('prints the message only on the documents ticked, so a statement-only reminder never lands on a quote', () => {
    const settings = parseDocumentSettings({ message: 'We close from 20 December to 3 January.', print_on: { invoice: false, quote: false, statement: true } });
    expect(practiceMessageFor(settings, 'statement')).toBe('We close from 20 December to 3 January.');
    expect(practiceMessageFor(settings, 'quote')).toBeNull();
    expect(practiceMessageFor(settings, 'invoice')).toBeNull();
  });

  it('keeps the message short enough for the foot of a page, and asks where to print one', () => {
    expect(parseDocumentSettings({ message: 'x'.repeat(DOCUMENT_MESSAGE_MAX + 50) }).message).toHaveLength(DOCUMENT_MESSAGE_MAX);
    expect(checkDocumentSettings({ ...DEFAULT_DOCUMENT_SETTINGS, message: 'x'.repeat(DOCUMENT_MESSAGE_MAX + 1) }).ok).toBe(false);
    expect(checkDocumentSettings({ ...DEFAULT_DOCUMENT_SETTINGS, message: 'Thank you', printOn: { invoice: false, quote: false, statement: false } }).error).toMatch(/at least one document/);
    expect(checkDocumentSettings({ ...DEFAULT_DOCUMENT_SETTINGS, message: '' , printOn: { invoice: false, quote: false, statement: false } }).ok).toBe(true);
  });
});
