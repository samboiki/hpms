// Local stub for the unfinished cached-queries layer.
// The original module was never committed; this delegates straight to Supabase.

import { supabase } from './supabase';
import { practiceDataService } from './practiceDataService';

async function currentPracticeId(): Promise<string | null> {
  try {
    const ctx = await practiceDataService.getAuthContext();
    return ctx?.practiceId ?? null;
  } catch {
    return null;
  }
}

export async function getCachedPatients() {
  const practiceId = await currentPracticeId();
  if (!practiceId) return [];

  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('practice_id', practiceId)
    .order('last_name', { ascending: true });

  if (error) {
    console.warn('[cachedQueries stub] getCachedPatients error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function searchCachedPatients(searchTerm: string) {
  const practiceId = await currentPracticeId();
  if (!practiceId) return [];

  const term = (searchTerm ?? '').trim();
  if (!term) return getCachedPatients();

  const pattern = `%${term}%`;
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('practice_id', practiceId)
    .or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},cell_number.ilike.${pattern},id_number.ilike.${pattern}`
    )
    .order('last_name', { ascending: true });

  if (error) {
    console.warn('[cachedQueries stub] searchCachedPatients error:', error.message);
    return [];
  }
  return data ?? [];
}

export async function getCachedPracticeOverview() {
  const practiceId = await currentPracticeId();
  if (!practiceId) return null;

  const { data, error } = await supabase
    .from('practices')
    .select('*')
    .eq('id', practiceId)
    .single();

  if (error) {
    console.warn('[cachedQueries stub] getCachedPracticeOverview error:', error.message);
    return null;
  }
  return data;
}

export async function getCachedAutomationQueue() {
  const practiceId = await currentPracticeId();
  if (!practiceId) return [];

  const { data, error } = await supabase
    .from('automation_queue')
    .select('*')
    .eq('practice_id', practiceId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    // Table may not exist in every environment — degrade quietly.
    console.warn('[cachedQueries stub] getCachedAutomationQueue error:', error.message);
    return [];
  }
  return data ?? [];
}

export function invalidatePatientCache(_patientId?: string) {
  /* no-op: stub has no cache to invalidate */
}

export async function warmUpCache(_practiceId?: string) {
  /* no-op: stub does not pre-warm */
}
