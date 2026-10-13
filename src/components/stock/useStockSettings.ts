import { useCallback, useEffect, useState } from 'react';
import { isStockNotSetUpError, loadStockSettings } from '../../services/stock/stockService';
import type { StockSettings } from '../../utils/stock/stockRows';

export type StockSetup =
  | { status: 'loading' }
  | { status: 'not_set_up' }
  | { status: 'error'; message: string }
  | { status: 'ready'; settings: StockSettings };

// Several panels on one screen (the visit's medicines and its bill) ask at once: one request per practice, kept
// for a minute, and dropped when the settings are saved
const cache = new Map<string, { at: number; promise: Promise<StockSetup> }>();
const KEEP_MS = 60_000;

const fetchSetup = (practiceId: string): Promise<StockSetup> => {
  const cached = cache.get(practiceId);
  if (cached && Date.now() - cached.at < KEEP_MS) return cached.promise;
  const promise = loadStockSettings(practiceId)
    .then((settings): StockSetup => ({ status: 'ready', settings }))
    .catch((error: unknown): StockSetup => {
      cache.delete(practiceId);
      return isStockNotSetUpError(error)
        ? { status: 'not_set_up' }
        : { status: 'error', message: error instanceof Error ? error.message : 'Could not read the stock settings' };
    });
  cache.set(practiceId, { at: Date.now(), promise });
  return promise;
};

/** Forget the cached settings (after they were saved) */
export const forgetStockSettings = (practiceId: string): void => {
  cache.delete(practiceId);
};

/**
 * Whether stock is set up for the practice, and its settings. Before proposals/2026-10-07-dispensing-and-stock.sql
 * is applied this says 'not_set_up', and every stock and dispensing screen stays out of the way.
 */
export function useStockSettings(practiceId: string | null | undefined): StockSetup & { reload: () => void } {
  const [setup, setSetup] = useState<StockSetup>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!practiceId) {
      setSetup({ status: 'loading' });
      return;
    }
    let active = true;
    void fetchSetup(practiceId).then(result => {
      if (active) setSetup(result);
    });
    return () => {
      active = false;
    };
  }, [practiceId, version]);

  const reload = useCallback(() => {
    if (practiceId) forgetStockSettings(practiceId);
    setVersion(value => value + 1);
  }, [practiceId]);

  return { ...setup, reload };
}

/** True only when stock is set up and the practice dispenses */
export const dispensingOn = (setup: StockSetup): boolean => setup.status === 'ready' && setup.settings.dispensingEnabled;
