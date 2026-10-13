import { useCallback, useEffect, useRef, useState } from 'react';
import { loadVisitClaimDetails, saveVisitClaimDetails } from '../../services/claimRegistersService';
import { draftOfClaimDetails, validateClaimDetailsDraft, type VisitClaimDetailsDraft } from '../../utils/billing/visitClaimDetails';

/** A visit not saved yet: only asks the database whether the claim details exist */
const NO_VISIT = '00000000-0000-0000-0000-000000000000';

export interface VisitClaimDetailsState {
  /** not_set_up: the database has no claim details yet (proposals/2026-10-12-referrals-and-authorisations.sql) */
  status: 'loading' | 'ready' | 'not_set_up' | 'error';
  message: string | null;
  draft: VisitClaimDetailsDraft;
  setDraft: (draft: VisitClaimDetailsDraft) => void;
  /** Changed since loaded or last saved */
  dirty: boolean;
  /**
   * Saves the draft for the visit when it changed (with the visit: the visit's lines in an open claim batch are claimed
   * with it at once). Null when saved or nothing changed, else why not, in plain words.
   */
  save: (visitId: string, visitDate: string | null) => Promise<string | null>;
}

/**
 * A visit's referral, hospital stay and place of service (parity F19), kept as a draft on the Billing tab and saved
 * with the visit (AddVisitTabs after the visit exists, EditVisitTabs with its other changes).
 */
export function useVisitClaimDetails(visitId: string | null): VisitClaimDetailsState {
  const [status, setStatus] = useState<VisitClaimDetailsState['status']>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraftState] = useState<VisitClaimDetailsDraft>(() => draftOfClaimDetails(null));
  const saved = useRef<string>(JSON.stringify(draftOfClaimDetails(null)));
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    void loadVisitClaimDetails(visitId ?? NO_VISIT).then(result => {
      if (!live) return;
      if (result.status !== 'ready') {
        setStatus(result.status);
        setMessage(result.status === 'error' ? result.message : null);
        return;
      }
      const loaded = draftOfClaimDetails(visitId ? result.details : null);
      saved.current = JSON.stringify(loaded);
      setDraftState(loaded);
      setDirty(false);
      setStatus('ready');
      setMessage(null);
    });
    return () => {
      live = false;
    };
  }, [visitId]);

  const setDraft = useCallback((next: VisitClaimDetailsDraft) => {
    setDraftState(next);
    setDirty(JSON.stringify(next) !== saved.current);
  }, []);

  const save = useCallback(
    async (targetVisitId: string, visitDate: string | null): Promise<string | null> => {
      if (status !== 'ready' || JSON.stringify(draft) === saved.current) return null;
      const checked = validateClaimDetailsDraft(draft, visitDate);
      if (!checked.ok) return Object.values(checked.errors)[0] ?? 'The referral and hospital details are not complete.';
      try {
        await saveVisitClaimDetails(targetVisitId, checked.value);
        saved.current = JSON.stringify(draft);
        setDirty(false);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : 'The referral and hospital details could not be saved.';
      }
    },
    [status, draft]
  );

  return { status, message, draft, setDraft, dirty, save };
}
