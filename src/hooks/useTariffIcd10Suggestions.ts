/**
 * The ICD-10 suggestions for the tariff code on a billing line (src/utils/billing/tariffIcd10Suggestions.ts): the practice's
 * usual code, what it billed most with that code, and the reviewed starter codes. Nothing is read until the code box is
 * opened (`enabled`), the same way the box reads the practice's usual codes; the practice's data is kept for 5 minutes, so
 * the next line's box opens at once. While it is read, or when nothing can be read, there are no suggestions.
 */
import { useEffect, useMemo, useState } from 'react';
import { loadTariffIcd10Suggestions } from '../services/tariffIcd10SuggestionService';
import { useAuthStore } from '../stores/authStore';
import { EMPTY_TARIFF_ICD10_DATA, suggestionsForTariff, type TariffIcd10Data, type TariffIcd10Suggestion } from '../utils/billing/tariffIcd10Suggestions';

const NONE: readonly TariffIcd10Suggestion[] = [];

export function useTariffIcd10Suggestions(tariffCode: string | null | undefined, enabled: boolean): readonly TariffIcd10Suggestion[] {
  const practiceId = useAuthStore(state => state.selectedPracticeId || state.user?.practice_id || null);
  const [loaded, setLoaded] = useState<{ practiceId: string | null; data: TariffIcd10Data }>({ practiceId: null, data: EMPTY_TARIFF_ICD10_DATA });
  const wanted = Boolean(enabled && practiceId && tariffCode?.trim());

  useEffect(() => {
    if (!wanted || !practiceId) return;
    let cancelled = false;
    void loadTariffIcd10Suggestions(practiceId).then(load => {
      if (cancelled) return;
      setLoaded(previous => (previous.practiceId === practiceId && previous.data === load.data ? previous : { practiceId, data: load.data }));
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, practiceId]);

  return useMemo(
    () => (wanted && tariffCode && loaded.practiceId === practiceId ? suggestionsForTariff(tariffCode, loaded.data) : NONE),
    [wanted, tariffCode, loaded, practiceId]
  );
}
