import { useCallback, useContext } from 'react';
import { QueryClient, QueryClientContext, useQuery } from '@tanstack/react-query';
import { isSafetyNotSetUp, loadPatientSafety, type PatientSafety } from '../../../services/patientSafetyService';

export type SafetyStatus = 'loading' | 'ready' | 'not_set_up' | 'error';

export const patientSafetyKey = (patientId: string | null | undefined) => ['patient-safety', patientId ?? null] as const;

// Screens rendered without the app's QueryClientProvider (a visit screen in an isolated test) share this
// one, so the allergy check never breaks the screen it sits on
const fallbackClient = new QueryClient();

export interface PatientSafetyState {
  status: SafetyStatus;
  data: PatientSafety | null;
  error: string | null;
  /** Reload after a change (every screen showing this patient's alerts updates) */
  refresh: () => Promise<void>;
  /** The records, waiting for them when they are still loading (the medicine check never skips) */
  ensureLoaded: () => Promise<PatientSafety | null>;
}

/**
 * One patient's allergies, alert note and problem list, shared by the patient file, the visit screen
 * and the medicine check (one cached copy per patient, refreshed after every change).
 */
export function usePatientSafety(patientId: string | null | undefined): PatientSafetyState {
  const queryClient = useContext(QueryClientContext) ?? fallbackClient;
  const query = useQuery(
    {
      queryKey: patientSafetyKey(patientId),
      queryFn: () => loadPatientSafety(patientId as string),
      enabled: Boolean(patientId),
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // "Not switched on yet" will not change by retrying
      retry: (failureCount, error) => !isSafetyNotSetUp(error) && failureCount < 1
    },
    queryClient
  );

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: patientSafetyKey(patientId) });
  }, [queryClient, patientId]);

  const ensureLoaded = useCallback(async (): Promise<PatientSafety | null> => {
    if (!patientId) return null;
    return queryClient.ensureQueryData({ queryKey: patientSafetyKey(patientId), queryFn: () => loadPatientSafety(patientId) });
  }, [queryClient, patientId]);

  let status: SafetyStatus = 'loading';
  if (query.data) status = 'ready';
  else if (query.error) status = isSafetyNotSetUp(query.error) ? 'not_set_up' : 'error';

  return {
    status,
    data: query.data ?? null,
    error: query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null,
    refresh,
    ensureLoaded
  };
}
