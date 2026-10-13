/**
 * The patient's Billing summary: money paid in but not yet used on an invoice (credit) and the last
 * payment are shown where staff look first, instead of one tap away inside "Promises and notes".
 * Nothing extra shows when there is nothing. The children that talk to the database are replaced.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { summarizePatientInvoices, type PatientInvoice } from '../patientBilling';
import type { PatientInvoicesResult } from '../usePatientInvoices';

// Whether the practice lets this person into Finance (Settings > Users > Screen access)
const access = vi.hoisted(() => ({ seesFinance: true }));
vi.mock('../../../hooks/useScreenAccess', () => ({ useSeesFinanceFigures: () => access.seesFinance }));
vi.mock('../payers/useInvoicePayers', () => ({ useInvoicePayers: () => ({}) }));

vi.mock('../../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { name: string; practices: { name: string } } }) => unknown) =>
    selector({ user: { name: 'Front Desk', practices: { name: 'Test Practice' } } })
}));
vi.mock('../../modals/InvoiceDetailsModal', () => ({ default: () => null }));
vi.mock('../../finance/receipts/ReceivePaymentDialog', () => ({ ReceivePaymentDialog: () => null }));
vi.mock('../../finance/receipts/PatientStatementDialog', () => ({ PatientStatementDialog: () => null }));
vi.mock('../../finance/debtors/PatientAccountPanel', () => ({ PatientAccountPanel: () => null }));
vi.mock('../registers/PatientClaimRegisters', () => ({ default: () => null }));
vi.mock('../PatientPriceRatePanel', () => ({ default: () => null }));

import PatientBillingPanel from '../PatientBillingPanel';

const state = (money: PatientInvoicesResult['money'], invoices: PatientInvoice[] = []): PatientInvoicesResult => ({
  invoices,
  summary: summarizePatientInvoices(invoices),
  isLoading: false,
  hasLoaded: true,
  error: null,
  reload: vi.fn(),
  patientId: 'pt1',
  practiceId: 'practice-1',
  ledgerState: 'ready',
  ledgerBalances: {},
  money
});

const renderPanel = (money: PatientInvoicesResult['money'], invoices: PatientInvoice[] = []) =>
  render(<PatientBillingPanel invoices={state(money, invoices)} visitsById={new Map()} patient={{ name: 'Test Patient' }} onOpenVisit={vi.fn()} />, {
    wrapper: MemoryRouter
  });

// Invented invoice only
const INVOICE: PatientInvoice = {
  id: 'inv-1',
  invoiceNumber: 'INV-000007',
  visitId: null,
  date: '2026-10-06',
  dueDate: '2026-11-05',
  createdAt: '2026-10-06T08:00:00Z',
  total: 450,
  medicalAidPortion: 0,
  patientPortion: 450,
  status: 'pending',
  partPaid: false,
  paymentMethod: null
};

// The account listed every invoice but none opened in Finance, where its payments, credit notes, claim batch and quote
// are; Finance's invoice already linked back here
describe("the patient's invoices link to Finance", () => {
  it('each invoice opens in Finance for staff the practice lets into Finance', () => {
    access.seesFinance = true;
    renderPanel({ creditCents: 0, lastPayment: null }, [INVOICE]);
    expect(screen.getByRole('link', { name: 'Open invoice INV-000007 in Finance' })).toHaveAttribute('href', '/finance?tab=invoicing&invoice=inv-1');
  });

  it('shows no Finance link to a role kept out of Finance', () => {
    access.seesFinance = false;
    renderPanel({ creditCents: 0, lastPayment: null }, [INVOICE]);
    expect(screen.queryByRole('link', { name: /in Finance/ })).toBeNull();
    access.seesFinance = true;
  });

  it('credit on the account links to Finance > Payments, where it is allocated or refunded', () => {
    renderPanel({ creditCents: 5000, lastPayment: null });
    expect(screen.getByRole('link', { name: 'Finance > Payments' })).toHaveAttribute('href', '/finance?tab=payments');
  });
});

describe('the patient Billing summary', () => {
  it('shows unallocated credit and the last payment with its amount and day, so the desk sees both without opening anything', () => {
    renderPanel({ creditCents: 5000, lastPayment: { receivedOn: '2026-10-06', amountCents: 25000, receiptNumber: 'RC-000001' } });
    expect(screen.getByText('Credit')).toBeInTheDocument();
    expect(screen.getByText('N$ 50.00')).toBeInTheDocument();
    expect(screen.getByText(/not yet used on an invoice/)).toBeInTheDocument();
    expect(screen.getByText('Last payment N$ 250.00 on 6 Oct 2026')).toBeInTheDocument();
  });

  it('adds nothing when there is no credit and no payment yet, or before receipts are set up', () => {
    const { unmount } = renderPanel({ creditCents: 0, lastPayment: null });
    expect(screen.queryByText('Credit')).toBeNull();
    expect(screen.queryByText(/Last payment/)).toBeNull();
    unmount();
    renderPanel(null);
    expect(screen.queryByText('Credit')).toBeNull();
    expect(screen.queryByText(/Last payment/)).toBeNull();
  });
});
