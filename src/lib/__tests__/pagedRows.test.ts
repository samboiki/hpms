import { describe, expect, it } from 'vitest';
import { PAGES_PER_WAVE, readAllPages } from '../pagedRows';

// A fake paged table of `total` rows; records each requested range and how many requests were open at once
function fakeTable(total: number) {
  const ranges: Array<[number, number]> = [];
  let open = 0;
  let maxOpen = 0;
  const build = (from: number, to: number) => {
    ranges.push([from, to]);
    open += 1;
    maxOpen = Math.max(maxOpen, open);
    const data = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i);
    return new Promise<{ data: number[]; error: null }>(resolve => setTimeout(() => {
      open -= 1;
      resolve({ data, error: null });
    }, 1));
  };
  return { build, ranges, maxOpen: () => maxOpen };
}

describe('readAllPages', () => {
  it('returns every row exactly once, in order, so Finance totals for a big practice are complete', async () => {
    const table = fakeTable(2500);
    const rows = await readAllPages(1000, table.build, () => new Error('failed'));
    expect(rows).toHaveLength(2500);
    expect(rows).toEqual(Array.from({ length: 2500 }, (_, i) => i));
  });

  it('asks for the pages after the first together, so a year of invoices costs 2 round-trips instead of 3+', async () => {
    const table = fakeTable(2500);
    await readAllPages(1000, table.build, () => new Error('failed'));
    expect(table.maxOpen()).toBe(PAGES_PER_WAVE);
    expect(table.ranges[0]).toEqual([0, 999]);
  });

  it('stops after one request when the first page is short (small practices pay nothing extra)', async () => {
    const table = fakeTable(40);
    const rows = await readAllPages(1000, table.build, () => new Error('failed'));
    expect(rows).toHaveLength(40);
    expect(table.ranges).toHaveLength(1);
  });

  it('ignores pages after a short one in the same wave, so no row is counted twice', async () => {
    // A table whose later offsets (wrongly) still answer must not add rows past the first short page
    const build = (from: number) => Promise.resolve({ data: from === 0 ? Array(10).fill(from) : Array(from === 10 ? 3 : 10).fill(from), error: null });
    const rows = await readAllPages(10, build, () => new Error('failed'));
    expect(rows).toHaveLength(13);
  });

  it('turns a failed page into the caller’s own error so screens can still say "not set up yet"', async () => {
    const build = () => Promise.resolve({ data: null, error: { code: '42P01' } });
    await expect(readAllPages(10, build, error => new Error(`missing ${error.code}`))).rejects.toThrow('missing 42P01');
  });
});
