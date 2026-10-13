import { useCallback, useEffect, useState } from 'react';
import { NO_STORES, loadStoreSetup, type StoreSetup } from '../../services/stock/storeService';

/**
 * The practice's stores and the stock in each (L10). A practice with one place, or a database without the stores
 * update, gets no stores and the Stock page looks as it always has. A failure to read them is shown as one store too
 * (the page still works) and reported in the console.
 */
export function useStockStores(practiceId: string | null | undefined, userId: string | null | undefined): StoreSetup & { reload: () => void } {
  const [setup, setSetup] = useState<StoreSetup>(NO_STORES);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!practiceId) return;
    let active = true;
    loadStoreSetup(practiceId, userId ?? null)
      .then(next => active && setSetup(next))
      .catch((error: unknown) => {
        console.error('Could not load the stores:', error);
        if (active) setSetup(NO_STORES);
      });
    return () => {
      active = false;
    };
  }, [practiceId, userId, version]);

  const reload = useCallback(() => setVersion(value => value + 1), []);
  return { ...setup, reload };
}
