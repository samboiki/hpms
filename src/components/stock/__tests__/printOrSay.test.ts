import { afterEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast }));

import { printOrSay } from '../stockUi';

const report = { title: 'Stock valuation', basis: 'As at 13 Oct 2026', columns: [{ header: 'Item', type: 'text' as const }], rows: [['Example item']] };

afterEach(() => {
  vi.restoreAllMocks();
  toast.error.mockReset();
});

describe('printing a Stock report', () => {
  // The register, count sheet, variance and valuation prints did nothing at all when the browser blocked the window
  it('says so when the browser blocks the print window', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(printOrSay(report, 'Example Practice')).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('The print window was blocked. Allow pop-ups for this site and try again.');
  });

  it('prints quietly when the window opens', () => {
    const printWindow = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(printWindow as unknown as Window);
    expect(printOrSay(report, 'Example Practice')).toBe(true);
    expect(printWindow.print).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
