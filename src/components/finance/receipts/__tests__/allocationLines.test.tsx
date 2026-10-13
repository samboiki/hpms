/**
 * Receive payment, line by line (parity H2): when nobody chooses, the screen says which lines a payment covers
 * (oldest line first, as the database splits it); a receptionist can instead let the patient pay only the
 * medicine and leave the consultation for the fund, and the receipt carries those lines. A line can never take
 * more than is unpaid on it. Invented invoice; the database calls are replaced.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { normalizeInvoice, type InvoiceLineOpen } from '../../../../services/ledgerService';

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
// Icons load their data on a timer that could outlive the test
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../ui/DateInput', () => ({
  default: ({ value, onChange, label }: { value: string; onChange: (value: string) => void; label?: string }) => (
    <input aria-label={label ?? 'Date'} value={value} onChange={event => onChange(event.target.value)} />
  )
}));

import { ReceivePaymentDialog } from '../ReceivePaymentDialog';

// A private invoice of N$ 300.00: a consultation (N$ 200.00, added first) and a medicine (N$ 100.00)
const line = (lineId: string, code: string, description: string, order: number, cents: number): InvoiceLineOpen => ({
  lineId, invoiceId: 'inv-1', code, description, dateKey: '2026-10-01', order,
  billed: { medical_aid: 0, patient: cents }, paid: { medical_aid: 0, patient: 0 }, credited: { medical_aid: 0, patient: 0 }, unpaidCents: cents
});

beforeEach(() => {
  Object.values(mocks).forEach(mock => mock.mockReset());
  mocks.loadPatientContact.mockResolvedValue({ name: 'Test Patient', cellNumber: null, email: null, fund: null });
  mocks.postReceipt.mockResolvedValue({ receipt_id: 'r1', receipt_number: 'RC-000020', duplicate: false, allocated: '100.00', unallocated: '0.00', adjustments: [] });
  mocks.loadPatientAccount.mockResolvedValue({
    state: 'ready',
    invoices: [normalizeInvoice({ id: 'inv-1', invoice_number: 'INV-1', total: 300, medical_aid_total: 0, patient_total: 300, payment_status: 'pending', issue_date: '2026-10-01', due_date: '2026-12-31', patient_id: 'pt1' })],
    balances: {},
    receipts: [],
    allocations: [],
    adjustments: []
  });
  mocks.loadInvoiceLines.mockResolvedValue({ 'inv-1': [line('l-consult', '0190', 'Consultation', 1, 20000), line('l-med', 'GMED', 'Medicine', 2, 10000)] });
});

const open = async () => {
  render(<ReceivePaymentDialog practiceId="p1" practiceName="Clinic" initialPatient={{ id: 'pt1', name: 'Test Patient' }} onClose={vi.fn()} />);
  await screen.findByText('INV-1');
  fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '100' } });
  await screen.findByRole('button', { name: 'Choose lines' });
};

describe('Receive payment, line by line', () => {
  it('says which line a payment covers when nobody chooses: the oldest line first, as the database will split it', async () => {
    await open();
    expect(screen.getByText('Covers 0190')).toBeInTheDocument();
  });

  it('lets the patient pay only the medicine, and sends those lines with the payment', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Choose lines' }));
    // It starts from the automatic split: the consultation takes the N$ 100.00
    expect(screen.getByLabelText(/0190 Consultation/)).toHaveValue('100.00');
    fireEvent.change(screen.getByLabelText(/0190 Consultation/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/GMED Medicine/), { target: { value: '100' } });
    // The invoice's amount is the sum of its lines
    expect(screen.getByLabelText('Pay on INV-1, Patient portion')).toHaveValue('100.00');

    fireEvent.click(screen.getByRole('button', { name: /Save receipt/ }));
    await waitFor(() => expect(mocks.postReceipt).toHaveBeenCalledTimes(1));
    expect(mocks.postReceipt).toHaveBeenCalledWith(expect.objectContaining({
      amountCents: 10000,
      allocations: [{ invoiceId: 'inv-1', portion: 'patient', amountCents: 10000, lines: [{ lineId: 'l-med', amountCents: 10000 }] }]
    }));
  });

  it('will not save a line that takes more than is unpaid on it', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Choose lines' }));
    fireEvent.change(screen.getByLabelText(/0190 Consultation/), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/GMED Medicine/), { target: { value: '150' } });
    expect(screen.getByText('More than the N$ 100.00 still unpaid on this line')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save receipt/ })).toBeDisabled();
  });

  it('goes back to the automatic split, and sends no lines then', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Choose lines' }));
    fireEvent.click(screen.getByRole('button', { name: 'Split automatically (oldest line first)' }));
    fireEvent.click(screen.getByRole('button', { name: /Save receipt/ }));
    await waitFor(() => expect(mocks.postReceipt).toHaveBeenCalledTimes(1));
    expect(mocks.postReceipt.mock.calls[0][0].allocations).toEqual([{ invoiceId: 'inv-1', portion: 'patient', amountCents: 10000 }]);
  });

  it('never asks the patient to pay what a credit note took off: a line credited in full shows nothing to pay, a part-credited one only the rest', async () => {
    mocks.loadInvoiceLines.mockResolvedValue({
      'inv-1': [
        { ...line('l-consult', '0190', 'Consultation', 1, 20000), credited: { medical_aid: 0, patient: 20000 }, unpaidCents: 0 },
        { ...line('l-med', 'GMED', 'Medicine', 2, 10000), credited: { medical_aid: 0, patient: 4000 }, unpaidCents: 6000 }
      ]
    });
    await open();
    // Oldest line first, but the credited consultation takes nothing
    expect(screen.getByText('Covers GMED, other')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Choose lines' }));
    expect(screen.getByLabelText(/0190 Consultation/)).toBeDisabled();
    expect(screen.getByText(/Nothing unpaid on this line/)).toBeInTheDocument();
    expect(screen.getByText(/N\$ 60\.00 unpaid/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/GMED Medicine/), { target: { value: '100' } });
    expect(screen.getByText('More than the N$ 60.00 still unpaid on this line')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save receipt/ })).toBeDisabled();
  });

  it('offers no line choice before the database keeps allocation lines (the payment is split as before)', async () => {
    mocks.loadInvoiceLines.mockResolvedValue(null);
    render(<ReceivePaymentDialog practiceId="p1" practiceName="Clinic" initialPatient={{ id: 'pt1', name: 'Test Patient' }} onClose={vi.fn()} />);
    await screen.findByText('INV-1');
    fireEvent.change(screen.getByLabelText('Amount received'), { target: { value: '100' } });
    await waitFor(() => expect(mocks.loadInvoiceLines).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Choose lines' })).toBeNull();
  });
});
