import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// The invoice's relations as the database would answer them: two remittance lines (fund answers), nothing else
vi.mock('../../../lib/supabase', () => {
  const query = (table: string): unknown =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'then'
            ? (resolve: (value: unknown) => unknown) =>
                Promise.resolve(table === 'remittance_lines' ? { data: null, error: null, count: 2 } : { data: [], error: null, count: 0 }).then(resolve)
            : () => query(table)
      }
    );
  return { supabase: { from: (table: string) => query(table) } };
});
vi.mock('../../../services/invoicingSetup', () => ({ loadInvoicingSetup: async () => ({ audit: false }) }));
vi.mock('../../../services/invoiceDocumentService', () => ({ downloadInvoicePdf: vi.fn() }));
vi.mock('../../dental/TeethChartLink', () => ({ default: () => null }));
vi.mock('../../finance/practiceReports/ClaimLineStorySheet', () => ({
  ClaimLineListSheet: ({ title, filter }: { title: string; filter: { invoiceId: string } }) => (
    <div role="dialog" aria-label={title}>
      Claim lines of {filter.invoiceId}
    </div>
  )
}));

import InvoiceRelations from '../InvoiceRelations';

afterEach(cleanup);

describe("an invoice's fund answers", () => {
  // "Fund answers (2)" opened Remittances on its import screen, where nothing about this invoice shows
  it("open this invoice's claim lines with what each fund answered", async () => {
    render(
      <MemoryRouter>
        <InvoiceRelations invoice={{ id: 'inv-1', invoiceNumber: 'INV-000042', patientId: 'patient-1', visitId: null, batchId: null }} />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: /Fund answers \(2\)/ }));
    expect(screen.getByRole('dialog', { name: 'What the funds answered on INV-000042' })).toHaveTextContent('Claim lines of inv-1');
  });
});
