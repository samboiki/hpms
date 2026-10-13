import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { ClaimedInvoiceNotice } from '../ClaimedInvoiceNotice';

describe('ClaimedInvoiceNotice', () => {
  // Staff must not only learn that the fund keeps what it received: they need the way to correct it one tap away
  it('says the change is not sent to the fund and links to the batch, the credit note and the rejections', () => {
    render(
      <MemoryRouter>
        <ClaimedInvoiceNotice claim={{ batchId: 'b1', batchNumber: 1042, sentAt: '2026-10-03T10:00:00+02:00' }} invoiceId="inv-1" patientId="pt-1" />
      </MemoryRouter>
    );
    expect(screen.getByText(/Already claimed in batch 1042 on 3 Oct 2026: this change is not sent to the fund/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the batch' })).toHaveAttribute('href', '/finance?tab=batch-management&batch=b1');
    expect(screen.getByRole('link', { name: 'Credit note on the invoice' })).toHaveAttribute('href', '/finance?tab=invoicing&invoice=inv-1');
    expect(screen.getByRole('link', { name: 'Rejections' })).toHaveAttribute('href', '/finance?tab=remittances&section=rejections&patient=pt-1');
  });
});
