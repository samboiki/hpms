// Local stub for the unfinished optimizedQueries module.
// Delegates to Supabase; PracticeTariffsContext has its own fallback if these fail.

import { supabase } from './supabase';

export async function getOptimizedTariffs(practiceType: string) {
  const { data, error } = await supabase
    .from('practice_tariffs_with_types')
    .select('*')
    .eq('practice_type_name', practiceType)
    .eq('is_active', true);

  if (error) {
    console.warn('[optimizedQueries stub] getOptimizedTariffs error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getOptimizedFrequentTariffs(practiceType: string) {
  const { data, error } = await supabase
    .from('practice_tariffs_with_types')
    .select('*')
    .eq('practice_type_name', practiceType)
    .eq('is_active', true)
    .order('found_in_claims', { ascending: false })
    .limit(20);

  if (error) {
    console.warn('[optimizedQueries stub] getOptimizedFrequentTariffs error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function prefetchCommonData(_practiceType: string, _branchId: string) {
  // No-op: the stub does not pre-warm caches.
  return;
}
