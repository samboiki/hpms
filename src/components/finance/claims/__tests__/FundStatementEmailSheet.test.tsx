/**
 * "Email to the fund" on the statement of outstanding claims (parity F22): staff see the fund's claims address from the
 * fund master, the message and the PDF's name, and nothing goes out until they confirm. The email gateway is a mock:
 * no test ever sends anything. Invented fund, practice and figures.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));
const gateway = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock('../../../../services/communicationService', () => ({
  communicationService: gateway,
  getCommunicationErrorMessage: (_channel: string, error?: string) => `Not sent: ${error ?? 'unknown'}`
}));
const claims = vi.hoisted(() => ({ loadFunds: vi.fn() }));
vi.mock('../claimsService', () => claims);
vi.mock('../../../quotes/quoteService', () => ({
  loadLetterhead: vi.fn(async () => ({
    id: 'practice-1', name: 'Invented Dental', contactPhone: null, contactEmail: null, address: null, city: null, country: null, postalCode: null,
    practiceNumber: '0540001', licenseNumber: null, taxNumber: null, primaryColor: null
  }))
}));
// The PDF itself is drawn by documentPdf.ts (tested with the statements); here only that it is attached
vi.mock('../../receipts/documentPdf', () => ({ renderFinanceDocumentPdf: vi.fn(() => ({})), pdfBase64: vi.fn(() => 'JVBERi0=') }));

import FundStatementEmailSheet from '../FundStatementEmailSheet';
import type { FundStatement } from '../fundStatement';

const statement: FundStatement = {
  fund: 'Example Health Fund',
  fundCodes: ['EXH1'],
  batches: [],
  claimCount: 2,
  owedCents: 150_000,
  byAgeBand: { current: 0, days_30: 0, days_60: 150_000, days_90: 0, days_120: 0, days_150: 0, days_180_plus: 0 },
  oldestAgeDays: 77
};
const practice = { id: 'practice-1', name: 'Invented Dental', practice_number: '0540001', practice_type: 'dental', contact_email: null };
const fund = { id: 'f1', name: 'Example Health Fund', short_name: 'Example Health', email: 'claims@example-fund.test', medical_aid_reference: 'EXH1', logo_url: null, theme_color: null };

beforeEach(() => {
  gateway.sendEmail.mockReset();
  claims.loadFunds.mockResolvedValue([fund]);
});

describe('FundStatementEmailSheet', () => {
  it('sends nothing until staff confirm, then the PDF once to the claims address', async () => {
    gateway.sendEmail.mockResolvedValue({ success: true, logId: 'log-1', status: 'sent' });
    render(<FundStatementEmailSheet practice={practice} statement={statement} asOfKey="2026-10-13" onClose={vi.fn()} />);
    expect(await screen.findByText('Example Health (EXH1): claims@example-fund.test')).toBeInTheDocument();
    expect(screen.getByText('outstanding-claims-Example-Health-Fund-2026-10-13.pdf')).toBeInTheDocument();
    const send = screen.getByRole('button', { name: /Send to the fund/ });
    expect(send).toBeDisabled();
    fireEvent.click(send);
    expect(gateway.sendEmail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText(/I checked the statement/));
    fireEvent.click(screen.getByRole('button', { name: /Send to the fund/ }));
    await waitFor(() => expect(gateway.sendEmail).toHaveBeenCalledTimes(1));
    expect(gateway.sendEmail.mock.calls[0][0]).toMatchObject({ recipientEmail: 'claims@example-fund.test', attachments: [{ content: 'JVBERi0=', type: 'application/pdf' }] });
    expect(await screen.findByText(/was emailed to Example Health \(EXH1\) at claims@example-fund\.test/)).toBeInTheDocument();
    // Sent: no second send
    expect(screen.queryByRole('button', { name: /Send to the fund/ })).not.toBeInTheDocument();
  });

  it('explains where the address is kept when the fund has none, and offers no send', async () => {
    claims.loadFunds.mockResolvedValue([{ ...fund, email: null }]);
    render(<FundStatementEmailSheet practice={practice} statement={statement} asOfKey="2026-10-13" onClose={vi.fn()} />);
    expect(await screen.findByText(/has no claims email address on record/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send to the fund/ })).toBeDisabled();
  });
});
