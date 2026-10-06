import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import Html2CanvasPDF from '../Html2CanvasPDF';

type QueryResult = { data: unknown; error: { message: string } | null };

// Canned query results and a jsPDF stand-in: nothing here reaches the database or writes a file
const { results, eqCalls, pdfText, pdfSave, auth } = vi.hoisted(() => ({
  results: {} as Record<string, QueryResult>,
  eqCalls: [] as Array<[string, string, unknown]>,
  pdfText: vi.fn(),
  pdfSave: vi.fn(),
  auth: {
    user: null as { id: string; practice_id?: string } | null,
    selectedPracticeId: null as string | null
  }
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const query = {
        select: () => query,
        ilike: () => query,
        eq: (column: string, value: unknown) => {
          eqCalls.push([table, column, value]);
          return query;
        },
        single: () => Promise.resolve(results[table] ?? { data: null, error: { message: 'no rows' } }),
        maybeSingle: () => Promise.resolve(results[table] ?? { data: null, error: null })
      };
      return query;
    }
  }
}));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => auth }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('html2canvas', () => ({ default: vi.fn() }));
vi.mock('jspdf', () => ({
  default: class {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
    setFillColor = vi.fn();
    rect = vi.fn();
    setFontSize = vi.fn();
    setTextColor = vi.fn();
    setFont = vi.fn();
    setDrawColor = vi.fn();
    line = vi.fn();
    addPage = vi.fn();
    text = pdfText;
    save = pdfSave;
  }
}));

const invoice = {
  id: 'invoice-1',
  invoice_number: 'INV-1',
  visit_id: 'visit-1',
  payment_status: 'pending' as const,
  total: 1234.5,
  created_at: '2026-10-06T08:00:00Z',
  services: [
    {
      id: 'line-1',
      code: '0190',
      description: 'Consultation',
      quantity: 1,
      unit_price: 1234.5,
      total_price: 1234.5,
      medical_aid_covered: 0,
      patient_portion: 1234.5
    }
  ],
  medical_aid_covered: 0,
  patient_portion: 1234.5
};

// country is not set: amounts used to fall back to "$" unless it said "Namibia"
const practiceRow = { id: 'practice-of-invoice', name: 'Practice Of The Invoice', country: null };

const renderPdf = () => render(<Html2CanvasPDF invoice={invoice} patient={{ name: 'Test Patient' }} />);

describe('Html2CanvasPDF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    auth.user = { id: 'user-1', practice_id: 'practice-of-user' };
    auth.selectedPracticeId = 'practice-selected';
    // Not created_at + 30 days, so the test can tell the stored date from a calculated one
    results.invoices_enhanced = { data: { practice_id: 'practice-of-invoice', due_date: '2026-11-20' }, error: null };
    results.practices = { data: practiceRow, error: null };
  });

  // Someone who works at two practices must not print the other practice's name and bank details
  it("uses the invoice's own practice for the letterhead, not the user's", async () => {
    renderPdf();

    expect((await screen.findAllByText('Practice Of The Invoice')).length).toBeGreaterThan(0);
    expect(eqCalls).toContainEqual(['practices', 'id', 'practice-of-invoice']);
  });

  it('falls back to the practice selected in the app when the invoice has none', async () => {
    results.invoices_enhanced = { data: { practice_id: null, due_date: '2026-11-20' }, error: null };
    renderPdf();

    await screen.findAllByText('Practice Of The Invoice');
    expect(eqCalls).toContainEqual(['practices', 'id', 'practice-selected']);
  });

  // The due date was "today + 30 days", so it moved every time the invoice was reprinted
  it('shows the due date stored on the invoice', async () => {
    renderPdf();

    expect(await screen.findByText('20 Nov 2026')).toBeInTheDocument();
  });

  // Money is Namibian dollars: the PDF printed "R" (rand) and the preview "$"
  it('prints and shows amounts as N$', async () => {
    renderPdf();
    fireEvent.click(await screen.findByRole('button', { name: 'Download invoice PDF' }));

    await waitFor(() => expect(pdfSave).toHaveBeenCalledWith('invoice-INV-1.pdf'));
    const printed = pdfText.mock.calls.map(([text]) => String(text));
    expect(printed).toContain('N$ 1,234.50');
    expect(printed.some(text => /^R /.test(text))).toBe(false);
    expect(screen.getAllByText('N$ 1,234.50').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^\$ /)).not.toBeInTheDocument();
  });

  // An error thrown inside the click handler only reached the console: the button looked dead
  it('tells staff when the PDF cannot be created', async () => {
    pdfSave.mockImplementation(() => {
      throw new Error('disk full');
    });
    renderPdf();
    fireEvent.click(await screen.findByRole('button', { name: 'Download invoice PDF' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Could not create the invoice PDF')));
  });

  // With no signed-in user the panel said "Loading practice details..." forever
  it('stops loading and explains the problem when no user is signed in', async () => {
    auth.user = null;
    renderPdf();

    expect(await screen.findByText(/Could not load the practice details needed for this invoice/)).toBeInTheDocument();
  });
});
