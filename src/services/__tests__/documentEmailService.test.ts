/**
 * Emailing a document goes through the centralized email gateway only (never sent for real in tests): the PDF is
 * attached, the patient is named so the email is kept with their messages, and an address on file is offered first.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: supabaseMock }));
const comms = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock('../communicationService', () => ({
  communicationService: comms,
  getCommunicationErrorMessage: (_channel: string, error?: string) => `Not sent: ${error ?? 'unknown'}`
}));

import { emailDocument, loadDocumentRecipients } from '../documentEmailService';

/** A thenable query that resolves to `result` whatever filters are chained */
const query = (result: unknown) => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'is', 'limit', 'order']) chain[name] = vi.fn(() => chain);
  chain.maybeSingle = async () => result;
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
  return chain;
};

afterEach(() => {
  supabaseMock.from.mockReset();
  comms.sendEmail.mockReset();
});

const request = {
  practiceId: 'practice-1',
  patientId: 'patient-1',
  kind: 'invoice' as const,
  to: ' maria@example.test ',
  recipientName: 'Mrs M Testing',
  subject: 'Invoice INV-0042 from Example Family Practice',
  message: 'Dear Mrs M Testing,\n\nPlease find invoice INV-0042 attached.',
  attachment: { fileName: 'invoice-INV-0042.pdf', base64: 'JVBERi0xLjM=' },
  emailType: 'invoice' as const,
  invoiceId: 'invoice-1'
};

describe('emailDocument', () => {
  it('sends the PDF as an attachment through the gateway, logged with the patient and the invoice', async () => {
    comms.sendEmail.mockResolvedValue({ success: true, logId: 'log-1', status: 'sent' });
    const result = await emailDocument(request);
    expect(result).toEqual({ ok: true, message: 'Emailed to maria@example.test.' });
    expect(comms.sendEmail).toHaveBeenCalledTimes(1);
    const sent = comms.sendEmail.mock.calls[0][0];
    expect(sent).toMatchObject({
      practiceId: 'practice-1',
      recipientEmail: 'maria@example.test',
      patientId: 'patient-1',
      invoiceId: 'invoice-1',
      emailType: 'invoice',
      subject: 'Invoice INV-0042 from Example Family Practice',
      textContent: request.message,
      attachments: [{ filename: 'invoice-INV-0042.pdf', content: 'JVBERi0xLjM=', type: 'application/pdf' }]
    });
    // The message log shows what went and with which file
    expect(sent.metadata).toMatchObject({ kind: 'invoice', source: 'document_email', attachmentNames: ['invoice-INV-0042.pdf'] });
    expect(sent.htmlContent).toBe('<p>Dear Mrs M Testing,</p><p>Please find invoice INV-0042 attached.</p>');
  });

  it('sends nothing to an incomplete address or without a message', async () => {
    expect(await emailDocument({ ...request, to: 'maria@' })).toEqual({ ok: false, message: 'Enter a complete email address.' });
    expect(await emailDocument({ ...request, message: '  ' })).toEqual({ ok: false, message: 'Write a short message to go with the document.' });
    expect(comms.sendEmail).not.toHaveBeenCalled();
  });

  it("passes on the gateway's refusal in plain words (for example a used-up email bundle)", async () => {
    comms.sendEmail.mockResolvedValue({ success: false, logId: '', status: 'failed', error: 'limit' });
    expect(await emailDocument(request)).toEqual({ ok: false, message: 'Not sent: limit' });
  });
});

describe('loadDocumentRecipients', () => {
  it("offers the account holder's address first when the patient is on their account", async () => {
    // The first patients read is the patient, the second the account holder
    let patientsRead = 0;
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'account_holder_links') return query({ data: [{ holder_patient_id: 'holder-1' }], error: null });
      patientsRead += 1;
      return patientsRead === 1
        ? query({ data: { first_name: 'Kim', last_name: 'Testing', title: null, initials: null, email: 'kim@example.test' }, error: null })
        : query({ data: { first_name: 'Maria', last_name: 'Testing', title: 'Mrs', initials: 'M', email: 'maria@example.test' }, error: null });
    });
    expect(await loadDocumentRecipients('practice-1', 'patient-1')).toEqual([
      { who: 'account_holder', name: 'Mrs M Testing', email: 'maria@example.test' },
      { who: 'patient', name: 'Kim Testing', email: 'kim@example.test' }
    ]);
  });

  it('offers the patient alone before family accounts are set up', async () => {
    supabaseMock.from.mockImplementation((table: string) =>
      table === 'account_holder_links'
        ? query({ data: null, error: { code: '42P01', message: 'relation "account_holder_links" does not exist' } })
        : query({ data: { first_name: 'Kim', last_name: 'Testing', title: null, initials: null, email: 'kim@example.test' }, error: null })
    );
    expect(await loadDocumentRecipients('practice-1', 'patient-1')).toEqual([{ who: 'patient', name: 'Kim Testing', email: 'kim@example.test' }]);
  });
});
