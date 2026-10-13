import { useEffect, useState } from 'react';
import { parsePracticeNumber, parseRatePercent, type PractitionerBilling } from '../../../utils/billing/practitionerBilling';
import { loadPractitionerBillingFor, savePractitionerBilling } from '../../../services/practitionerBillingService';

export type PractitionerBillingLoad = { status: 'loading' } | { status: 'ready'; saved: PractitionerBilling } | { status: 'not_set_up' } | { status: 'error'; message: string };

export interface PractitionerBillingDraft {
  load: PractitionerBillingLoad;
  numberText: string;
  rateText: string;
  setNumberText: (text: string) => void;
  setRateText: (text: string) => void;
  /** Why the typed values cannot be saved; null when they can */
  problem: string | null;
  /** True when the typed values differ from the saved ones */
  changed: boolean;
  /** Saves the typed values when they changed (throws with the reason when they cannot be saved) */
  save: () => Promise<void>;
}

/**
 * A practitioner's own practice number and rate as typed on their staff profile (parity D31), loaded from
 * practitioner_billing and saved through set_practitioner_billing (practice administrators only).
 */
export function usePractitionerBillingDraft(userId: string): PractitionerBillingDraft {
  const [load, setLoad] = useState<PractitionerBillingLoad>({ status: 'loading' });
  const [numberText, setNumberText] = useState('');
  const [rateText, setRateText] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadPractitionerBillingFor(userId).then(result => {
      if (cancelled) return;
      if (result.status !== 'ready') {
        setLoad(result);
        return;
      }
      setLoad({ status: 'ready', saved: result.value });
      setNumberText(result.value.practiceNumber ?? '');
      setRateText(result.value.ratePercent === null ? '' : String(result.value.ratePercent));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const number = parsePracticeNumber(numberText);
  const rate = parseRatePercent(rateText);
  const problem = !number.ok ? number.message : !rate.ok ? rate.message : null;
  const changed =
    load.status === 'ready' && number.ok && rate.ok && (number.value !== load.saved.practiceNumber || rate.value !== load.saved.ratePercent);

  const save = async () => {
    if (load.status !== 'ready') return;
    if (problem) throw new Error(problem);
    if (!changed || !number.ok || !rate.ok) return;
    const saved = await savePractitionerBilling(userId, { practiceNumber: number.value, ratePercent: rate.value });
    setLoad({ status: 'ready', saved });
  };

  return { load, numberText, rateText, setNumberText, setRateText, problem, changed, save };
}
