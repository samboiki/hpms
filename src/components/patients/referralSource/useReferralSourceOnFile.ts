import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { useReferralSourceColumns } from '../../forms/patientExtrasColumns';
import { NO_REFERRAL_ANSWER, referralAnswerFrom, referralColumns, type ReferralAnswer } from '../../../utils/patients/referralSource';

// Untyped: the generated types do not know the columns before the proposal is applied
const untypedDb = supabase as unknown as SupabaseClient;

/**
 * The patient form's "How did you hear about us?": what is on the file, once the columns exist. Shown and saved only
 * once read, so a save never blanks an answer the form had not loaded yet (the same rule as the town).
 */
export function useReferralSourceOnFile(patientId: string) {
  const available = useReferralSourceColumns();
  const [loaded, setLoaded] = useState(false);
  const [value, setValue] = useState<ReferralAnswer>(NO_REFERRAL_ANSWER);

  useEffect(() => {
    setLoaded(false);
    if (!available || !patientId) return;
    let active = true;
    void (async () => {
      const { data, error } = await untypedDb
        .from('patients').select('referral_source, referral_source_other').eq('id', patientId).maybeSingle();
      if (!active) return;
      if (error) {
        console.error('Could not read how the patient heard about the practice:', error);
        return;
      }
      setValue(referralAnswerFrom(data as { referral_source?: string | null; referral_source_other?: string | null } | null));
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [available, patientId]);

  /** The columns to add to the form's save: none until the answer was read */
  const columns = useCallback(() => (loaded ? referralColumns(value) : {}), [loaded, value]);

  return { shown: loaded, value, setValue, columns };
}
