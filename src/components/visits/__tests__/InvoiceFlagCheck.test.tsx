/**
 * The check when a visit is invoiced (parity A8). "Cash only": the person confirms the invoice is the patient's and
 * nothing is claimed. Above a credit limit: a receptionist cannot go on; an administrator can, with a reason that is
 * kept on the account before the invoice is saved. Going back saves nothing. Invented amounts; the database call
 * is replaced.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { effectiveFlags, type AccountFlag, type InvoiceFlagCheck } from '../../../services/ledgerService';

const mocks = vi.hoisted(() => ({
  recordCreditLimitOverride: vi.fn(),
  loadPatientAccountFlags: vi.fn(),
  // The invoice being saved again, as ar_invoice_balances returns it
  invoiceRow: { patient_outstanding: '0.00', medical_aid_billed: '0.00' } as Record<string, string>
}));
vi.mock('../../finance/debtors/debtorsService', () => ({ recordCreditLimitOverride: mocks.recordCreditLimitOverride }));
vi.mock('../../finance/debtors/useAccountFlags', () => ({ loadPatientAccountFlags: mocks.loadPatientAccountFlags }));
vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ range: async () => ({ data: [mocks.invoiceRow], error: null }) }) }) }) }
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
// Icons load their data on a timer that could outlive the test
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { InvoiceFlagDialog, useInvoiceFlagCheck, type InvoiceFlagDecision, type InvoiceFlagRequest } from '../InvoiceFlagCheck';

const cashOnly: InvoiceFlagCheck = { cashOnly: true, patientCents: 50000, overLimit: null, canOverride: false, needsConfirmation: true };
const overLimit = (canOverride: boolean): InvoiceFlagCheck => ({
  cashOnly: false,
  patientCents: 10000,
  overLimit: { limitCents: 100000, owedCents: 95000, afterCents: 105000, overCents: 5000 },
  canOverride,
  needsConfirmation: true
});
const request = { totalCents: 50000, patientCents: 10000 };

const open = (check: InvoiceFlagCheck) => {
  const onDone = vi.fn();
  render(<InvoiceFlagDialog check={check} request={request} practiceId="p1" patientId="pt1" onDone={onDone} />);
  return onDone;
};

beforeEach(() => {
  mocks.recordCreditLimitOverride.mockReset();
  mocks.recordCreditLimitOverride.mockResolvedValue({ id: 'note-1' });
  mocks.loadPatientAccountFlags.mockReset();
  mocks.invoiceRow = { patient_outstanding: '0.00', medical_aid_billed: '0.00' };
});

// The account as the visit's save reads it: a cash-only account (or none flagged)
const cashOnlyAccount = (on: boolean) => {
  const stored: AccountFlag[] = on
    ? [{ id: 'f1', patientId: 'pt1', flag: 'cash_only', amountCents: null, value: null, reason: 'Pays at the desk', setBy: 'u1', setAt: '2026-10-01T08:00:00Z', clearedAt: null, clearedBy: null, clearReason: null }]
    : [];
  mocks.loadPatientAccountFlags.mockResolvedValue({ flags: effectiveFlags({ patientId: 'pt1', holderId: null, flags: stored, smsOptOut: false }), creditLimit: null });
};

/** The visit screen's use of the check: confirm before saving, the dialog rendered once */
let confirm: ((request: InvoiceFlagRequest) => Promise<InvoiceFlagDecision | null>) | null = null;
const Visit: React.FC = () => {
  const check = useInvoiceFlagCheck({ patientId: 'pt1', practiceId: 'p1', role: 'receptionist' });
  confirm = check.confirm;
  return <>{check.dialog}</>;
};

describe('the check when a visit is saved with its invoice', () => {
  it('asks nothing on an account without such flags, so ordinary invoicing stays one click', async () => {
    cashOnlyAccount(false);
    render(<Visit />);
    await expect(confirm!({ totalCents: 50000, patientCents: 10000 })).resolves.toEqual({ billPatientOnly: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not ask again each time a cash-only invoice that is already wholly the patient\'s is saved, but keeps it the patient\'s', async () => {
    cashOnlyAccount(true);
    render(<Visit />);
    await expect(confirm!({ totalCents: 50000, patientCents: 10000, replacingInvoiceId: 'inv-1' })).resolves.toEqual({ billPatientOnly: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks when the invoice would still go to a medical aid, and waits for the answer before anything is saved', async () => {
    cashOnlyAccount(true);
    mocks.invoiceRow = { patient_outstanding: '100.00', medical_aid_billed: '400.00' };
    render(<Visit />);
    let answer: Promise<InvoiceFlagDecision | null> = Promise.resolve(null);
    await act(async () => { answer = confirm!({ totalCents: 50000, patientCents: 10000, replacingInvoiceId: 'inv-1' }); });
    fireEvent.click(await screen.findByRole('button', { name: 'Invoice the patient' }));
    await expect(answer).resolves.toEqual({ billPatientOnly: true });
  });
});

describe('invoicing a cash-only account', () => {
  it('says the patient pays it all today and nothing is claimed, then invoices the patient once confirmed', () => {
    const onDone = open(cashOnly);
    expect(screen.getByText(/The patient pays the whole invoice, N\$ 500\.00, today\. Nothing is claimed from a medical aid \(N\$ 400\.00 of it would have been\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Invoice the patient' }));
    expect(onDone).toHaveBeenCalledWith({ billPatientOnly: true });
    expect(mocks.recordCreditLimitOverride).not.toHaveBeenCalled();
  });

  it('saves nothing when the person goes back', () => {
    const onDone = open(cashOnly);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onDone).toHaveBeenCalledWith(null);
  });
});

describe('invoicing above a credit limit', () => {
  it('stops a receptionist: there is no way on, only back', () => {
    const onDone = open(overLimit(false));
    expect(screen.getByText(/With this invoice it would owe N\$ 1,050\.00, N\$ 50\.00 above the limit/)).toBeInTheDocument();
    expect(screen.getByText(/Only a practice administrator can invoice above the limit/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invoice anyway' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onDone).toHaveBeenCalledWith(null);
  });

  it('lets an administrator go on only with a reason, kept on the account before the invoice is saved', async () => {
    const onDone = open(overLimit(true));
    fireEvent.click(screen.getByRole('button', { name: 'Invoice anyway' }));
    expect(await screen.findByText('Give a reason: it is kept with the account')).toBeInTheDocument();
    expect(mocks.recordCreditLimitOverride).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Why may it go above the limit? (kept with the account)'), { target: { value: 'Known patient, pays monthly' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invoice anyway' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ billPatientOnly: false }));
    expect(mocks.recordCreditLimitOverride).toHaveBeenCalledWith('p1', 'pt1', 10000, 'Known patient, pays monthly');
  });

  it('does not save the invoice when the reason could not be kept', async () => {
    mocks.recordCreditLimitOverride.mockRejectedValue(new Error('Only a practice admin can invoice above an account\'s credit limit'));
    const onDone = open(overLimit(true));
    fireEvent.change(screen.getByLabelText('Why may it go above the limit? (kept with the account)'), { target: { value: 'Known patient' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invoice anyway' }));
    expect(await screen.findByText("Only a practice admin can invoice above an account's credit limit")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });
});
