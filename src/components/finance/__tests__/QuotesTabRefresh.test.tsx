/**
 * Finance > Quotes: a quote made into an invoice (or otherwise changed in the quote view) is new billing, so the quote
 * list reloads and Finance is told to reload its figures; the patient file's quote list, which has no Finance figures,
 * gives no callback and nothing else happens. Invented data only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
const quotes = vi.hoisted(() => ({ loadQuotes: vi.fn(async () => []) }));
vi.mock('../../quotes/quoteService', async importOriginal => ({
  ...(await importOriginal<typeof import('../../quotes/quoteService')>()),
  loadQuotes: quotes.loadQuotes
}));
// The quote view and editor are tested with the quotes: here the view only reports that it changed something
vi.mock('../../quotes/QuoteViewer', () => ({
  default: ({ onChanged }: { onChanged: () => void }) => <button type="button" onClick={onChanged}>Make it an invoice</button>
}));
vi.mock('../../quotes/QuoteEditor', () => ({ default: () => null }));

import { QuotesTab } from '../../quotes/QuotePanels';

afterEach(() => {
  cleanup();
  quotes.loadQuotes.mockClear();
});

describe('Finance > Quotes after a quote changes', () => {
  it('reloads the quotes and tells Finance to reload its figures', async () => {
    const onChanged = vi.fn();
    render(<QuotesTab practiceId="practice-1" onChanged={onChanged} />, { wrapper: MemoryRouter });
    await waitFor(() => expect(quotes.loadQuotes).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'Make it an invoice' }));

    expect(onChanged).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(quotes.loadQuotes).toHaveBeenCalledTimes(2));
  });
});
