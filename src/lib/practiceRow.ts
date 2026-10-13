import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { PRACTICE_ROW_KEY, queryClient as appQueryClient } from './queryClient';
import type { QueryClient } from '@tanstack/react-query';

/** The practice's own row, as `select('*')` returns it */
export type PracticeRow = Record<string, unknown> & { id: string };

export const practiceRowKey = (practiceId: string | null | undefined) => [PRACTICE_ROW_KEY, practiceId ?? null] as const;

/** One read of the practice row; null when there is none (or it may not be read) */
export async function fetchPracticeRow(practiceId: string): Promise<PracticeRow | null> {
  const { data, error } = await supabase.from('practices').select('*').eq('id', practiceId).maybeSingle();
  if (error) throw error;
  return (data as PracticeRow | null) ?? null;
}

/**
 * The practice row, shared: the menu, the practice colours, the tariff list and the diary's opening hours each used to
 * read it themselves (three or four reads of the same row on every screen). One cached read now serves them all for
 * the app's cache time; saving the practice profile refreshes it (refreshAfterSave('practice')).
 */
export function usePracticeRow(practiceId: string | null | undefined) {
  return useQuery({
    queryKey: practiceRowKey(practiceId),
    queryFn: () => fetchPracticeRow(practiceId as string),
    enabled: !!practiceId
  });
}

/** The same cached row for code outside React (services); reads it only when it is not cached or out of date */
export function loadPracticeRow(practiceId: string, client: QueryClient = appQueryClient): Promise<PracticeRow | null> {
  return client.fetchQuery({ queryKey: practiceRowKey(practiceId), queryFn: () => fetchPracticeRow(practiceId) });
}
