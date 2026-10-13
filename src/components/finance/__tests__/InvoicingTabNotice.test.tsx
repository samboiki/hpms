import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';

import { InvoicingTab } from '../InvoicingTab';

afterEach(cleanup);

const labels: PeriodLabels = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-13' }, previous: { startKey: '2026-09-01', endKey: '2026-09-13' } },
  current: '1-13 Oct 2026',
  previous: '1-13 Sep 2026',
  today: '13 Oct 2026',
  todayKey: '2026-10-13'
};
const workspace = (arState: 'ready' | 'not_set_up') =>
  ({
    practiceId: 'practice-1',
    invoices: { rows: [], error: null },
    patientNames: {},
    doctorNames: {},
    schemeByPatient: {},
    ar: { state: arState, error: null, receipts: [], refunds: [], balances: {} }
  }) as unknown as FinanceWorkspace;

describe('Finance > Invoicing says where invoices are paid', () => {
  // "Finance is read-only ... marked paid on the patient's Billing tab" was untrue once receipts are in use: the invoice
  // in Finance takes payments and credit notes itself (no discounts: owner, 13 Oct 2026)
  it('once receipts are in use, points to the invoice itself', () => {
    render(<InvoicingTab workspace={workspace('ready')} labels={labels} onOpenInvoice={vi.fn()} />);
    expect(screen.getByText(/Open an invoice to receive a payment or credit it;/)).toBeInTheDocument();
    expect(screen.queryByText(/discount/)).toBeNull();
    expect(screen.queryByText(/Finance is read-only/)).toBeNull();
  });

  it('before receipts exist, says invoices are marked paid on the Billing tab', () => {
    render(<InvoicingTab workspace={workspace('not_set_up')} labels={labels} onOpenInvoice={vi.fn()} />);
    expect(screen.getByText(/marked paid on the patient's Billing tab/)).toBeInTheDocument();
  });
});
