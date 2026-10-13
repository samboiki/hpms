import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BundleMenu from '../BundleMenu';
import type { CodeBundle } from '../bundles';
import { addTariffLines } from '../billingLines';
import type { ServiceSelection } from '../../../types/billing';
import { dentalTariffs } from './quoteTestTariffs';

// The bundles come from a stub: nothing here reaches the database
const { loadBundles, notEnabled } = vi.hoisted(() => {
  class NotEnabled extends Error {}
  return { loadBundles: vi.fn(), notEnabled: NotEnabled };
});
vi.mock('../quoteService', () => ({
  loadBundles,
  isQuotesNotEnabledError: (error: unknown) => error instanceof notEnabled,
  loadBundleExtrasEnabled: () => Promise.resolve(true),
  saveBundle: vi.fn(),
  deleteBundle: vi.fn()
}));
// Invoice lines can keep an authorisation number (the line-portions update is applied)
vi.mock('../../../services/invoicingSetup', () => ({
  loadInvoicingSetup: () => Promise.resolve({ lineDetails: true, createdBy: true, audit: true, lineCodes: true, linePortions: true })
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('framer-motion', async () => {
  const { createElement, Fragment } = await import('react');
  const animationProps = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'layout']);
  const element = (tag: string) =>
    ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !animationProps.has(key))), children);
  return { motion: { div: element('div') }, AnimatePresence: ({ children }: { children?: React.ReactNode }) => createElement(Fragment, null, children) };
});

const tariffs = dentalTariffs();
const bundle = (name: string, codes: string[]): CodeBundle => ({
  id: crypto.randomUUID(),
  practiceId: 'practice-1',
  name,
  colour: 'cyan',
  description: null,
  sortOrder: 0,
  presetKey: null,
  updatedAt: null,
  lines: codes.map(code => ({ code, quantity: 1, tooth: null, notes: null }))
});

/** A visit that already has an anaesthetic (and its 8109) */
const visitWithAnaesthetic = (): ServiceSelection[] => {
  const outcome = addTariffLines([], { code: '8145', quantity: 1 }, { tariffs, hasMedicalAid: true, autoInfectionControl: true });
  if (outcome.status !== 'added') throw new Error('setup failed');
  return outcome.lines;
};

const open = () => fireEvent.click(screen.getByRole('button', { name: /code bundles/i }));

beforeEach(() => {
  loadBundles.mockReset();
});

// Business rule: on a visit, a bundle is one click; codes the fund pays once per visit are not added a
// second time, and every line is priced from the tariffs for the visit date.
describe('BundleMenu on the visit billing tab', () => {
  it('adds a bundle in one click without repeating the per-visit codes the visit already has', async () => {
    loadBundles.mockResolvedValue([bundle('Filling prep', ['8145', '8110', '8104'])]);
    const onApply = vi.fn();
    const existing = visitWithAnaesthetic();
    render(<BundleMenu practiceId="practice-1" tariffs={tariffs} lines={existing} hasMedicalAid onApply={onApply} />);

    open();
    fireEvent.click(await screen.findByRole('button', { name: /Filling prep/ }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const lines: ServiceSelection[] = onApply.mock.calls[0][0];
    expect(lines.map(line => line.code)).toEqual(['8109', '8145', '8110', '8104']);
    expect(lines.slice(0, 2)).toEqual(existing);
    expect(lines.find(line => line.code === '8104')).toMatchObject({ unitPrice: 137.4, totalPrice: 137.4, medicalAidCovered: true });
  });

  it('asks for the tooth of a tooth code and adds nothing until it is a valid FDI number', async () => {
    loadBundles.mockResolvedValue([bundle('Extraction', ['8145', '8201'])]);
    const onApply = vi.fn();
    render(<BundleMenu practiceId="practice-1" tariffs={tariffs} lines={[]} hasMedicalAid={false} onApply={onApply} />);

    open();
    fireEvent.click(await screen.findByRole('button', { name: /Extraction/ }));
    const add = screen.getByRole('button', { name: /add the lines/i });
    expect(add).toBeDisabled();

    const tooth = screen.getByPlaceholderText('e.g. 36');
    fireEvent.change(tooth, { target: { value: '19' } });
    expect(screen.getByText(/Use an FDI tooth number/)).toBeInTheDocument();
    expect(add).toBeDisabled();

    fireEvent.change(tooth, { target: { value: '48' } });
    fireEvent.click(add);
    const lines: ServiceSelection[] = onApply.mock.calls[0][0];
    expect(lines.find(line => line.code === '8201')?.teethNumbers).toEqual(['48']);
  });

  // Parity D12: the fund wants its authorisation number on the claim lines of some procedures; the bundle asks for it
  // once and puts it on every line it adds, and nothing is added without it
  it('asks for the authorisation number of a bundle that needs one and puts it on every line it adds', async () => {
    loadBundles.mockResolvedValue([{ ...bundle('Surgery', ['8104', '8131']), needsAuthorisation: true }]);
    const onApply = vi.fn();
    render(<BundleMenu practiceId="practice-1" tariffs={tariffs} lines={[]} hasMedicalAid askAuthorisation onApply={onApply} />);
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Surgery/ }));
    const add = await screen.findByRole('button', { name: /add the lines/i });
    await waitFor(() => expect(add).toBeDisabled());
    fireEvent.change(screen.getByPlaceholderText('For example: 123456'), { target: { value: 'A,1' } });
    expect(screen.getByText(/no spaces or commas/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('For example: 123456'), { target: { value: ' PA-77 ' } });
    await waitFor(() => expect(add).not.toBeDisabled());
    fireEvent.click(add);
    const lines: ServiceSelection[] = onApply.mock.calls[0][0];
    expect(lines.map(line => line.code)).toEqual(['8109', '8104', '8131']);
    lines.forEach(line => expect(line.authorisationNumber).toBe('PA-77'));
  });

  // A private patient has no fund to authorise anything, and a quote keeps its own pre-authorisation number
  it('does not ask a private patient, or on a quote, for an authorisation number', async () => {
    loadBundles.mockResolvedValue([{ ...bundle('Surgery', ['8104']), needsAuthorisation: true }]);
    const onApply = vi.fn();
    render(<BundleMenu practiceId="practice-1" tariffs={tariffs} lines={[]} hasMedicalAid onApply={onApply} />);
    open();
    fireEvent.click(await screen.findByRole('button', { name: /Surgery/ }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect((onApply.mock.calls[0][0] as ServiceSelection[]).every(line => line.authorisationNumber === undefined)).toBe(true);
  });

  it('says quotes are not switched on when the bundle tables are missing, and changes nothing', async () => {
    loadBundles.mockRejectedValue(new notEnabled('missing'));
    const onApply = vi.fn();
    render(<BundleMenu practiceId="practice-1" tariffs={tariffs} lines={[]} hasMedicalAid onApply={onApply} />);
    open();
    expect(await screen.findByText('Quotes are not switched on yet')).toBeInTheDocument();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('cannot be used before the tariff list has loaded, because nothing could be priced', async () => {
    render(<BundleMenu practiceId="practice-1" tariffs={[]} lines={[]} hasMedicalAid onApply={vi.fn()} />);
    const button = screen.getByRole('button', { name: /code bundles/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', expect.stringMatching(/tariff list has not loaded/));
    await waitFor(() => expect(loadBundles).not.toHaveBeenCalled());
  });
});
