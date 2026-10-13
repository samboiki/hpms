/**
 * The patient's statement on screen: every line opens what it is about (bi-directional links). A payment opens its
 * receipt on top of the statement, and a refund or reversal made there shows on the statement and on the account
 * behind it at once. An invoice line opens the invoice the way the screen behind shows invoices (Finance, or the patient
 * file's own invoice details); a screen that gives no way to open invoices leaves them as text. Invented data only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { normalizeInvoice, type ArReceipt } from '../../../../services/ledgerService';
import { DEFAULT_DOCUMENT_SETTINGS } from '../../../../utils/billing/documentSettings';

const mocks = vi.hoisted(() => ({ loadPatientAccount: vi.fn() }));

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../arService', () => ({ ...mocks, AR_NOT_SET_UP_MESSAGE: 'Receipts are not set up' }));
vi.mock('../../../../services/documentSettingsService', () => ({ loadDocumentSettings: vi.fn(async () => DEFAULT_DOCUMENT_SETTINGS) }));
vi.mock('../../debtors/debtorsService', () => ({ loadInvoiceAuthorisations: vi.fn(async () => ({})) }));
vi.mock('../../debtors/useAccountFlags', () => ({ useAccountFlags: () => ({ flags: [] }) }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('../../../ui/DateInput', () => ({
  default: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) => (
    <input aria-label={label ?? 'Date'} value={value} onChange={event => onChange(event.target.value)} />
  )
}));
// The receipt view itself is tested elsewhere: here it only shows which receipt opened, and can report a change
vi.mock('../ReceiptDetailModal', () => ({
  ReceiptDetailModal: ({ receipt, onChanged, onClose }: { receipt: ArReceipt; onChanged: () => void; onClose: () => void }) => (
    <div role="dialog" aria-label="Receipt view">
      <p>Viewing receipt {receipt.number}</p>
      <button type="button" onClick={onChanged}>Refund it</button>
      <button type="button" onClick={onClose}>Back</button>
    </div>
  )
}));

import { PatientStatementDialog } from '../PatientStatementDialog';

const cash: ArReceipt = {
  id: 'rc-1', number: 'RC-000101', payerType: 'patient', patientId: 'pt1', fundName: null, payerName: null, method: 'cash',
  amountCents: 20000, receivedOn: '2026-10-05', reference: null, source: 'manual', notes: null, createdBy: 'u1',
  createdAt: '2026-10-05T08:00:00Z', reversal: null, allocatedCents: 20000, refundedCents: 0, unallocatedCents: 0
};

const account = () => ({
  state: 'ready' as const,
  invoices: [normalizeInvoice({ id: 'inv-1', invoice_number: 'INV-000201', patient_id: 'pt1', issue_date: '2026-10-01', total: 450, medical_aid_total: 0, payment_status: 'pending' })],
  balances: {},
  receipts: [cash],
  allocations: [{ id: 'al-1', receiptId: 'rc-1', invoiceId: 'inv-1', portion: 'patient' as const, amountCents: 20000, createdBy: 'u1', createdAt: cash.createdAt, reversal: null }],
  adjustments: []
});

const renderStatement = (props: { onOpenInvoice?: (id: string) => void; onChanged?: () => void } = {}) =>
  render(<PatientStatementDialog practiceId="practice-1" practiceName="Example Practice" patientId="pt1" patientName="Example Patient" onClose={vi.fn()} {...props} />);

beforeEach(() => {
  mocks.loadPatientAccount.mockReset();
  mocks.loadPatientAccount.mockResolvedValue(account());
});
afterEach(cleanup);

describe('the statement opens what each line is about', () => {
  it('an invoice line opens that invoice the way the screen behind shows invoices', async () => {
    const onOpenInvoice = vi.fn();
    renderStatement({ onOpenInvoice });
    fireEvent.click(await screen.findByRole('button', { name: /Open invoice INV-000201/ }));
    expect(onOpenInvoice).toHaveBeenCalledWith('inv-1');
  });

  it('a payment line opens its receipt over the statement; a refund there reloads the statement and the account behind it', async () => {
    const onChanged = vi.fn();
    renderStatement({ onChanged });
    fireEvent.click(await screen.findByRole('button', { name: /Open receipt RC-000101/ }));
    expect(screen.getByText('Viewing receipt RC-000101')).toBeInTheDocument();
    // The statement waits behind the receipt (one sheet at a time, so Escape closes only the receipt)
    expect(screen.queryByText('Statement: Example Patient')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Refund it' }));
    await waitFor(() => expect(mocks.loadPatientAccount).toHaveBeenCalledTimes(2));
    expect(onChanged).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Statement: Example Patient')).toBeInTheDocument();
  });

  it('with no way to open invoices given, invoice lines stay text while payments still open', async () => {
    renderStatement();
    expect(await screen.findByRole('button', { name: /Open receipt RC-000101/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open invoice/ })).toBeNull();
    expect(screen.getByText(/Invoice INV-000201/)).toBeInTheDocument();
  });
});
