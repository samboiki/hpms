import { useCallback, useEffect, useRef, useState } from 'react';
import type { FrameState } from './ReportFrame';
import type { ReportLoad } from './practiceReportsService';

/**
 * Loads a report's rows for its practice and period. A slow, superseded load never overwrites a newer one (the period
 * or practice changed meanwhile), and "not set up yet" is said in words with the proposal that sets it up.
 */
export function useReportLoad<T>(load: (() => Promise<ReportLoad<T>>) | null, key: string, notSetUp: string): { status: FrameState; data: T | null; retry: () => void } {
  const [status, setStatus] = useState<FrameState>({ state: 'loading' });
  const [data, setData] = useState<T | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const run = loadRef.current;
    if (!run) return;
    const id = ++latest.current;
    setStatus({ state: 'loading' });
    setData(null);
    run().then(result => {
      if (id !== latest.current) return;
      if (result.state === 'ready') {
        setData(result.data);
        setStatus({ state: 'ready' });
      } else if (result.state === 'not_set_up') {
        setStatus({ state: 'not_set_up', message: notSetUp });
      } else {
        setStatus({ state: 'error', error: result.error });
      }
    });
  }, [key, attempt, notSetUp]);

  const retry = useCallback(() => setAttempt(n => n + 1), []);
  return { status, data, retry };
}
