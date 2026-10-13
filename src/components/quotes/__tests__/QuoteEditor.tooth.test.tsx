/**
 * The Tooth field in the quote editor: dental practices quote per tooth, every other discipline (GP, specialist,
 * optometrist) never bills a tooth, so their staff are not shown a dental field. Invented practice, patient and prices.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EMPTY_PRICE_BOOK } from '../../../utils/billing/fundPricing';

const toasts = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('react-hot-toast', () => toasts);
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('framer-motion', async () => {
  const { createElement, Fragment } = await import('react');
  const animationProps = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'layout']);
  const element = (tag: string) =>
    ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !animationProps.has(key))), children);
  return { motion: { div: element('div') }, AnimatePresence: ({ children }: { children?: React.ReactNode }) => createElement(Fragment, null, children) };
});
// Nothing reaches the database: the tariffs and the patient's fund come from the stubs below
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
const stubs = vi.hoisted(() => ({ loadTariffSet: vi.fn(), loadPatientFund: vi.fn() }));
vi.mock('../quoteService', async () => {
  const actual = await vi.importActual<typeof import('../quoteService')>('../quoteService');
  return {
    ...actual,
    loadTariffSet: stubs.loadTariffSet,
    loadPatientFund: stubs.loadPatientFund,
    loadQuote: vi.fn(),
    saveQuote: vi.fn(),
    loadBundles: () => Promise.resolve([]),
    loadBundleExtrasEnabled: () => Promise.resolve(true)
  };
});

import QuoteEditor from '../QuoteEditor';

const row = (code: string, price: string, extra: Record<string, unknown> = {}) => ({
  id: `t-${code}`,
  code,
  description: `Service ${code}`,
  price,
  can_be_multiplied: 'YES',
  requires_tooth_number: 'NO',
  is_active: true,
  code_rules: null,
  ...extra
});

const practiceWith = (practiceType: string, rows: ReturnType<typeof row>[]) =>
  stubs.loadTariffSet.mockResolvedValue({ practiceId: 'practice-1', practiceType, rows, book: EMPTY_PRICE_BOOK, bookError: null, infectionControlStaff: 1 });

beforeEach(() => {
  [toasts.toast, toasts.toast.error, toasts.toast.success].forEach(fn => fn.mockReset());
  stubs.loadPatientFund.mockResolvedValue({ hasMedicalAid: false, fundName: null, scheme: null, membershipNumber: null, pricingFund: null, ratesError: null });
});

const openEditorAndPick = async (code: string) => {
  render(<QuoteEditor isOpen onClose={() => undefined} practiceId="practice-1" patient={{ id: 'patient-1', name: 'Anna Example', phone: null, email: null }} onSaved={() => undefined} />);
  fireEvent.change(await screen.findByLabelText('Search the tariff list'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${code}`) }));
};

const quotedCodes = () =>
  screen
    .getAllByRole('listitem')
    .filter(item => within(item).queryByRole('button', { name: /^Remove / }))
    .map(item => within(item).getByText(/^\d{4}$/).textContent);

describe('the Tooth field in the quote editor', () => {
  it('is not shown in a GP practice, and a code is still added with its quantity', async () => {
    practiceWith('general_practice', [row('0190', '520.00')]);
    await openEditorAndPick('0190');
    expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Tooth/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(quotedCodes()).toEqual(['0190']);
  });

  // An extraction is quoted for a named tooth: the dental practice keeps the field, and it is required for such a code
  it('is shown in a dental practice, required for a code billed per tooth', async () => {
    practiceWith('dental', [row('8201', '208.20', { requires_tooth_number: 'YES' }), row('8109', '34.40')]);
    await openEditorAndPick('8201');
    const tooth = screen.getByLabelText('Tooth');
    expect(tooth).toHaveAttribute('placeholder', 'Required');

    fireEvent.change(tooth, { target: { value: '46' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    // Infection control comes once with the first code, as on the visit
    expect(quotedCodes()).toEqual(['8109', '8201']);
  });
});
