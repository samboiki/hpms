/**
 * Linked codes in the quote editor (parity D13): staff building a quote get the codes the practice linked to a code,
 * as on a visit, see them before saving and can take them off again. Invented practice, patient and prices.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { NO_CODE_RULES } from '../../../utils/billing/codeRules';
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

beforeEach(() => {
  [toasts.toast, toasts.toast.error, toasts.toast.success].forEach(fn => fn.mockReset());
  stubs.loadTariffSet.mockResolvedValue({
    practiceId: 'practice-1',
    practiceType: 'General Practice',
    // A procedure the practice links its dressing to (twice), and the dressing
    rows: [row('0300', '400.00', { code_rules: { ...NO_CODE_RULES, linkedCodes: [{ code: '0201', quantity: 2 }] } }), row('0201', '35.50')],
    book: EMPTY_PRICE_BOOK,
    bookError: null,
    infectionControlStaff: 1
  });
  stubs.loadPatientFund.mockResolvedValue({ hasMedicalAid: false, fundName: null, scheme: null, membershipNumber: null, pricingFund: null, ratesError: null });
});

const addCode = async (code: string) => {
  fireEvent.change(await screen.findByLabelText('Search the tariff list'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${code}`) }));
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
};

describe('the quote editor adds the practice linked codes', () => {
  it('adds the linked code with the code, says so, and removing the code before saving takes it away', async () => {
    render(<QuoteEditor isOpen onClose={() => undefined} practiceId="practice-1" patient={{ id: 'patient-1', name: 'Anna Example', phone: null, email: null }} onSaved={() => undefined} />);
    await addCode('0300');

    const lines = screen.getAllByRole('listitem').filter(item => within(item).queryByRole('button', { name: /^Remove / }));
    expect(lines.map(item => within(item).getByText(/^0\d{3}$/).textContent)).toEqual(['0300', '0201']);
    expect(within(lines[1]).getByText('Added with 0300')).toBeInTheDocument();
    expect(toasts.toast).toHaveBeenCalledWith('Also added: 0201 x2 with 0300. Remove any you do not need before saving.', expect.anything());

    fireEvent.click(screen.getByRole('button', { name: 'Remove 0300' }));
    expect(screen.queryByText('Added with 0300')).not.toBeInTheDocument();
    expect(screen.getByText('No codes yet. Search a code above or add a code bundle.')).toBeInTheDocument();
  });
});
