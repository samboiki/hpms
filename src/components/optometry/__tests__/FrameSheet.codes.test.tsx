/**
 * Add a frame to stock: the "Billed under" code. Why it matters to an optometry practice: its price list now holds the
 * whole NAMAF optometrist list (7,168 codes, mostly lens products). A drop-down of all of them cannot be used and makes
 * the sheet slow, so it offers the practice's own codes and the NAMAF frame codes; a frame already billed under another
 * code keeps it. Invented practice and codes.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EMPTY_PRICE_BOOK } from '../../../utils/billing/fundPricing';

vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
const stubs = vi.hoisted(() => ({ loadTariffSet: vi.fn() }));
vi.mock('../../quotes/quoteService', async () => ({ ...(await vi.importActual<typeof import('../../quotes/quoteService')>('../../quotes/quoteService')), loadTariffSet: stubs.loadTariffSet }));
vi.mock('../../../services/stock/stockService', () => ({ loadSuppliers: vi.fn(async () => []) }));
vi.mock('../../../services/optometry/optometryService', () => ({ saveFrame: vi.fn() }));

import FrameSheet from '../FrameSheet';

const row = (code: string, description: string, extra: Record<string, unknown> = {}) => ({
  id: `t-${code}`,
  code,
  description,
  price: 100,
  can_be_multiplied: 'NO',
  requires_tooth_number: 'NO',
  is_active: true,
  effective_from: '2026-01-01',
  effective_to: null,
  ...extra
});
const namaf = (code: string, description: string, price = 0) => row(code, description, { price, namaf: { discipline: '070', tariffCode: code, validFrom: '2026-01-01', validTo: '2026-12-31' }, no_fixed_amount: price === 0 });

const rows = [
  row('FR1', 'Our own frame code', { is_own: true }),
  namaf('NA70405', 'FRAME'),
  namaf('NA61001', 'RE-EDGE - ZYL OR METAL FRAME', 212.58),
  namaf('NP85CZ03D', 'ZEISS officelens Individual 1.5 BlueGuard'),
  namaf('NA61122', 'SINGLE VISION STANDARD GLASS LENS', 274.81)
];

beforeEach(() => {
  stubs.loadTariffSet.mockResolvedValue({ practiceId: 'practice-1', practiceType: 'optometry', rows, book: EMPTY_PRICE_BOOK, bookError: null, infectionControlStaff: 1 });
});

describe('the code a frame is billed under', () => {
  it("offers the practice's own codes and the NAMAF frame codes, not the discipline's lens catalogue", async () => {
    render(<FrameSheet open practiceId="practice-1" onClose={() => undefined} onSaved={() => undefined} />);
    const select = await screen.findByRole('combobox', { name: /Billed under/ });
    await within(select).findByRole('option', { name: /^NA70405/ });
    expect(within(select).getAllByRole('option').map(option => option.textContent)).toEqual([
      'Not chosen yet',
      'FR1 · Our own frame code',
      'NA61001 · RE-EDGE - ZYL OR METAL FRAME',
      'NA70405 · FRAME'
    ]);
  });

  it('keeps the code of a frame that is already billed under another code', async () => {
    const frame = {
      item: { id: 'item-1', name: 'Example Frame', barcode: null, tariffCode: 'NP85CZ03D', sellingPriceCents: 150000, unitCostCents: 80000, preferredSupplierId: null, location: null, notes: null },
      details: { brand: 'Example', model: 'One', colour: null, size: null },
      consignment: null,
      inLedger: false
    };
    render(<FrameSheet open practiceId="practice-1" frame={frame as never} onClose={() => undefined} onSaved={() => undefined} />);
    const select = await screen.findByRole('combobox', { name: /Billed under/ });
    await within(select).findByRole('option', { name: /^NA70405/ });
    expect(within(select).getByRole('option', { name: 'NP85CZ03D' })).toBeInTheDocument();
    expect(select).toHaveValue('NP85CZ03D');
  });
});
