import { useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { loadPlanPricing, type PlanPricing } from '../../services/dental/dentalChartService';

export type PricingState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; pricing: PlanPricing };

/**
 * The practice's tariffs priced for the patient's fund on today's date, as a quote made today uses them. Loaded only
 * when the chart can hold a plan (the tariff list and the fund's prices are a few requests), once per patient.
 */
export function usePlanPricing(practiceId: string | null | undefined, patientId: string, enabled: boolean): PricingState {
  const [state, setState] = useState<PricingState>({ status: 'idle' });

  useEffect(() => {
    if (!enabled || !practiceId) return;
    let cancelled = false;
    setState({ status: 'loading' });
    loadPlanPricing(practiceId, patientId)
      .then(pricing => {
        if (!cancelled) setState({ status: 'ready', pricing });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not load the tariff list.' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId, enabled]);

  return state;
}
