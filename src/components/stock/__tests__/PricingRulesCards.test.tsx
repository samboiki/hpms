/**
 * Stock > Settings: the medicine price tiers and the material rule (parity E7, D29). Both stay off until the practice
 * switches them on, so nothing that prices today changes by itself; the NAMAF rule 013 figures are one tap away and the
 * card shows what a material then sells for. Invented figures.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../finance/FinanceUI', () => ({
  SectionCard: ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
    <section aria-label={title}><h3>{title}</h3><p>{subtitle}</p>{children}</section>
  )
}));
const save = vi.hoisted(() => ({ savePricingRules: vi.fn(async () => undefined) }));
vi.mock('../../../services/stock/pricingRulesService', () => save);

import React from 'react';
import { PricingRulesCards, usePricingRulesForm } from '../PricingRulesCards';
import { DEFAULT_STOCK_SETTINGS, type StockSettings } from '../../../utils/stock/stockRows';

const settings = (overrides: Partial<StockSettings> = {}): StockSettings => ({ ...DEFAULT_STOCK_SETTINGS, pricingSetUp: true, ...overrides });

const Harness: React.FC<{ value: StockSettings; dispensing?: boolean }> = ({ value, dispensing = true }) => {
  const form = usePricingRulesForm(value, 'practice-1');
  return (
    <>
      <PricingRulesCards form={form} canEdit dispensing={dispensing} vatRate={15} />
      <output data-testid="changed">{String(form.changed)}</output>
      <output data-testid="problem">{form.problem ?? ''}</output>
    </>
  );
};

describe('PricingRulesCards', () => {
  it('starts with every tier and the material rule off, so nothing is saved unless the practice changes something', () => {
    const { result } = renderHook(() => usePricingRulesForm(settings(), 'practice-1'));
    expect(result.current.changed).toBe(false);
    expect(result.current.rules).toEqual({ tiers: {}, material: null });
  });

  // The figures are the 2025 dental schedule's rule 013: the button says so, so a GP or optometrist checks their own
  it('fills in the NAMAF 2025 dental figures and shows what a N$ 100.00 material sells for', () => {
    render(<Harness value={settings()} />);
    fireEvent.click(screen.getByRole('switch', { name: /Price materials at cost plus a handling fee/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fill in the NAMAF 2025 dental figures' }));
    expect(screen.getByLabelText('Cost limit (N$)')).toHaveValue('4240.20');
    expect(screen.getByText(/sells for/).textContent).toContain('N$ 155.25');
    expect(screen.getByTestId('changed')).toHaveTextContent('true');
  });

  it('shows the medicine tiers only to a practice that dispenses', () => {
    const { rerender } = render(<Harness value={settings()} dispensing={false} />);
    expect(screen.queryByRole('region', { name: 'Medicine price tiers' })).not.toBeInTheDocument();
    rerender(<Harness value={settings()} dispensing />);
    expect(screen.getByRole('region', { name: 'Medicine price tiers' })).toBeInTheDocument();
  });

  it('names the tier to fix instead of saving a different price', () => {
    render(<Harness value={settings()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Staff/ }));
    fireEvent.change(screen.getByLabelText('Markup (%)', { selector: '#stock-tier-staff-markup' }), { target: { value: 'lots' } });
    expect(screen.getByTestId('problem')).toHaveTextContent('Staff: the markup is a percentage');
  });

  it('cannot be changed before the database update, and says why', () => {
    render(<Harness value={settings({ pricingSetUp: false })} />);
    expect(screen.getAllByText(/Not set up in this database yet/).length).toBeGreaterThan(0);
    expect(screen.getByRole('switch', { name: /Price materials/ })).toBeDisabled();
  });
});
