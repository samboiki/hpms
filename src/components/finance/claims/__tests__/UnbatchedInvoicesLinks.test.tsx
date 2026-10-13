import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { UnbatchedInvoice } from '../types';

// One invented medical aid invoice that is in no claim batch
const INVOICE: UnbatchedInvoice = {
  invoiceId: 'inv-1',
  invoiceNumber: 'INV-000042',
  issueDate: '2026-10-01',
  serviceDate: '2026-09-28',
  patientId: 'patient-1',
  patientName: 'Example Patient',
  fundReference: 'NMC1',
  fundName: 'Namibia Medical Care',
  total: 650,
  lineCount: 2,
  notClaimableReason: null
};
vi.mock('../claimsService', () => ({
  loadUnbatchedInvoices: vi.fn(async () => [INVOICE]),
  addInvoicesToFundBatch: vi.fn()
}));
vi.mock('../../../ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));

import UnbatchedInvoices from '../UnbatchedInvoices';

afterEach(cleanup);

describe('Finance > Batches > Not yet batched', () => {
  // The invoice number was plain text: staff deciding whether to claim it could not open it
  it('each invoice opens in Finance, and its dates are written day first', async () => {
    render(
      <MemoryRouter>
        <UnbatchedInvoices
          practice={{ id: 'practice-1', name: 'Example Practice', practice_number: '1234567', practice_type: 'general_practice', contact_email: null }}
          funds={[{ id: 'f1', name: 'Namibia Medical Care', short_name: 'NMC', email: null, medical_aid_reference: 'NMC1', logo_url: null, theme_color: null }]}
          onAdded={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(await screen.findByRole('link', { name: 'INV-000042' })).toHaveAttribute('href', '/finance?tab=invoicing&invoice=inv-1');
    expect(screen.getByText('28 Sep 2026')).toBeInTheDocument();
    expect(screen.queryByText('2026-09-28')).toBeNull();
  });
});
