/**
 * From a quote back to the patient (bi-directional links): the patient's name in the quote viewer opens the patient's
 * file, and the quote closes on the way so the file is not hidden behind it. Invented quote and patient.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toQuoteRecord } from '../quotes';

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('../../modals/FormModal', () => ({
  default: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null
}));
vi.mock('../../dental/TeethChartLink', () => ({ default: () => null }));
vi.mock('../../patients/registers/AuthorisationSheet', () => ({ default: () => null }));
vi.mock('../QuoteConvert', () => ({ default: () => null }));
vi.mock('../QuoteSend', () => ({ QuoteEmailPanel: () => null, QuoteSmsPanel: () => null }));
vi.mock('../../../services/fundPricingService', () => ({ loadPatientFundKey: vi.fn() }));

const quote = toQuoteRecord({
  id: 'quote-1',
  practice_id: 'practice-1',
  patient_id: 'patient-7',
  quote_number: 'Q2026-0042',
  status: 'draft',
  quote_date: '2026-10-07',
  valid_until: '2099-01-05',
  medical_aid_name: null,
  medical_aid_scheme: null,
  membership_number: null,
  estimate_basis: 'private',
  estimate_note: 'Private patient: the patient pays the full amount.',
  preauth_number: null,
  fund_reference: null,
  notes: null,
  subtotal: 520,
  medical_aid_estimate: 0,
  patient_estimate: 520
});

vi.mock('../quoteService', async () => {
  const actual = await vi.importActual<typeof import('../quoteService')>('../quoteService');
  return {
    ...actual,
    loadQuote: () => Promise.resolve({ quote, lines: [] }),
    loadPatientContact: () => Promise.resolve({ firstName: 'Anna', name: 'Anna Example', phone: null, email: null }),
    loadInvoiceNumber: () => Promise.resolve(null)
  };
});

import QuoteViewer from '../QuoteViewer';

const PatientsPage = () => {
  const location = useLocation();
  return <p>Patients page {location.search}</p>;
};

describe("the patient's name on a quote", () => {
  it("opens the patient's file and closes the quote", async () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter initialEntries={['/finance']}>
        <Routes>
          <Route path="/finance" element={<QuoteViewer quoteId="quote-1" onClose={onClose} onEdit={vi.fn()} onChanged={vi.fn()} />} />
          <Route path="/patients" element={<PatientsPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('link', { name: 'Anna Example' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Patients page ?patientId=patient-7&tab=overview')).toBeInTheDocument();
  });
});
