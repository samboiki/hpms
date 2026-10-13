import { useCallback, useEffect, useState } from 'react';
import { isPayersNotSetUp, loadPatientPayers, type PatientPayers } from '../../../services/payerAccountService';

export type PatientPayersStatus = 'loading' | 'ready' | 'not_set_up' | 'error';

export interface PatientPayersState extends PatientPayers {
  status: PatientPayersStatus;
  error: string | null;
  reload: () => void;
}

const EMPTY: PatientPayers = { accounts: [], memberships: [], cases: [] };

/**
 * A patient's injury and accident cases and the company accounts they are on, with the practice's accounts (parity
 * A14, A19). 'not_set_up' before proposals/2026-10-13-company-accounts-and-injury-cases.sql is applied.
 */
export function usePatientPayers(practiceId: string | null | undefined, patientId: string | null | undefined): PatientPayersState {
  const [state, setState] = useState<Omit<PatientPayersState, 'reload'>>({ ...EMPTY, status: 'loading', error: null });
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey(key => key + 1), []);

  useEffect(() => {
    if (!practiceId || !patientId) return;
    let active = true;
    loadPatientPayers(practiceId, patientId)
      .then(payers => {
        if (active) setState({ ...payers, status: 'ready', error: null });
      })
      .catch(error => {
        if (!active) return;
        if (isPayersNotSetUp(error)) setState({ ...EMPTY, status: 'not_set_up', error: null });
        else {
          console.error("Could not load the patient's cases and accounts:", error);
          setState(current => ({ ...current, status: 'error', error: error instanceof Error ? error.message : "The patient's cases could not be read." }));
        }
      });
    return () => {
      active = false;
    };
  }, [practiceId, patientId, reloadKey]);

  return { ...state, reload };
}
