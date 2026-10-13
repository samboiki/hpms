/**
 * The app's 5-minute cache (owner, 13 Oct 2026: "React Query cache 5 minutes, no refetch on every mount; saves must
 * refresh affected screens"). Opening a screen again within 5 minutes shows what it loaded without reading it again;
 * a save marks the screens that show what it changed out of date, so they read again.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { CACHE_MINUTES, QUERY_DEFAULTS, SAVE_AFFECTS, refreshAfterSave } from '../queryClient';

const newClient = () => new QueryClient({ defaultOptions: QUERY_DEFAULTS });

// A screen opening (an observer subscribing) and closing again, waiting for its read to finish
const openScreen = async (client: QueryClient, queryKey: readonly unknown[], queryFn: () => Promise<unknown>) => {
  const observer = new QueryObserver(client, { queryKey: [...queryKey], queryFn });
  const unsubscribe = observer.subscribe(() => undefined);
  await vi.waitFor(() => expect(client.getQueryState([...queryKey])?.fetchStatus).toBe('idle'));
  return unsubscribe;
};

describe('the cache defaults', () => {
  it('keep a loaded screen for 5 minutes and read again only what is older', () => {
    expect(CACHE_MINUTES).toBe(5);
    expect(QUERY_DEFAULTS.queries?.staleTime).toBe(5 * 60 * 1000);
    // 'always' read every query again on every mount, whatever its age: the slowness the owner asked to remove
    expect(QUERY_DEFAULTS.queries?.refetchOnMount).toBe(true);
  });

  it('opening a screen again within the 5 minutes does not read it again', async () => {
    const client = newClient();
    const read = vi.fn().mockResolvedValue(['Invented row']);
    (await openScreen(client, ['users', 'practice-1'], read))();
    (await openScreen(client, ['users', 'practice-1'], read))();
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('a save refreshes the screens that show what it changed', () => {
  it('a staff save makes Settings > Users read its list again the next time it opens', async () => {
    const client = newClient();
    const read = vi.fn().mockResolvedValue(['Invented staff member']);
    (await openScreen(client, ['users', 'practice-1'], read))();

    await refreshAfterSave('staff', client);
    (await openScreen(client, ['users', 'practice-1'], read))();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('a practice save re-reads the shared practice row at once while the menu shows it', async () => {
    const client = newClient();
    const read = vi.fn().mockResolvedValueOnce({ name: 'Old name' }).mockResolvedValue({ name: 'New name' });
    const stillOpen = await openScreen(client, ['practice-row', 'practice-1'], read);

    await refreshAfterSave('practice', client);
    await vi.waitFor(() => expect(client.getQueryData(['practice-row', 'practice-1'])).toEqual({ name: 'New name' }));
    stillOpen();
  });

  it('a save leaves the screens that do not show it alone', async () => {
    const client = newClient();
    const read = vi.fn().mockResolvedValue([]);
    (await openScreen(client, ['leave-types', 'practice-1'], read))();
    await refreshAfterSave('payslips', client);
    expect(client.getQueryState(['leave-types', 'practice-1'])?.isInvalidated).toBe(false);
  });
});

// A key with a typo would refresh nothing and nobody would notice: every key a save refreshes is a screen's query key
describe('every screen a save refreshes exists', () => {
  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [readFileSync(path, 'utf8')] : [];
    });
  const code = sources(join(process.cwd(), 'src')).join('\n');

  for (const [what, keys] of Object.entries(SAVE_AFFECTS)) {
    for (const [first] of keys) {
      it(`${what}: '${first}' is a query key in the app`, () => {
        const used = first === 'practice-row'
          ? /PRACTICE_ROW_KEY/.test(code)
          : new RegExp(`queryKey:\\s*\\['${first}'`).test(code);
        expect(used).toBe(true);
      });
    }
  }
});
