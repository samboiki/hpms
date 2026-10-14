/**
 * The ICD-10 suggestions for the tariff code on a billing line (src/utils/billing/tariffIcd10Suggestions.ts): the practice's
 * usual code, what it billed most with that code, the reviewed starter codes, what the wording rules suggest for the code
 * and the diagnoses most common in the practice's discipline. Nothing is read until the code box is opened (`enabled`), the
 * same way the box reads the practice's usual codes; the practice's data is kept for 5 minutes, so the next line's box
 * opens at once, and the rules are read for the one tariff code the box belongs to. While it is read, or when nothing can
 * be read, there are no suggestions.
 */
import { useEffect, useMemo, useState } from 'react';
import { loadProcedureSuggestions, loadTariffIcd10Suggestions } from '../services/tariffIcd10SuggestionService';
import { useAuthStore } from '../stores/authStore';
import { tariffCodeKey } from '../utils/billing/icd10Defaults';
import {
  EMPTY_TARIFF_ICD10_DATA,
  suggestionsForTariff,
  type ReasonedCode,
  type TariffIcd10Data,
  type TariffIcd10Suggestion
} from '../utils/billing/tariffIcd10Suggestions';

const NONE: readonly TariffIcd10Suggestion[] = [];
const NO_CODES: readonly ReasonedCode[] = [];

export function useTariffIcd10Suggestions(tariffCode: string | null | undefined, enabled: boolean): readonly TariffIcd10Suggestion[] {
  const practiceId = useAuthStore(state => state.selectedPracticeId || state.user?.practice_id || null);
  const [loaded, setLoaded] = useState<{ practiceId: string | null; data: TariffIcd10Data; discipline: string | null }>({
    practiceId: null,
    data: EMPTY_TARIFF_ICD10_DATA,
    discipline: null
  });
  const [procedure, setProcedure] = useState<{ key: string; codes: readonly ReasonedCode[] }>({ key: '', codes: NO_CODES });
  const wanted = Boolean(enabled && practiceId && tariffCode?.trim());
  const lineKey = tariffCodeKey(tariffCode);
  const discipline = loaded.practiceId === practiceId ? loaded.discipline : null;
  const procedureKey = discipline && lineKey ? `${discipline}|${lineKey}` : '';

  useEffect(() => {
    if (!wanted || !practiceId) return;
    let cancelled = false;
    void loadTariffIcd10Suggestions(practiceId).then(load => {
      if (cancelled) return;
      setLoaded(previous =>
        previous.practiceId === practiceId && previous.data === load.data ? previous : { practiceId, data: load.data, discipline: load.discipline ?? null }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, practiceId]);

  // What the wording rules suggest for this line's code, once the practice's discipline is known
  useEffect(() => {
    if (!wanted || !discipline || !lineKey) return;
    let cancelled = false;
    void loadProcedureSuggestions(discipline, lineKey).then(result => {
      if (!cancelled) setProcedure({ key: procedureKey, codes: result.codes });
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, discipline, lineKey, procedureKey]);

  return useMemo(() => {
    if (!wanted || !tariffCode || loaded.practiceId !== practiceId) return NONE;
    const rules = procedure.key === procedureKey ? procedure.codes : NO_CODES;
    return suggestionsForTariff(tariffCode, rules.length > 0 ? { ...loaded.data, procedure: new Map([[lineKey, rules]]) } : loaded.data);
  }, [wanted, tariffCode, loaded, practiceId, procedure, procedureKey, lineKey]);
}
