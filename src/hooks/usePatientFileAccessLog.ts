import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { logRecordAccess, type AccessScreen } from '../services/recordAccessLog';

/**
 * Records that the signed-in staff member opened this patient's file, from this screen (parity Q8): once per person
 * and file every 10 minutes, without waiting and without ever showing an error. Pass null while no file is open.
 */
export function usePatientFileAccessLog(patientId: string | null | undefined, screen: AccessScreen): void {
  // A patient app login is never a staff member: nothing is recorded for it
  const userId = useAuthStore(state => (state.sessionKind === 'staff' ? state.user?.id ?? null : null));
  useEffect(() => {
    if (!patientId || !userId) return;
    void logRecordAccess('patient_opened', { screen, userId, patientId });
  }, [patientId, userId, screen]);
}
