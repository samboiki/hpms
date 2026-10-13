/**
 * An invoice and the payments on it open each other: from the invoice's payments a receipt opens (to reprint or send
 * it, allocate its credit or see what else it paid), and the receipt links to each invoice it paid and to the
 * patient's billing. Before, a receipt could only be found under Payments for the period on screen. Invented data only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ArAllocation, ArReceipt } from '../../../services/ledgerService';
import { invoice } from '../../../services/__tests__/ledgerTestUtils';

const { RECEIPT, ALLOCATION } = vi.hoisted(() => {
  const RECEIPT: ArReceipt = {
    id: 'r1',
    number: 'RC-000045',
    payerType: 'patient',
    patientId: 'p1',
    fundName: null,
    payerName: null,
    method: 'cash',
    amountCents: 50000,
    receivedOn: '2026-10-10',
    reference: null,
    source: 'manual',
    notes: null,
    createdBy: null,
    createdAt: '2026-10-10T08:00:00Z',
    reversal: null,
    allocatedCents: 50000,
    refundedCents: 0,
    unallocatedCents: 0
  };
  const ALLOCATION: ArAllocation = {
    id: 'a1',
    receiptId: 'r1',
    invoiceId: 'inv-1',
    portion: 'patient',
    amountCents: 50000,
    createdBy: null,
    createdAt: '2026-10-10T08:00:00Z',
    reversal: null
  };
  return { RECEIPT, ALLOCATION };
});

vi.mock('../receipts/arService', async importOriginal => ({
  ...(await importOriginal<typeof import('../receipts/arService')>()),
  loadInvoiceEntries: vi.fn().mockResolvedValue({ balance: null, allocations: [ALLOCATION], adjustments: [], receipts: { r1: RECEIPT } }),
  loadReceiptEntries: vi.fn().mockResolvedValue({
    receipt: RECEIPT,
    allocations: [ALLOCATION],
    refunds: [],
    invoices: { 'inv-1': { invoiceNumber: 'INV-000123', patientId: 'p1' } }
  }),
  loadStaffNames: vi.fn().mockResolvedValue({}),
  loadPatientContact: vi.fn().mockResolvedValue(null)
}));
vi.mock('../receipts/creditNoteService', () => ({ loadCreditNoteDetails: vi.fn().mockResolvedValue(new Map()) }));
vi.mock('../../../services/discountService', () => ({ loadInvoiceDiscounts: vi.fn().mockResolvedValue([]) }));
vi.mock('../../../services/communicationService', () => ({ communicationService: {} }));

import { InvoiceLedgerPanel } from '../receipts/InvoiceLedgerPanel';

afterEach(cleanup);

describe("an invoice's payments and their receipts link both ways", () => {
  it('a payment on the invoice opens its receipt, which links to the invoice and the patient', async () => {
    render(
      <MemoryRouter>
        <InvoiceLedgerPanel
          practiceId="practice-1"
          practiceName="Example Practice"
          invoice={invoice({ id: 'inv-1', invoiceNumber: 'INV-000123', patientId: 'p1', total: 500, medicalAidTotal: 0 })}
          patientName="Example Patient"
          patientNames={{ p1: 'Example Patient' }}
          role="admin"
          staffName="Example Staff"
          onChanged={vi.fn()}
        />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Open receipt' }));
    expect(await screen.findByRole('link', { name: 'INV-000123' })).toHaveAttribute('href', '/finance?tab=invoicing&invoice=inv-1');
    expect(screen.getByRole('link', { name: 'Example Patient' })).toHaveAttribute('href', '/patients?patientId=p1&tab=billing');
  });
});
