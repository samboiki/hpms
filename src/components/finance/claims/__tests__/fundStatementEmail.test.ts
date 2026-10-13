/**
 * The statement of outstanding claims emailed to the fund (parity F22): to the fund's claims address from the fund
 * master, as a PDF, through the centralized email gateway. Nothing is ever sent from these tests: the gateway is a mock.
 * Invented funds, patients and figures.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const gateway = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock('../../../../services/communicationService', () => ({
  communicationService: gateway,
  getCommunicationErrorMessage: (_channel: string, error?: string) => `Not sent: ${error ?? 'unknown'}`
}));

import { emailFundStatement, fundRecipients, fundStatementMessage } from '../fundStatementEmail';
import { fundStatementPdfModel } from '../fundStatementPdf';
import type { FundStatement } from '../fundStatement';
import type { FundProvider, PracticeInfo } from '../types';

const statement: FundStatement = {
  fund: 'Example Health Fund',
  fundCodes: ['EXH1'],
  batches: [
    {
      batchId: 'b1', batchNumber: 7, fundCode: 'EXH1', sentOn: '2026-08-01', daysSinceSent: 73, readable: true, owedCents: 150_000,
      lines: [
        { invoiceId: 'i1', invoiceNumber: 'INV-0101', patientId: 'p1', patientName: 'Pat Testing', serviceDate: '2026-07-28', owedCents: 100_000, ageDays: 77, ageBand: 'days_60' },
        { invoiceId: 'i2', invoiceNumber: 'INV-0102', patientId: 'p2', patientName: 'Sam Testing', serviceDate: '2026-07-29', owedCents: 50_000, ageDays: 76, ageBand: 'days_60' }
      ]
    }
  ],
  claimCount: 2,
  owedCents: 150_000,
  byAgeBand: { current: 0, days_30: 0, days_60: 150_000, days_90: 0, days_120: 0, days_150: 0, days_180_plus: 0 },
  oldestAgeDays: 77
};

const fund = (overrides: Partial<FundProvider>): FundProvider => ({
  id: 'f1', name: 'Example Health Fund', short_name: 'Example Health', email: 'claims@example-fund.test', medical_aid_reference: 'EXH1', logo_url: null, theme_color: null,
  ...overrides
});

const practice: PracticeInfo = { id: 'practice-1', name: 'Invented Dental', practice_number: '0540001', practice_type: 'dental', contact_email: 'accounts@invented-dental.test' };

describe('who the statement goes to', () => {
  it("uses the claims address of the fund code the batches were sent under, from the fund master", () => {
    expect(fundRecipients(statement, [fund({}), fund({ id: 'f2', medical_aid_reference: 'OTH1', email: 'other@fund.test' })])).toEqual([
      { email: 'claims@example-fund.test', label: 'Example Health (EXH1)', reference: 'EXH1' }
    ]);
  });

  it("falls back to the fund's name when no code matches, and offers nothing without a usable address", () => {
    expect(fundRecipients({ ...statement, fundCodes: [] }, [fund({ medical_aid_reference: 'ZZZ1' })]).map(item => item.email)).toEqual(['claims@example-fund.test']);
    expect(fundRecipients(statement, [fund({ email: null })])).toEqual([]);
    expect(fundRecipients(statement, [fund({ email: 'not an address' })])).toEqual([]);
  });
});

describe('what the fund receives', () => {
  it('says how many claims, how much and how old, and who to answer', () => {
    const message = fundStatementMessage(statement, '2026-10-13', practice);
    expect(message.subject).toBe('Outstanding claims as at 13 Oct 2026 - Invented Dental (practice 0540001)');
    expect(message.text).toContain('2 claim(s) sent to you that are not paid yet, N$ 1,500.00 in all, the oldest 77 days');
    expect(message.text).toContain('Replies to accounts@invented-dental.test');
    expect(message.html).not.toContain('<script');
  });

  it('puts the same figures in the PDF as on the printed statement, a batch heading before its claims', () => {
    const model = fundStatementPdfModel(statement, '2026-10-13', {
      id: 'practice-1', name: 'Invented Dental', contactPhone: null, contactEmail: null, address: null, city: null, country: null, postalCode: null,
      practiceNumber: '0540001', licenseNumber: null, taxNumber: null, primaryColor: null
    } as Parameters<typeof fundStatementPdfModel>[2]);
    const claims = model.tables[1];
    expect(claims.rows[0][0]).toMatch(/^Batch 7 \(EXH1\), sent 1 Aug 2026/);
    expect(claims.rows.slice(1).map(row => row[1])).toEqual(['INV-0101', 'INV-0102']);
    expect(model.totals[0].value).toBe('N$ 1,500.00');
    expect(model.fileName).toBe('outstanding-claims-Example-Health-Fund-2026-10-13.pdf');
  });
});

describe('emailFundStatement', () => {
  beforeEach(() => gateway.sendEmail.mockReset());

  it('sends the PDF through the gateway as a report, logging codes and counts but no patient names', async () => {
    gateway.sendEmail.mockResolvedValue({ success: true, logId: 'log-1', status: 'sent' });
    const recipient = fundRecipients(statement, [fund({})])[0];
    const result = await emailFundStatement({
      practice,
      statement,
      recipient,
      message: fundStatementMessage(statement, '2026-10-13', practice),
      attachment: { fileName: 'outstanding-claims.pdf', base64: 'JVBERi0=' }
    });
    expect(result.ok).toBe(true);
    const request = gateway.sendEmail.mock.calls[0][0];
    expect(request).toMatchObject({ practiceId: 'practice-1', recipientEmail: 'claims@example-fund.test', emailType: 'report' });
    expect(request.attachments).toEqual([{ filename: 'outstanding-claims.pdf', content: 'JVBERi0=', type: 'application/pdf' }]);
    expect(JSON.stringify(request.metadata)).not.toContain('Testing');
    expect(request.metadata).toMatchObject({ kind: 'fund_statement', fundCodes: ['EXH1'], claimCount: 2, owedCents: 150_000 });
  });

  it("says plainly when the gateway did not send it, so staff can try again", async () => {
    gateway.sendEmail.mockResolvedValue({ success: false, logId: '', status: 'failed', error: 'limit reached' });
    const result = await emailFundStatement({
      practice, statement, recipient: fundRecipients(statement, [fund({})])[0], message: fundStatementMessage(statement, '2026-10-13', practice),
      attachment: { fileName: 'x.pdf', base64: 'JVBERi0=' }
    });
    expect(result).toEqual({ ok: false, message: 'Not sent: limit reached' });
  });
});
