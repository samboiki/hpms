import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { StockContext } from '../stockContext';

// No medicines dispensed yet in this invented practice
vi.mock('../../../services/stock/stockService', () => ({
  loadDispensings: vi.fn(async () => []),
  loadBilledStockByVisit: vi.fn(async () => new Map()),
  loadPatientNames: vi.fn(async () => new Map())
}));

import { DispensingReport } from '../DispensingReport';

afterEach(cleanup);

describe('Stock > Reports > Dispensing', () => {
  // The repeats view pointed at "Messages > Lists" in words only: the list that messages these patients is one tap away
  it('links to Messages > Lists, where the repeat medicine list is made', async () => {
    render(
      <MemoryRouter>
        <DispensingReport context={{ practiceId: 'practice-1' } as unknown as StockContext} />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByRole('button', { name: /Repeats due this week/ }));
    expect(screen.getByRole('link', { name: 'Messages > Lists' })).toHaveAttribute('href', '/communications?tab=lists');
  });
});
