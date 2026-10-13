import { useCallback, useEffect, useState } from 'react';
import {
  loadAuthorisationUsage,
  loadPatientAuthorisations,
  loadPatientReferrals
} from '../services/claimRegistersService';
import { NO_USAGE, type AuthorisationUsage, type PatientAuthorisation } from '../utils/billing/authorisations';
import type { PatientReferral } from '../utils/billing/referrals';

export interface PatientClaimRegisters {
  /** not_set_up: the database has no registers yet (proposals/2026-10-12-referrals-and-authorisations.sql) */
  status: 'loading' | 'ready' | 'not_set_up' | 'error';
  message: string | null;
  /** Every referral on the file, removed ones too (they stay for the record) */
  referrals: PatientReferral[];
  authorisations: PatientAuthorisation[];
  /** The visits that already carry each authorisation number */
  usage: AuthorisationUsage;
  reload: () => void;
}

/**
 * A patient's referral and authorisation registers and which visits already use each authorisation (parity C10, D15):
 * the patient file's Billing tab lists them, the visit's Billing tab fills claim fields and line numbers from them.
 */
export function usePatientClaimRegisters(patientId: string | null | undefined): PatientClaimRegisters {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<PatientClaimRegisters, 'reload'>>({
    status: 'loading',
    message: null,
    referrals: [],
    authorisations: [],
    usage: NO_USAGE
  });
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    if (!patientId) {
      setState({ status: 'ready', message: null, referrals: [], authorisations: [], usage: NO_USAGE });
      return;
    }
    let live = true;
    setState(current => ({ ...current, status: current.status === 'ready' ? 'ready' : 'loading' }));
    void Promise.all([loadPatientReferrals(patientId), loadPatientAuthorisations(patientId), loadAuthorisationUsage(patientId)]).then(
      ([referrals, authorisations, usage]) => {
        if (!live) return;
        if (referrals.status === 'not_set_up' || authorisations.status === 'not_set_up') {
          setState({ status: 'not_set_up', message: null, referrals: [], authorisations: [], usage: NO_USAGE });
          return;
        }
        const message = referrals.status === 'error' ? referrals.message : authorisations.status === 'error' ? authorisations.message : null;
        setState({
          status: message ? 'error' : 'ready',
          message,
          referrals: referrals.status === 'ready' ? referrals.rows : [],
          authorisations: authorisations.status === 'ready' ? authorisations.rows : [],
          usage
        });
      }
    );
    return () => {
      live = false;
    };
  }, [patientId, version]);

  return { ...state, reload };
}
