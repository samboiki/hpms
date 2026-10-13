/**
 * The receipt screens as staff use them: the suggested allocation, what is left as credit, a
 * fund's payment handed to the line-by-line keying, and the limits on credit notes and
 * write-offs. The database calls are replaced; what matters is what would be sent.
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
  postAdjustment: vi.fn(),
  loadPatientContact: vi.fn(),
  loadInvoiceLines: vi.fn()
}));

// Icons load on a timer that outlives the test; they are decorative here
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../arService', () => ({
  ...mocks,
  isArNotSetUp: () => false,
  AR_NOT_SET_UP_MESSAGE: 'Receipts are not set up',
  FUND_NOT_RECORDED: 'Medical aid not recorded'
}));
vi.mock('../../../../services/communicationService', () => ({ communicationService: { sendSMS: vi.fn(), sendEmail: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('../FundPaymentSheet', () => ({
  FundPaymentSheet: ({ practiceId, onPatientPayment }: { practiceId: string; onPatientPayment?: () => void }) => (
    <div>
      <p>Fund keying for {practiceId}</p>
      <button type="button" onClick={onPatientPayment}>Patient payment instead</button>
    </div>
  )
}));
vi.mock('../../../ui/DateInput', () => ({
  default: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) => (
    <input aria-label={label ?? 'Date'} value={value} onChange={event => onChange(event.target.value)} />
  )
}));

import { ReceivePaymentDialog } from '../ReceivePaymentDialog';
import { AdjustmentDialog } from '../AdjustmentDialog';

const invoice = (id: string, number: string, total: number, issueDate: string, medicalAid = 0) =>
  normalizeInvoice({ id, invoice_number: number, total, medical_aid_total: medicalAid, payment_status: 'pending', issue_date: issueDate, due_date: '2026-12-31', patient_id: 'pt1' });

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  // A database without allocation lines: payments are split automatically, as before
  mocks.loadInvoiceLines.mockResolvedValue(null);
  mocks.loadPatientContact.mockResolvedValue({ name: 'Ndapewa Shilongo', cellNumber: null, email: null, fund: null });
  mocks.postReceipt.mockResolvedValue({ receipt_id: 'r1', receipt_number: 'RC-000001', duplicate: false, allocated: '450.00', unallocated: '50.00', adjustments: [] });
});

describe('Receive payment', () => {
  const openForPatient = async () => {
    mocks.loadPatientAccount.mockResolvedValue({
      state: 'ready',
      invoices: [invoice('new', 'INV-2', 250, '2026-09-15'), invoice('old', 'INV-1', 200, '2026-09-01')],
      balances: {},
      receipts: [],
      allocations: [],
      adjustments: []
    });
    render(<ReceivePaymentDialog practiceId="p1" practiceName="Clinic" initialPatient={{ id: 'pt1', name: 'Ndapewa Shilongo' }} onClose={vi.fn()} />);
    await screen.findByText('INV-1');
  };

  it('fills in a N$ 500 payment oldest invoice first and shows the N$ 50 left over as credit, then saves it in one call', async () => {
    await openForPatient();
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '500' } });

    expect(screen.getByLabelText('Pay on INV-1, Patient portion')).toHaveValue('200.00');
    expect(screen.getByLabelText('Pay on INV-2, Patient portion')).toHaveValue('250.00');
    expect(screen.getByText('N$ 50.00 left: kept as credit')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save receipt/ }));
    await waitFor(() => expect(mocks.postReceipt).toHaveBeenCalledTimes(1));
    expect(mocks.postReceipt).toHaveBeenCalledWith(expect.objectContaining({
      practiceId: 'p1',
      payerType: 'patient',
      patientId: 'pt1',
      method: 'cash',
      amountCents: 50000,
      source: 'manual',
      allocations: [
        { invoiceId: 'old', portion: 'patient', amountCents: 20000 },
        { invoiceId: 'new', portion: 'patient', amountCents: 25000 }
      ]
    }));
    expect(await screen.findByText('Receipt RC-000001 saved')).toBeInTheDocument();
    expect(screen.getByText('Kept as credit on the account')).toBeInTheDocument();
  });

  it('will not save a line that pays more than the invoice still owes', async () => {
    await openForPatient();
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Pay on INV-1, Patient portion'), { target: { value: '300' } });

    expect(screen.getByText('More than the N$ 200.00 still owed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save receipt/ })).toBeDisabled();
    expect(mocks.postReceipt).not.toHaveBeenCalled();
  });

  // A fund's payment is keyed line by line against its total (fundPaymentSheet.test.tsx), never spread over invoices here
  it('hands a medical aid payment over to the line-by-line fund keying, and back for a patient payment', async () => {
    render(<ReceivePaymentDialog practiceId="p1" practiceName="Clinic" initialPayer="medical_aid" onClose={vi.fn()} />);
    expect(screen.getByText('Fund keying for p1')).toBeInTheDocument();
    expect(mocks.postReceipt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Patient payment instead' }));
    expect(await screen.findByText('Receive payment')).toBeInTheDocument();
  });
});

describe('Credit notes and write-offs', () => {
  const owed = { medical_aid: 0, patient: 12000 };

  it('a receptionist cannot write off: the practice admin or doctor approves it', () => {
    render(<AdjustmentDialog practiceId="p1" kind="write_off" invoice={{ id: 'i1', invoiceNumber: 'INV-1' }} outstanding={owed} role="receptionist" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getAllByText(/Only a practice admin or doctor can approve a write-off/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();
  });

  it('a credit note can never be more than the patient still owes, and is confirmed before it is saved', async () => {
    mocks.postAdjustment.mockResolvedValue({ id: 'a1', number: 'CN-000001', kind: 'credit_note' });
    const onSaved = vi.fn();
    render(<AdjustmentDialog practiceId="p1" kind="credit_note" invoice={{ id: 'i1', invoiceNumber: 'INV-1' }} outstanding={owed} role="receptionist" onClose={vi.fn()} onSaved={onSaved} />);

    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Consultation billed twice' } });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '150' } });
    expect(screen.getByText('A credit note cannot be more than the N$ 120.00 still owed on the patient portion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(screen.getByText('Patient will owe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Issue credit note' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('I have checked the amount and the reason.'));
    fireEvent.click(screen.getByRole('button', { name: 'Issue credit note' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('CN-000001'));
    expect(mocks.postAdjustment).toHaveBeenCalledWith(expect.objectContaining({ kind: 'credit_note', portion: 'patient', amountCents: 12000, invoiceId: 'i1' }));
  });
});
