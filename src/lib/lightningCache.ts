// Local stub for the unfinished lightning-cache layer.
// The original module was never committed; this delegates straight to Supabase
// so the app boots. No in-memory caching, but functionally correct.

import { supabase } from './supabase';

type AnyRecord = Record<string, unknown>;

async function fetchPatients(practiceId: string) {
  const { data, error } = await supabase
    .from('patients')
    .select(`
      *,
      medical_aid_details!left (
        *,
        medical_aid_provider:medical_aid_providers ( id, name, logo_url )
      )
    `)
    .eq('practice_id', practiceId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) {
    console.warn('[lightningCache stub] fetchPatients error:', error.message);
    return [];
  }
  return data ?? [];
}

async function fetchVisits(patientId: string) {
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('patient_id', patientId)
    .order('visit_date', { ascending: false });

  if (error) {
    console.warn('[lightningCache stub] fetchVisits error:', error.message);
    return [];
  }
  return data ?? [];
}

async function fetchTodayVisits(practiceId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('visits')
    .select('*, patient:patients!inner(*)')
    .eq('practice_id', practiceId)
    .eq('visit_date', today)
    .order('visit_date', { ascending: true });

  if (error) {
    console.warn('[lightningCache stub] fetchTodayVisits error:', error.message);
    return [];
  }
  return data ?? [];
}

async function countCompletedVisits(patientId: string) {
  const { count, error } = await supabase
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('patient_id', patientId)
    .eq('status', 'completed');

  if (error) {
    console.warn('[lightningCache stub] countCompletedVisits error:', error.message);
    return 0;
  }
  return count ?? 0;
}

export const lightning = {
  getPatients: (practiceId: string) => fetchPatients(practiceId),
  getVisits: (patientId: string) => fetchVisits(patientId),
  getTodayVisits: (practiceId: string) => fetchTodayVisits(practiceId),
  getVisitCount: (patientId: string) => countCompletedVisits(patientId),
};

// Real shape used in the codebase is get-or-fetch:
//   lightningCache.get(key, async () => supabase.from(...).select(...), ttlMs)
// With no cache layer we just invoke the factory and return its result.
export const lightningCache = {
  get: async <T>(_key: string, factory?: () => Promise<T>, _ttlMs?: number): Promise<T | undefined> => {
    if (typeof factory === 'function') return factory();
    return undefined;
  },
  getStats: () => ({ hits: 0, misses: 0, size: 0, hitRate: 0 }),
  invalidatePattern: (_pattern: string) => { /* no-op */ },
};
