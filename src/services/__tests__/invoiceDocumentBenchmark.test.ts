/**
 * The invoice's benchmark statement ("charged at the NAMAF benchmark tariff", NAMAF rule 008) compares each billed price
 * with the practice's price list on the service date. Why it matters: a GP or optometry practice now prices from the NAMAF
 * list, so its invoices must say they are charged at the benchmark; a code with no fixed amount (priced by rule or at
 * cost) has no benchmark to differ from; and when the list cannot be read the statement must say it was not compared
 * rather than claim a match. Invented codes, amounts and practice.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvoiceDocumentLine } from '../../components/billing/invoiceDocument';
import { benchmarkStatement } from '../../components/billing/invoiceDocument';
import { namafRowsAsTariffs, type NamafTariffRow } from '../../utils/billing/namafTariffs';

const stubs = vi.hoisted(() => ({ shared: { data: [] as unknown[], error: null as { message: string } | null }, namaf: vi.fn() }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      const builder: Record<string, unknown> = {};
      ['select', 'eq'].forEach(method => {
        builder[method] = () => builder;
      });
      builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(stubs.shared).then(resolve);
      return builder;
    }
  }
}));
vi.mock('../namafTariffService', () => ({ loadPracticeNamaf: stubs.namaf }));

import { offBenchmarkCodes } from '../invoiceDocumentService';

const nam = (code: string, amount: number | null): NamafTariffRow => ({
  id: `n-${code}`,
  discipline_code: '014',
  tariff_code: `0${code}`,
  code,
  description: `Invented ${code}`,
  amount,
  units: 1,
  valid_from: '2026-01-01',
  valid_to: '2026-12-31'
});
const ready = (...rows: NamafTariffRow[]) => ({ status: 'ready', discipline: '014', chosen: false, typeDiscipline: '014', tariffs: namafRowsAsTariffs(rows) });
const line = (code: string, unitPrice: number): InvoiceDocumentLine => ({ code, unitPrice, serviceDate: '2026-10-14' }) as InvoiceDocumentLine;

beforeEach(() => {
  stubs.shared = { data: [], error: null };
  stubs.namaf.mockReset();
});

describe('which invoice lines are charged at another price than the benchmark', () => {
  it('lets a practice without a shared list (a GP) compare with the NAMAF list, flagging only the lines billed at another price', async () => {
    stubs.namaf.mockResolvedValue(ready(nam('0190', 521.4), nam('0191', 600)));
    const off = await offBenchmarkCodes('practice-1', 'medical', [line('0190', 521.4), line('0191', 450)], '2026-10-14');
    expect(off).toEqual(['0191']);
    expect(benchmarkStatement([], 'medical')).toContain('charged at the NAMAF benchmark tariff');
  });

  it('does not flag a code the list has no fixed amount for: there is no benchmark to differ from', async () => {
    stubs.namaf.mockResolvedValue(ready(nam('0201', null), nam('0190', 521.4)));
    expect(await offBenchmarkCodes('practice-1', 'medical', [line('0201', 1250), line('0190', 521.4)], '2026-10-14')).toEqual([]);
  });

  it('says it could not compare when the NAMAF list could not be read, instead of claiming the fees match', async () => {
    stubs.namaf.mockResolvedValue({ status: 'error', discipline: '014', chosen: false, typeDiscipline: '014', tariffs: [], message: 'down' });
    expect(await offBenchmarkCodes('practice-1', 'medical', [line('0190', 521.4)], '2026-10-14')).toBeNull();
    expect(benchmarkStatement(null, 'medical')).toBe('Fees: not compared with the NAMAF benchmark tariff.');
  });

  it('says it could not compare when the shared list could not be read', async () => {
    stubs.shared = { data: [], error: { message: 'down' } };
    stubs.namaf.mockResolvedValue(ready(nam('0190', 521.4)));
    expect(await offBenchmarkCodes('practice-1', 'medical', [line('0190', 521.4)], '2026-10-14')).toBeNull();
  });
});
