import { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { buildChart, type ChartEntry, type ChartModel, type QuoteRef } from '../../utils/dental/chart';
import {
  loadBilledToothLines,
  loadChart,
  loadPatientBirthDate,
  loadQuoteRefs,
  type BilledHistory,
  type ChartLoad
} from '../../services/dental/dentalChartService';

export type ToothChartLoad =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; billed: BilledHistory; chart: ChartLoad; quotes: QuoteRef[]; quotesError: string | null; dateOfBirth: string | null };

export interface ToothChart {
  load: ToothChartLoad;
  /** Every tooth's state, built from the billing and what was charted (empty until loaded) */
  model: ChartModel;
  entries: ChartEntry[];
  /** The chart tables exist (the dental chart update is applied) */
  chartReady: boolean;
  dateOfBirth: string | null;
  /** Reads everything again (after a change on the chart or a quote) */
  reload: () => void;
}

/**
 * The patient's tooth chart as the Teeth view and the visit's Billing tab show it: the billed lines with teeth, what
 * was charted, the quotes (their failure is said, not fatal) and the date of birth (which teeth to show first).
 * Nothing loads until `enabled` (a dental practice).
 */
export function useToothChart(practiceId: string | null | undefined, patientId: string, enabled: boolean): ToothChart {
  const [load, setLoad] = useState<ToothChartLoad>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    if (!practiceId || !patientId || !enabled) return;
    let cancelled = false;
    setLoad(current => (current.status === 'ready' ? current : { status: 'loading' }));
    Promise.all([
      loadBilledToothLines(patientId),
      loadChart(patientId),
      loadQuoteRefs(practiceId, patientId).then(
        quotes => ({ quotes, error: null as string | null }),
        (error: unknown) => ({ quotes: [] as QuoteRef[], error: error instanceof Error ? plainWords(error.message) : 'unknown error' })
      ),
      loadPatientBirthDate(patientId)
    ])
      .then(([billed, chart, quoteLoad, dateOfBirth]) => {
        if (!cancelled) setLoad({ status: 'ready', billed, chart, quotes: quoteLoad.quotes, quotesError: quoteLoad.error, dateOfBirth });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not load the tooth chart.' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId, enabled, version]);

  const ready = load.status === 'ready' ? load : null;
  const entries: ChartEntry[] = useMemo(() => (ready?.chart.status === 'ready' ? ready.chart.entries : []), [ready]);
  const model = useMemo(
    () =>
      buildChart({
        billed: ready?.billed.lines ?? [],
        entries,
        changes: ready?.chart.status === 'ready' ? ready.chart.changes : [],
        quotes: ready?.quotes ?? []
      }),
    [ready, entries]
  );
  return { load, model, entries, chartReady: ready?.chart.status === 'ready', dateOfBirth: ready?.dateOfBirth ?? null, reload };
}
