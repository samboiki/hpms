import { useCallback, useEffect, useState } from 'react';
import type { CodeBundle } from './bundles';
import { isQuotesNotEnabledError, loadBundles } from './quoteService';

export type BundlesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; bundles: CodeBundle[] }
  | { status: 'not_enabled' }
  | { status: 'error'; message: string };

/** The practice's code bundles, loaded when `active` (e.g. when the bundle sheet opens). */
export function useBundles(practiceId: string | null, active: boolean): { state: BundlesState; reload: () => void } {
  const [state, setState] = useState<BundlesState>({ status: 'idle' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!active || !practiceId) return;
    let cancelled = false;
    // Keep showing the bundles already loaded while they are refreshed
    setState(current => (current.status === 'ready' ? current : { status: 'loading' }));
    loadBundles(practiceId)
      .then(bundles => {
        if (!cancelled) setState({ status: 'ready', bundles });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState(
          isQuotesNotEnabledError(error)
            ? { status: 'not_enabled' }
            : { status: 'error', message: error instanceof Error ? error.message : 'Could not load the code bundles.' }
        );
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, active, version]);

  const reload = useCallback(() => setVersion(value => value + 1), []);
  return { state, reload };
}
