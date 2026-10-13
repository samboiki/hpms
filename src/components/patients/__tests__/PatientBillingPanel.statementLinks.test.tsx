/**
 * The account's statement on the patient's Billing tab: an invoice line opens that invoice. Staff the practice lets into
 * Finance get Finance's invoice view (its payments, credit notes, claim batch); everyone else gets the invoice's details
 * right here, the same view a click on the invoice list gives them. Invented data only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { summarizePatientInvoices, type PatientInvoice } from '../patientBilling';
import type { PatientInvoicesResult } from '../usePatientInvoices';

const access = vi.hoisted(() => ({ seesFinance: true }));
vi.mock('../../../hooks/useScreenAccess', () => ({ useSeesFinanceFigures: () => access.seesFinance }));
vi.mock('../payers/useInvoicePayers', () => ({ useInvoicePayers: () => ({}) }));
const db = vi.hoisted(() => ({
  from: vi.fn(() => {
    const query = { select: () => query, eq: () => query, order: async () => ({ data: [], error: null }) };
    return query;
  })
}));
vi.mock('../../../lib/supabase', () => ({ supabase: db }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { name: string; practices: { name: string } } }) => unknown) =>
    selector({ user: { name: 'Front Desk', practices: { name: 'Test Practice' } } })
}));
vi.mock('../../modals/InvoiceDetailsModal', () => ({
  default: ({ isOpen, invoice }: { isOpen: boolean; invoice: { invoice_number: string } | null }) => (isOpen && invoice ? <p>Details of {invoice.invoice_number}</p> : null)
}));
vi.mock('../../finance/receipts/ReceivePaymentDialog', () => ({ ReceivePaymentDialog: () => null }));
vi.mock('../../finance/receipts/PatientStatementDialog', () => ({
  PatientStatementDialog: ({ onOpenInvoice }: { onOpenInvoice?: (id: string) => void }) => (
    <button type="button" onClick={() => onOpenInvoice?.('inv-1')}>Statement line: Invoice INV-000007</button>
  )
}));
vi.mock('../../finance/debtors/PatientAccountPanel', () => ({ PatientAccountPanel: () => null }));
vi.mock('../registers/PatientClaimRegisters', () => ({ default: () => null }));
vi.mock('../PatientPriceRatePanel', () => ({ default: () => null }));
vi.mock('../../billingExtras/PatientPlansPanel', () => ({ default: () => null }));
vi.mock('../payers/PatientPayersRegister', () => ({ default: () => null }));

import PatientBillingPanel from '../PatientBillingPanel';

const INVOICE: PatientInvoice = {
  id: 'inv-1', invoiceNumber: 'INV-000007', visitId: null, date: '2026-10-06', dueDate: '2026-11-05', createdAt: '2026-10-06T08:00:00Z',
  total: 450, medicalAidPortion: 0, patientPortion: 450, status: 'pending', partPaid: false, paymentMethod: null
};
const state: PatientInvoicesResult = {
  invoices: [INVOICE], summary: summarizePatientInvoices([INVOICE]), isLoading: false, hasLoaded: true, error: null, reload: vi.fn(),
  patientId: 'pt1', practiceId: 'practice-1', ledgerState: 'ready', ledgerBalances: {}, money: { creditCents: 0, lastPayment: null }
};

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;
const openStatementLine = () => {
  render(
    <MemoryRouter initialEntries={['/patients?patientId=pt1&tab=billing']}>
      <Routes>
        <Route path="*" element={<><PatientBillingPanel invoices={state} visitsById={new Map()} patient={{ name: 'Test Patient' }} onOpenVisit={vi.fn()} /><Where /></>} />
      </Routes>
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Statement' }));
  fireEvent.click(screen.getByRole('button', { name: 'Statement line: Invoice INV-000007' }));
};

afterEach(() => {
  cleanup();
  access.seesFinance = true;
});

describe("a statement line's invoice", () => {
  it('opens in Finance for staff the practice lets into Finance', () => {
    openStatementLine();
    expect(screen.getByTestId('where')).toHaveTextContent('/finance?tab=invoicing&invoice=inv-1');
  });

  it('opens its details here for a role kept out of Finance', async () => {
    access.seesFinance = false;
    openStatementLine();
    expect(await screen.findByText('Details of INV-000007')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/patients?patientId=pt1&tab=billing');
  });
});
