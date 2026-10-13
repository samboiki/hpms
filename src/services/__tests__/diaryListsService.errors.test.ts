import { afterEach, describe, expect, it, vi } from 'vitest';

// The statuses table answers with a database error (not a missing table)
vi.mock('../../lib/supabase', () => {
  const query = (): unknown =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'then'
            ? (resolve: (value: unknown) => unknown) =>
                Promise.resolve({ data: null, error: { code: 'XX000', message: 'canceling statement due to statement timeout' } }).then(resolve)
            : () => query()
      }
    );
  return { supabase: { from: () => query() } };
});

import { forgetDiaryLists, loadDiaryStatuses } from '../diaryListsService';

afterEach(() => forgetDiaryLists());

describe('Diary settings when the statuses cannot be read', () => {
  // "Could not load the statuses: canceling statement due to statement timeout" put the database's words on screen
  it('gives plain words, keeping the database text to the console', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const load = await loadDiaryStatuses('practice-1');
    expect(load).toEqual({ state: 'error', message: 'check the connection and try again.', items: [] });
    consoleError.mockRestore();
  });
});
