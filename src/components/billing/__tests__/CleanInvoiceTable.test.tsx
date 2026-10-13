import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import toast from 'react-hot-toast';
import CleanInvoiceTable from '../CleanInvoiceTable';

type QueryResult = { data: unknown; error: { message: string } | null };

// Each table answers with a canned result: nothing here reaches the database
const { results } = vi.hoisted(() => ({ results: {} as Record<string, QueryResult> }));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        order: () => query,
        then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(results[table]).then(onFulfilled, onRejected)
      };
      return query;
    }
  }
}));
vi.mock('../../../utils/invoiceLock', () => ({ INVOICE_LOCK_MESSAGES: {}, loadInvoiceLock: vi.fn() }));
vi.mock('../../modals/PrintStatementModal', () => ({ default: () => null }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('framer-motion', async () => {
  const { createElement, Fragment } = await import('react');
  const animationProps = new Set(['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layout']);
  const element = (tag: string) =>
    ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !animationProps.has(key))), children);
  return {
    motion: { div: element('div') },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => createElement(Fragment, null, children)
  };
});

const invoiceRow = (id: string, total: number, paymentStatus: string, createdAt: string) => ({
  id,
  invoice_number: `INV-${id}`,
  visit_id: `visit-${id}`,
  payment_status: paymentStatus,
  payment_method: null,
  total,
  created_at: createdAt
});

const answerWith = (invoices: ReturnType<typeof invoiceRow>[]) => {
  results.invoices_enhanced = { data: invoices, error: null };
  results.visits = { data: [], error: null };
  results.invoice_services = { data: [], error: null };
};

// A stat card's amount is the element right after its label
const statAmount = (label: string) => screen.getByText(label).nextElementSibling?.textContent;

const renderTable = () => render(<CleanInvoiceTable patientId="patient-1" />);

describe('CleanInvoiceTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    answerWith([]);
  });

  // Cancelling tells staff the invoice "no longer counts as billed or owed", so the total must agree
  it('leaves cancelled invoices out of Total Invoiced', async () => {
    answerWith([
      invoiceRow('1', 100, 'pending', '2026-10-02T08:00:00Z'),
      invoiceRow('2', 50, 'cancelled', '2026-10-01T08:00:00Z')
    ]);
    renderTable();

    await waitFor(() => expect(screen.getByText('#INV-1')).toBeInTheDocument());
    expect(statAmount('Total Invoiced')).toBe('N$ 100.00');
  });

  // 0.70 + 0.20 + 0.10 is 0.9999999999999999 in floating point; splitting that with Math.floor put
  // N$ 0.00 on the card, a whole N$ 1 short
  it('rounds card totals to the cent before splitting dollars and cents', async () => {
    answerWith([
      invoiceRow('a', 0.7, 'pending', '2026-10-03T08:00:00Z'),
      invoiceRow('b', 0.2, 'pending', '2026-10-02T08:00:00Z'),
      invoiceRow('c', 0.1, 'pending', '2026-10-01T08:00:00Z')
    ]);
    renderTable();

    await waitFor(() => expect(screen.getByText('#INV-a')).toBeInTheDocument());
    expect(statAmount('Total Invoiced')).toBe('N$ 1.00');
  });

  // Namibian staff read dates day-first; "Oct 02, 2026" was the US order
  it('shows invoice dates day-first and amounts as N$ with thousands separators', async () => {
    answerWith([invoiceRow('1', 1234.5, 'pending', '2026-10-02T08:00:00Z')]);
    renderTable();

    expect(await screen.findByText('02 Oct 2026')).toBeInTheDocument();
    // In the invoice's own row (the figures above the table show the same format)
    const row = screen.getByText('02 Oct 2026').closest('tr') as HTMLElement;
    expect(within(row).getByText('N$ 1,234.50')).toBeInTheDocument();
  });

  // A failed load showed "No invoices found" and N$ 0.00 totals, which reads as "owes nothing"
  it('says the invoices could not be loaded, and loads them on Try again', async () => {
    results.invoices_enhanced = { data: null, error: { message: 'network down' } };
    renderTable();

    expect(await screen.findByText("Could not load this patient's invoices.")).toBeInTheDocument();
    expect(screen.queryByText(/No invoices yet/)).not.toBeInTheDocument();
    expect(statAmount('Total Invoiced')).toBe('—');
    expect(toast.error).toHaveBeenCalled();

    answerWith([invoiceRow('1', 100, 'pending', '2026-10-02T08:00:00Z')]);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByText('#INV-1')).toBeInTheDocument());
    expect(statAmount('Total Invoiced')).toBe('N$ 100.00');
  });

  // Invoices still list when their services fail to load, but staff are told; otherwise every
  // invoice silently read "0 services"
  it('warns when the services on the invoices could not be loaded', async () => {
    answerWith([invoiceRow('1', 100, 'pending', '2026-10-02T08:00:00Z')]);
    results.invoice_services = { data: null, error: { message: 'timeout' } };
    renderTable();

    await waitFor(() => expect(screen.getByText('#INV-1')).toBeInTheDocument());
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('could not be loaded'));
  });

  // An empty list should tell staff how invoices get there
  it('explains how invoices are created when the patient has none', async () => {
    renderTable();

    expect(await screen.findByText(/No invoices yet\. An invoice is created when a visit is saved/)).toBeInTheDocument();
  });
});
