/**
 * Using a saved code bundle that holds a NAMAF code with no fixed amount (priced by rule, at cost or by arrangement; most of
 * the optometry lens catalogue). Why: the bundle used to add the lens at N$ 0.00 with a warning toast that is easy to miss, so
 * the practice could give it away. Now the bundle asks for the amount first, the same way "Add a service" on a visit and the
 * quote editor do, and adds nothing until it is a real amount. Invented practice, codes and amounts.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import BundleMenu from '../BundleMenu';
import type { CodeBundle } from '../bundles';
import type { ServiceSelection } from '../../../types/billing';
import { tariff } from './quoteTestTariffs';

const { loadBundles } = vi.hoisted(() => ({ loadBundles: vi.fn() }));
vi.mock('../quoteService', () => ({
  loadBundles,
  isQuotesNotEnabledError: () => false,
  loadBundleExtrasEnabled: () => Promise.resolve(true),
  saveBundle: vi.fn(),
  deleteBundle: vi.fn()
}));
vi.mock('../../../services/invoicingSetup', () => ({
  loadInvoicingSetup: () => Promise.resolve({ lineDetails: true, createdBy: true, audit: true, lineCodes: true, linePortions: true })
}));
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

const tariffs = [
  tariff('0190', '520.00', { description: 'Consultation at the rooms' }),
  tariff('NP85CZ03D', '0', { description: 'ZEISS officelens Individual 1.5 BlueGuard', no_fixed_amount: true })
];
const bundle = (name: string, lensFee?: number): CodeBundle => ({
  id: crypto.randomUUID(),
  practiceId: 'practice-1',
  name,
  colour: 'cyan',
  description: null,
  sortOrder: 0,
  presetKey: null,
  updatedAt: null,
  lines: [
    { code: '0190', quantity: 1, tooth: null, notes: null },
    { code: 'NP85CZ03D', quantity: 1, tooth: null, notes: null, ...(lensFee !== undefined ? { fee: lensFee } : {}) }
  ]
});

const openBundle = async (name: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name: /code bundles/i }));
  fireEvent.click(await screen.findByRole('button', { name }));
};
const lensAmount = () => screen.getByLabelText('Amount per unit (N$) for NP85CZ03D');
const addButton = () => screen.getByRole('button', { name: /add the lines/i });

beforeEach(() => {
  loadBundles.mockReset();
  [toasts.toast, toasts.toast.error, toasts.toast.success].forEach(fn => fn.mockReset());
});

describe('a bundle with a lens that has no fixed amount', () => {
  it('is offered with "Asks for an amount" and not as a code that "cannot be billed"', async () => {
    loadBundles.mockResolvedValue([bundle('Spectacles')]);
    render(<BundleMenu practiceId="practice-1" practiceType="optometry" tariffs={tariffs} lines={[]} hasMedicalAid={false} autoInfectionControl={false} onApply={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /code bundles/i }));
    const card = await screen.findByRole('button', { name: /Spectacles/ });
    expect(card).toHaveTextContent('Asks for an amount');
    expect(card).not.toHaveTextContent(/cannot be billed/);
  });

  it('adds nothing until a real amount is typed, then adds the lens at that amount with the other lines', async () => {
    loadBundles.mockResolvedValue([bundle('Spectacles')]);
    const onApply = vi.fn();
    render(<BundleMenu practiceId="practice-1" practiceType="optometry" tariffs={tariffs} lines={[]} hasMedicalAid={false} autoInfectionControl={false} onApply={onApply} />);
    await openBundle(/Spectacles/);

    // The bundle waits for the amount: nothing was added by choosing it
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByText(/no fixed amount for this code/)).toBeInTheDocument();
    expect(addButton()).toBeDisabled();

    // N$ 0, words and an empty box are not amounts: the lens must never go on the bill for nothing
    fireEvent.change(lensAmount(), { target: { value: '0' } });
    expect(screen.getByText(/Enter the amount in N\$/)).toBeInTheDocument();
    expect(addButton()).toBeDisabled();
    fireEvent.change(lensAmount(), { target: { value: 'free' } });
    expect(addButton()).toBeDisabled();

    fireEvent.change(lensAmount(), { target: { value: 'N$ 1,250.50' } });
    expect(addButton()).not.toBeDisabled();
    fireEvent.click(addButton());

    expect(onApply).toHaveBeenCalledTimes(1);
    const lines: ServiceSelection[] = onApply.mock.calls[0][0];
    expect(lines.map(item => [item.code, item.unitPrice])).toEqual([['0190', 520], ['NP85CZ03D', 1250.5]]);
    expect(toasts.toast.error).not.toHaveBeenCalled();
  });

  it("does not ask when the bundle line has a fee of its own, and bills the lens at that fee in one click", async () => {
    loadBundles.mockResolvedValue([bundle('Spectacles at our fee', 900)]);
    const onApply = vi.fn();
    render(<BundleMenu practiceId="practice-1" practiceType="optometry" tariffs={tariffs} lines={[]} hasMedicalAid={false} autoInfectionControl={false} onApply={onApply} />);
    await openBundle(/Spectacles at our fee/);

    expect(screen.queryByLabelText('Amount per unit (N$) for NP85CZ03D')).not.toBeInTheDocument();
    expect(onApply).toHaveBeenCalledTimes(1);
    const lines: ServiceSelection[] = onApply.mock.calls[0][0];
    expect(lines.map(item => [item.code, item.unitPrice])).toEqual([['0190', 520], ['NP85CZ03D', 900]]);
  });
});
