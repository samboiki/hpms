/**
 * Read every row of a paged query. Supabase caps a request at 1000 rows, so big practices need several pages.
 * Reading them one after another made Finance wait for each page in turn (about 1 s each); after the first
 * full page the next pages are now asked for together, PAGES_PER_WAVE at a time. A short page is the end:
 * rows of any later page in the same wave are ignored. buildPage must apply a stable order ending in a unique
 * column so pages neither overlap nor skip rows.
 */
export const PAGES_PER_WAVE = 3;

export async function readAllPages<T, E = unknown>(
  pageSize: number,
  buildPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
  toError: (error: E) => Error
): Promise<T[]> {
  const read = async (from: number): Promise<T[]> => {
    const { data, error } = await buildPage(from, from + pageSize - 1);
    if (error) throw toError(error);
    return data ?? [];
  };

  const rows = await read(0);
  if (rows.length < pageSize) return rows;
  for (let from = pageSize; ; from += pageSize * PAGES_PER_WAVE) {
    const offsets = Array.from({ length: PAGES_PER_WAVE }, (_, i) => from + i * pageSize);
    const pages = await Promise.all(offsets.map(read));
    for (const page of pages) {
      rows.push(...page);
      if (page.length < pageSize) return rows;
    }
  }
}
