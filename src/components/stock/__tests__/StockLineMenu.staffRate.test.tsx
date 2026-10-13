/**
 * A patient with a staff price rate (parity R28) gets the practice's staff medicine price when a medicine is added from
 * stock, without anyone remembering to tick it each time; other patients start at the usual medicine price, and staff
 * can still change it per line. Invented practice, item and prices.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ServiceSelection } from '../../../types/billing';
import type { StockItem } from '../../../utils/stock/items';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
// The practice has a staff medicine price (Stock > Settings) and one medicine on the shelf
vi.mock('../useStockSettings', () => ({
  useStockSettings: () => ({ status: 'ready', settings: { pricing: { tiers: { staff: { markupPercent: 10, feeCents: 0 } }, material: null } }, reload: vi.fn() })
}));
const MEDICINE = { id: 'item-1', name: 'Paracetamol 500 mg', category: 'medications', sellingPriceCents: null, unit: 'tablet', isActive: true } as unknown as StockItem;
vi.mock('../../../services/stock/stockService', () => ({
  loadStockItems: () => Promise.resolve({ items: [MEDICINE], levels: new Map([['item-1', { onHand: 100 }]]) })
}));
vi.mock('../stockContext', () => ({ priceOf: () => null }));
vi.mock('../ItemPicker', () => ({
  ItemPicker: ({ items, onChange }: { items: StockItem[]; onChange: (item: StockItem) => void }) => (
    <button type="button" onClick={() => onChange(items[0])}>
      Pick the medicine
    </button>
  )
}));
vi.mock('../../patientLists/ListSheet', () => ({
  ListSheet: ({ open, children, footer }: { open: boolean; children: React.ReactNode; footer: React.ReactNode }) =>
    open ? (
      <div role="dialog">
        {children}
        {footer}
      </div>
    ) : null
}));

import { StockLineMenu } from '../StockLineMenu';

const LINES: ServiceSelection[] = [];

const openWithMedicine = async (staffPatient?: boolean) => {
  render(<StockLineMenu practiceId="practice-1" lines={LINES} hasMedicalAid={false} disabledReason={null} onApply={vi.fn()} staffPatient={staffPatient} />);
  fireEvent.click(await screen.findByRole('button', { name: /From stock/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Pick the medicine' }));
  return screen.getByRole('checkbox', { name: /Staff price/ });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the staff medicine price', () => {
  it('starts ticked for a patient with a staff rate, and staff can untick it', async () => {
    const staffPrice = await openWithMedicine(true);
    expect(staffPrice).toBeChecked();
    fireEvent.click(staffPrice);
    expect(staffPrice).not.toBeChecked();
  });

  it('starts unticked for every other patient', async () => {
    expect(await openWithMedicine()).not.toBeChecked();
  });
});
