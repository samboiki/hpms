/**
 * Quoting a NAMAF code that has no fixed amount (priced by rule, at cost or by arrangement; most of the optometry lens
 * catalogue). Why: the code must stay selectable, and the quote must carry the amount staff type, never N$ 0.00 that the
 * patient would be quoted for free. Invented practice, patient, codes and amounts.
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
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO',
  is_active: true,
  code_rules: null,
  ...extra
});

const lens = row('NP85CZ03D', '0', { description: 'ZEISS officelens Individual 1.5 BlueGuard', no_fixed_amount: true });
const consult = row('0190', '520.00', { description: 'Consultation at the rooms' });

beforeEach(() => {
  [toasts.toast, toasts.toast.error, toasts.toast.success].forEach(fn => fn.mockReset());
  stubs.loadPatientFund.mockResolvedValue({ hasMedicalAid: false, fundName: null, scheme: null, membershipNumber: null, pricingFund: null, ratesError: null });
  stubs.loadTariffSet.mockResolvedValue({ practiceId: 'practice-1', practiceType: 'optometry', rows: [consult, lens], book: EMPTY_PRICE_BOOK, bookError: null, infectionControlStaff: 1 });
});

const openAndSearch = async (text: string) => {
  render(<QuoteEditor isOpen onClose={() => undefined} practiceId="practice-1" patient={{ id: 'patient-1', name: 'Anna Example', phone: null, email: null }} onSaved={() => undefined} />);
  fireEvent.change(await screen.findByLabelText('Search the tariff list'), { target: { value: text } });
};

const quotedLines = () => screen.getAllByRole('listitem').filter(item => within(item).queryByRole('button', { name: /^Remove / }));

describe('a lens with no fixed amount in the quote editor', () => {
  it('is found by its description, offered without a price of N$ 0.00, and asks for the amount once picked', async () => {
    await openAndSearch('zeiss');
    const match = screen.getByRole('button', { name: /^NP85CZ03D/ });
    expect(match).toHaveTextContent('Amount when quoted');
    expect(match).not.toHaveTextContent('N$ 0.00');
    fireEvent.click(match);
    expect(screen.getByText(/no fixed amount for this code/)).toBeInTheDocument();
    expect(screen.getByLabelText('Amount per unit (N$)')).toBeInTheDocument();
  });

  it('is not added without an amount, and is quoted at the amount typed', async () => {
    await openAndSearch('zeiss');
    fireEvent.click(screen.getByRole('button', { name: /^NP85CZ03D/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(toasts.toast.error).toHaveBeenCalledWith(expect.stringContaining('Enter the amount in N$'));
    expect(screen.queryAllByRole('button', { name: /^Remove / })).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Amount per unit (N$)'), { target: { value: 'N$ 1,250.50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const [line] = quotedLines();
    expect(line).toHaveTextContent('NP85CZ03D');
    expect(line).toHaveTextContent('N$ 1,250.50');
    // The quote total follows, and the lens is not offered a second time with the amount still typed
    expect(screen.getAllByText('N$ 1,250.50').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByLabelText('Amount per unit (N$)')).not.toBeInTheDocument();
  });

  it('does not ask for an amount on a code that has one', async () => {
    await openAndSearch('0190');
    const match = screen.getByRole('button', { name: /^0190/ });
    expect(match).toHaveTextContent('N$ 520.00');
    fireEvent.click(match);
    expect(screen.queryByLabelText('Amount per unit (N$)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(quotedLines()[0]).toHaveTextContent('N$ 520.00');
  });
});
