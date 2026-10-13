/**
 * The practice row: the menu (Sidebar), the practice colours (usePracticeData), the tariff list and the diary's opening
 * hours each read it themselves, three or four times on every screen (owner, 13 Oct 2026: speed). One cached read now
 * serves all of them, and saving the practice profile refreshes it.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const db = vi.hoisted(() => ({ reads: 0, row: { id: 'practice-1', name: 'Invented Practice', practice_type: 'general', business_hours: null } as Record<string, unknown> }));
vi.mock('../supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => {
            db.reads += 1;
            return Promise.resolve({ data: { ...db.row }, error: null });
          }
        })
      })
    })
  }
}));

import { QUERY_DEFAULTS, refreshAfterSave } from '../queryClient';
import { loadPracticeRow, usePracticeRow } from '../practiceRow';

const setup = () => {
  db.reads = 0;
  const client = new QueryClient({ defaultOptions: { ...QUERY_DEFAULTS, queries: { ...QUERY_DEFAULTS.queries, retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

describe('one practice row for the whole app', () => {
  it('the menu, the colours, the tariff list and the diary share one read', async () => {
    const { client, wrapper } = setup();
    const menu = renderHook(() => usePracticeRow('practice-1'), { wrapper });
    const colours = renderHook(() => usePracticeRow('practice-1'), { wrapper });
    await waitFor(() => expect(menu.result.current.data?.name).toBe('Invented Practice'));
    const tariffs = await loadPracticeRow('practice-1', client);
    const diary = await loadPracticeRow('practice-1', client);

    expect(colours.result.current.data?.name).toBe('Invented Practice');
    expect(tariffs?.practice_type).toBe('general');
    expect(diary?.business_hours).toBeNull();
    expect(db.reads).toBe(1);
  });

  it('saving the practice profile shows the new name in the menu without reopening anything', async () => {
    const { client, wrapper } = setup();
    const menu = renderHook(() => usePracticeRow('practice-1'), { wrapper });
    await waitFor(() => expect(menu.result.current.data?.name).toBe('Invented Practice'));

    db.row = { ...db.row, name: 'Renamed Practice' };
    await refreshAfterSave('practice', client);
    await waitFor(() => expect(menu.result.current.data?.name).toBe('Renamed Practice'));
    expect(db.reads).toBe(2);
  });

  it('reads nothing without a practice', () => {
    const { wrapper } = setup();
    const menu = renderHook(() => usePracticeRow(null), { wrapper });
    expect(menu.result.current.data).toBeUndefined();
    expect(db.reads).toBe(0);
  });
});
