import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { isPayersNotSetUp, loadPatientPayers, loadVisitPayer, setVisitPayer, type PatientPayers } from '../../services/payerAccountService';
import { billsAccount, choiceOfVisit, sameChoice, visitPayerOptions, type VisitPayerChoice, type VisitPayerOption } from '../../utils/accounts/visitPayer';

const PATIENT: VisitPayerChoice = { mode: 'patient' };

export interface VisitPayerState {
  /** not_set_up: the database has no company accounts or cases yet (the visit is the patient's, as before) */
  status: 'loading' | 'ready' | 'not_set_up' | 'error';
  message: string | null;
  options: VisitPayerOption[];
  choice: VisitPayerChoice;
  setChoice: (choice: VisitPayerChoice) => void;
  /** Worth showing: the patient has a company account or a case, or the visit is billed to one */
  shown: boolean;
  /** Changed since loaded or last saved */
  dirty: boolean;
  /**
   * Saves the choice for the visit when it changed, before its invoice is made or updated (the invoice's lines then
   * follow it). Returns the problem in plain words (null when saved or unchanged) and whether the visit is billed to an
   * account as saved: the invoice is then the account's, all of it private, nothing claimed.
   */
  save: (visitId: string) => Promise<{ problem: string | null; billsAccount: boolean }>;
}

/**
 * Who pays for a visit (parity A14, A19) on the visit's Billing tab: the patient, a company account the patient is on,
 * or one of the patient's injury or accident cases. Kept as a draft and saved with the visit (AddVisitTabs once the
 * visit exists, EditVisitTabs with its other changes), before the invoice.
 */
export function useVisitPayer(input: { practiceId: string | null | undefined; patientId: string | null | undefined; visitId: string | null }): VisitPayerState {
  const { practiceId, patientId, visitId } = input;
  const [status, setStatus] = useState<VisitPayerState['status']>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [payers, setPayers] = useState<PatientPayers>({ accounts: [], memberships: [], cases: [] });
  const [choice, setChoiceState] = useState<VisitPayerChoice>(PATIENT);
  const saved = useRef<VisitPayerChoice>(PATIENT);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!practiceId || !patientId) return;
    let live = true;
    setStatus('loading');
    Promise.all([loadPatientPayers(practiceId, patientId), visitId ? loadVisitPayer(visitId) : Promise.resolve(null)])
      .then(([loaded, row]) => {
        if (!live) return;
        const current = choiceOfVisit(row);
        saved.current = current;
        setPayers(loaded);
        setChoiceState(current);
        setDirty(false);
        setStatus('ready');
        setMessage(null);
      })
      .catch(error => {
        if (!live) return;
        if (isPayersNotSetUp(error)) {
          setStatus('not_set_up');
          return;
        }
        console.error('Could not read who pays for the visit:', error);
        setStatus('error');
        setMessage('Who pays for this visit could not be read. It is read again when the visit is saved, so the invoice follows what is on file.');
      });
    return () => {
      live = false;
    };
  }, [practiceId, patientId, visitId]);

  const options = useMemo(() => visitPayerOptions({ ...payers, members: payers.memberships, current: saved.current }), [payers]);
  // A failed read is shown (with its message) so staff know before they save; it hid the card before
  const shown = status === 'error' || (status === 'ready' && (options.length > 1 || saved.current.mode !== 'patient'));

  const setChoice = useCallback((next: VisitPayerChoice) => {
    setChoiceState(next);
    setDirty(!sameChoice(next, saved.current));
  }, []);

  const save = useCallback(
    async (targetVisitId: string): Promise<{ problem: string | null; billsAccount: boolean }> => {
      if (status === 'not_set_up') return { problem: null, billsAccount: false };
      if (status !== 'ready') {
        // Not read yet (still loading, or the read failed): read what is on file now. Answering "the patient pays" here
        // rewrote the invoice of a visit billed to a company account or case as a medical aid invoice, to be claimed
        try {
          const [loaded, row] = await Promise.all([
            practiceId && patientId ? loadPatientPayers(practiceId, patientId) : Promise.resolve<PatientPayers>({ accounts: [], memberships: [], cases: [] }),
            loadVisitPayer(targetVisitId)
          ]);
          return { problem: null, billsAccount: billsAccount(choiceOfVisit(row), loaded.cases) };
        } catch (error) {
          if (isPayersNotSetUp(error)) return { problem: null, billsAccount: false };
          console.error('Could not read who pays for the visit before saving:', error);
          // Read after "The visit was saved but who pays for it was not: "
          return { problem: 'it could not be read, so check that its invoice is billed to the right account.', billsAccount: false };
        }
      }
      if (sameChoice(choice, saved.current)) return { problem: null, billsAccount: billsAccount(saved.current, payers.cases) };
      try {
        await setVisitPayer(targetVisitId, choice);
        saved.current = choice;
        setDirty(false);
        return { problem: null, billsAccount: billsAccount(choice, payers.cases) };
      } catch (error) {
        // The invoice follows what is saved, not the refused choice
        return {
          problem: error instanceof Error ? plainWords(error.message) : 'Who pays for the visit could not be saved.',
          billsAccount: billsAccount(saved.current, payers.cases)
        };
      }
    },
    [status, choice, payers.cases, practiceId, patientId]
  );

  return { status, message, options, choice, setChoice, shown, dirty, save };
}
