import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import EnhancedDentalServiceSelector from '../EnhancedDentalServiceSelector';
import { findInvoiceLineProblems } from '../../../services/invoiceService';
import type { ServiceSelection } from '../../../types/billing';

// The tariff list comes from a stub and invoiceService is only used for its line check: nothing here
// reaches the database
const { tariffs } = vi.hoisted(() => ({
  tariffs: [
    { id: crypto.randomUUID(), code: '8109', description: 'Infection control', price: 52.3, can_be_multiplied: 'NO', requires_tooth_number: 'NO' },
    { id: crypto.randomUUID(), code: '8341', description: 'Amalgam restoration', price: 373.9, can_be_multiplied: 'YES', requires_tooth_number: 'NO' },
    { id: crypto.randomUUID(), code: '8340', description: 'Progressive procedure', price: 254.7, can_be_multiplied: 'PROGRESSIVE', requires_tooth_number: 'NO' },
    { id: crypto.randomUUID(), code: '8346', description: 'Restorative material', price: 0, can_be_multiplied: 'NO', requires_tooth_number: 'NO' }
  ]
}));

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../contexts/PracticeTariffsContext', () => ({
  usePracticeTariffs: () => ({ allTariffs: tariffs, frequentTariffs: tariffs, isLoading: false, error: null, excludedCount: 0 })
}));
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');
  const animationProps = new Set(['whileHover', 'whileTap', 'layout']);
  const element = (tag: string) =>
    ({ children, ...props }: Record<string, unknown> & { children?: React.ReactNode }) =>
      createElement(tag, Object.fromEntries(Object.entries(props).filter(([key]) => !animationProps.has(key))), children);
  return { motion: { div: element('div'), button: element('button') } };
});

let services: ServiceSelection[] = [];

const Harness = () => {
  const [selected, setSelected] = useState<ServiceSelection[]>([]);
  services = selected;
  return <EnhancedDentalServiceSelector selectedServices={selected} onServiceChange={setSelected} />;
};

const line = (code: string) => services.find(service => service.code === code);
const row = (code: string) =>
  screen.getAllByRole('row').find(item => within(item).queryAllByRole('cell')[0]?.textContent?.startsWith(code)) as HTMLElement;
const quantityButtons = (code: string) => {
  const [minus, plus] = within(row(code)).getAllByRole('button');
  return { minus, plus };
};

const renderSelector = async () => {
  render(<Harness />);
  await waitFor(() => expect(line('8109')).toBeDefined());
  fireEvent.click(screen.getByRole('button', { name: 'List' }));
};

describe('EnhancedDentalServiceSelector', () => {
  beforeEach(() => {
    services = [];
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  // Business rule: a restorative procedure billed twice carries its 8346 material line at quantity 2.
  // invoiceService refuses quantity > 1 on a line marked as not multipliable, and the old selector
  // marked 8346 that way while moving its quantity with the procedure, so such invoices were refused.
  it('keeps the 8346 line with its procedure, and the invoice accepts both at quantity 2', async () => {
    await renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /^8341/ }));
    await waitFor(() => expect(line('8346')).toBeDefined());

    fireEvent.click(quantityButtons('8341').plus);

    await waitFor(() => expect(line('8341')).toMatchObject({ quantity: 2, totalPrice: 747.8 }));
    expect(line('8346')).toMatchObject({ quantity: 2, unitPrice: 37.39, totalPrice: 74.78, canBeMultiplied: true });
    expect(findInvoiceLineProblems(services)).toEqual([]);
    // The material line has no quantity of its own: it follows the procedure
    expect(quantityButtons('8346').plus).toBeDisabled();
  });

  // Business rule: SOMETIMES / PROGRESSIVE codes may be billed more than once at unit price x quantity
  // (computeLine flags them for review). The old selector locked them at quantity 1.
  it('lets a progressive code have quantity 2, billed at unit price x quantity', async () => {
    await renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /^8340/ }));
    await waitFor(() => expect(line('8340')).toBeDefined());

    expect(quantityButtons('8340').plus).not.toBeDisabled();
    fireEvent.click(quantityButtons('8340').plus);

    await waitFor(() => expect(line('8340')).toMatchObject({ quantity: 2, totalPrice: 509.4, canBeMultiplied: true }));
    expect(findInvoiceLineProblems(services)).toEqual([]);
  });

  // Business rule: a code billed once per line (can_be_multiplied = NO) stays at quantity 1.
  it('keeps a once-per-line code at quantity 1', async () => {
    await renderSelector();
    expect(quantityButtons('8109').plus).toBeDisabled();
    expect(line('8109')).toMatchObject({ quantity: 1, canBeMultiplied: false });
  });
});
