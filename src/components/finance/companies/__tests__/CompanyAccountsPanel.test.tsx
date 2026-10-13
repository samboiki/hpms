import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { buildAgingReport } from '../../../../services/ledgerService';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import { payersByInvoice, type PayerAccount } from '../../../../utils/accounts/payerAccounts';
import type { PracticePayerData } from '../../../../services/payerAccountService';

// The sheets open other services; this test is about the list
vi.mock('../PayerAccountSheet', () => ({ PayerAccountSheet: () => <div>Account form</div> }));
vi.mock('../CompanyAccountSheet', () => ({ CompanyAccountSheet: ({ account }: { account: PayerAccount }) => <div>Sheet of {account.name}</div> }));

import { CompanyAccountsPanel } from '../CompanyAccountsPanel';

// Invented accounts and invoices only
const account = (id: string, name: string, kind: PayerAccount['kind'], closedAt: string | null = null): PayerAccount => ({
  id,
  practiceId: 'pr1',
  kind,
  name,
  accountNumber: `AC-${id}`,
  registrationNumber: null,
  vatNumber: null,
  contactName: null,
  phone: null,
  email: null,
  postalAddress: null,
  town: null,
  region: null,
  notes: null,
  createdAt: null,
  closedAt,
  closeReason: null
});

const accounts = [account('1', 'Test Builders', 'employer'), account('2', "Employees' Compensation Fund", 'compensation_fund'), account('3', 'Closed Test Insurer', 'other', '2026-10-01T08:00:00+02:00')];
const invoices = [
  invoice({ id: 'i1', patientId: 'p1', visitId: 'v1', issueDate: '2026-10-01', total: 300, medicalAidTotal: 0 }),
  invoice({ id: 'i2', patientId: 'p2', visitId: 'v2', issueDate: '2026-06-01', total: 200, medicalAidTotal: 0 }),
  // The patient's own invoice is nobody's account debt
  invoice({ id: 'i3', patientId: 'p1', visitId: 'v3', issueDate: '2026-10-01', total: 999, medicalAidTotal: 0 })
];
const visitPayers = [
  { visitId: 'v1', accountId: '1', caseId: null },
  { visitId: 'v2', accountId: '2', caseId: 'c1' }
];
const aging = buildAgingReport(invoices, '2026-10-13');
const payers = (overrides: Partial<PracticePayerData> = {}): PracticePayerData => ({
  status: 'ready',
  accounts,
  visitPayers,
  byInvoice: payersByInvoice(invoices, visitPayers, accounts),
  error: null,
  ...overrides
});

afterEach(() => cleanup());

const renderPanel = (state: PracticePayerData, onOpenAccount = vi.fn(), openAccountId: string | null = null) =>
  render(
    <CompanyAccountsPanel
      practiceId="pr1"
      aging={aging}
      payers={state}
      todayKey="2026-10-13"
      openAccountId={openAccountId}
      onOpenAccount={onOpenAccount}
      onChanged={vi.fn()}
    />
  );

describe('Finance > Debtors > Companies (A14)', () => {
  // Each account owes only what the visits billed to it still owe: never the patients' own invoices
  it('lists the open accounts with what their own invoices owe, and opens one', () => {
    const onOpenAccount = vi.fn();
    renderPanel(payers(), onOpenAccount);
    const builders = screen.getByText('Test Builders').closest('tr') as HTMLElement;
    expect(within(builders).getByText('N$ 300.00', { selector: 'span' })).toBeInTheDocument();
    const fund = screen.getByText("Employees' Compensation Fund", { selector: 'p' }).closest('tr') as HTMLElement;
    expect(within(fund).getByText('N$ 200.00', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('Closed Test Insurer')).not.toBeInTheDocument();
    expect(screen.queryByText('N$ 999.00')).not.toBeInTheDocument();
    fireEvent.click(builders);
    expect(onOpenAccount).toHaveBeenCalledWith('1');
  });

  it('shows closed accounts when asked', () => {
    renderPanel(payers());
    fireEvent.click(screen.getByRole('button', { name: /Show closed accounts/ }));
    expect(screen.getByText('Closed Test Insurer')).toBeInTheDocument();
  });

  it('opens the sheet of the account chosen (from here or from the age analysis)', () => {
    renderPanel(payers(), vi.fn(), '1');
    expect(screen.getByText('Sheet of Test Builders')).toBeInTheDocument();
  });

  it('says the accounts are not set up yet instead of showing a database error, and offers no button', () => {
    renderPanel(payers({ status: 'not_set_up', accounts: [], visitPayers: [], byInvoice: {} }));
    expect(screen.getByText('Company accounts are not set up yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add account' })).not.toBeInTheDocument();
  });
});
