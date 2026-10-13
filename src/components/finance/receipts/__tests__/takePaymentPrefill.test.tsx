/**
 * Receive payment opened by "Invoice and take payment" (the visit's Billing tab): the amount starts at
 * what the patient owes now on the new invoice, and that invoice is paid first. A fund-only invoice
 * starts empty, so the desk never asks the patient for the medical aid's money. Database calls are replaced.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { normalizeInvoice } from '../../../../services/ledgerService';

const mocks = vi.hoisted(() => ({
  loadPatientAccount: vi.fn(),
  loadFundOpenClaims: vi.fn(),
  searchPatients: vi.fn(),
  postReceipt: vi.fn(),
  loadPatientContact: vi.fn(),
  loadInvoiceLines: vi.fn()
}));

vi.mock('../arService', () => ({
  ...mocks,
  isArNotSetUp: () => false,
  AR_NOT_SET_UP_MESSAGE: 'Receipts are not set up',
  FUND_NOT_RECORDED: 'Medical aid not recorded'
}));
vi.mock('../../../../services/communicationService', () => ({ communicationService: { sendSMS: vi.fn(), sendEmail: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
// Iconify fetches icon data and fires timers after the test ends ("window is not defined")
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../ui/DateInput', () => ({
  default: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) => (
    <input aria-label={label ?? 'Date'} value={value} onChange={event => onChange(event.target.value)} />
  )
}));

import { ReceivePaymentDialog } from '../ReceivePaymentDialog';

const invoice = (id: string, number: string, total: number, issueDate: string, medicalAid = 0) =>
  normalizeInvoice({ id, invoice_number: number, total, medical_aid_total: medicalAid, patient_total: total - medicalAid, payment_status: 'pending', issue_date: issueDate, due_date: '2026-12-31', patient_id: 'pt1' });

const account = (invoices: ReturnType<typeof invoice>[]) => ({ state: 'ready', invoices, balances: {}, receipts: [], allocations: [], adjustments: [] });

const open = (props: Partial<React.ComponentProps<typeof ReceivePaymentDialog>> = {}) =>
  render(
    <ReceivePaymentDialog
      practiceId="p1"
      practiceName="Clinic"
      initialPatient={{ id: 'pt1', name: 'Test Patient' }}
      focusInvoiceId="new"
      prefillPatientShare
      onClose={vi.fn()}
      {...props}
    />
  );

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  // A database without allocation lines: payments are split automatically, as before
  mocks.loadInvoiceLines.mockResolvedValue(null);
  mocks.loadPatientContact.mockResolvedValue({ name: 'Test Patient', cellNumber: null, email: null, fund: null });
  mocks.postReceipt.mockResolvedValue({ receipt_id: 'r1', receipt_number: 'RC-000009', duplicate: false, allocated: '50.00', unallocated: '0.00', adjustments: [] });
});

describe('Receive payment after "Invoice and take payment"', () => {
  it('starts at the co-payment the patient owes on the new invoice and pays that invoice first, before an older debt', async () => {
    mocks.loadPatientAccount.mockResolvedValue(account([invoice('old', 'INV-1', 200, '2026-09-01'), invoice('new', 'INV-2', 500, '2026-10-08', 450)]));
    open();
    // The amount and its allocation fill in on consecutive renders: wait for both (the full suite runs slower)
    await waitFor(() => {
      expect(screen.getByLabelText('Amount received')).toHaveValue('50.00');
      expect(screen.getByLabelText('Pay on INV-2, Patient portion')).toHaveValue('50.00');
    });
    expect(screen.getByLabelText('Pay on INV-1, Patient portion')).toHaveValue('');

    fireEvent.click(screen.getByRole('button', { name: /Save receipt/ }));
    await waitFor(() => expect(mocks.postReceipt).toHaveBeenCalledTimes(1));
    expect(mocks.postReceipt).toHaveBeenCalledWith(expect.objectContaining({
      payerType: 'patient',
      patientId: 'pt1',
      amountCents: 5000,
      allocations: [{ invoiceId: 'new', portion: 'patient', amountCents: 5000 }]
    }));
  });

  it('starts empty when the medical aid pays the whole invoice: there is nothing to ask the patient for', async () => {
    mocks.loadPatientAccount.mockResolvedValue(account([invoice('new', 'INV-3', 500, '2026-10-08', 500)]));
    open();
    // Listed (the fund still owes it), but nothing is filled in for the patient to pay
    await screen.findByLabelText('Pay on INV-3, Medical aid portion');
    expect(screen.getByLabelText('Amount received')).toHaveValue('');
  });

  it('does not prefill when opened any other way (Receive payment from the patient file)', async () => {
    mocks.loadPatientAccount.mockResolvedValue(account([invoice('new', 'INV-4', 300, '2026-10-08')]));
    open({ prefillPatientShare: false });
    await screen.findByText('INV-4');
    expect(screen.getByLabelText('Amount received')).toHaveValue('');
  });

  it('shows above a full-screen visit when opened from one', async () => {
    mocks.loadPatientAccount.mockResolvedValue(account([invoice('new', 'INV-5', 300, '2026-10-08')]));
    open({ overFullScreen: true });
    const dialog = await screen.findByRole('dialog');
    expect(dialog.parentElement?.className).toContain('z-[2147483647]');
  });
});
