/**
 * Finance > Ledgers > Inventory: stock is kept on the Stock page now (items, deliveries, stock takes), so "Manage
 * inventory" opens Stock > Items, not the old Settings list that no longer takes quantities, and the ledger says its
 * figures are Stock's own. Invented items only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { valueInventory, type LedgerInventoryItem } from '../../../services/ledgerService';
import { item } from '../../../services/__tests__/ledgerTestUtils';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';

vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { InventoryLedger } from '../ledgers/InventoryLedger';

const labels = { today: '13 Oct 2026', todayKey: '2026-10-13' } as PeriodLabels;
const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;

const renderLedger = (rows: LedgerInventoryItem[]) => {
  const workspace = { inventory: { rows, error: null, source: 'stock_ledger' } } as unknown as FinanceWorkspace;
  const derived = { inventory: valueInventory(rows, labels.todayKey) } as unknown as FinanceDerived;
  render(
    <MemoryRouter initialEntries={['/finance?tab=ledgers&view=inventory']}>
      <Routes>
        <Route path="*" element={<><InventoryLedger derived={derived} workspace={workspace} labels={labels} onRetry={() => undefined} /><Where /></>} />
      </Routes>
    </MemoryRouter>
  );
};

afterEach(cleanup);

describe('Ledgers > Inventory and the Stock page', () => {
  it('"Manage inventory" opens Stock > Items, where items and their stock are kept', () => {
    renderLedger([{ ...item({ id: 'gloves', quantity: 4 }), ledgerValue: 100 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Manage inventory' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/stock?tab=items');
  });

  it('opens an item on the Stock page, where its history shows what came in and went out', () => {
    renderLedger([{ ...item({ id: 'gloves', name: 'Examination gloves', quantity: 4 }), ledgerValue: 100 }]);
    fireEvent.click(screen.getByRole('row', { name: 'Open Examination gloves on the Stock page' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/stock?tab=items&item=gloves');
  });

  it('says its values are the stock ledger\'s, the figures Stock > Reports shows', () => {
    renderLedger([{ ...item({ id: 'gloves', quantity: 4 }), ledgerValue: 100 }]);
    expect(screen.getByText(/stock ledger at the average cost of what is on hand, excluding VAT/)).toBeInTheDocument();
  });

  it('with nothing recorded, points to Stock > Items (not the old Settings list)', () => {
    renderLedger([]);
    expect(screen.getByText(/recorded in Stock > Items/)).toBeInTheDocument();
    expect(screen.queryByText(/Settings > Practice > Inventory/)).toBeNull();
  });
});
