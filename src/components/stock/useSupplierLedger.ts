import { useCallback, useEffect, useState } from 'react';
import { isSupplierLedgerNotSetUp, loadSupplierLedger } from '../../services/stock/supplierLedgerService';
import type { SupplierLedgerData } from '../../utils/stock/supplierLedger';
import type { LoadState } from './stockContext';
import { errorText } from './stockUi';

/** The practice's creditors ledger (every supplier); 'not_set_up' before the database update */
export function useSupplierLedger(practiceId: string): LoadState<SupplierLedgerData> & { reload: () => void } {
  const [state, setState] = useState<LoadState<SupplierLedgerData>>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    loadSupplierLedger(practiceId)
      .then(ledger => active && setState({ status: 'ready', data: ledger }))
      .catch((error: unknown) => {
        if (!active) return;
        setState(isSupplierLedgerNotSetUp(error) ? { status: 'not_set_up' } : { status: 'error', message: errorText(error, 'Could not load the supplier ledger') });
      });
    return () => {
      active = false;
    };
  }, [practiceId, version]);

  const reload = useCallback(() => setVersion(value => value + 1), []);
  return { ...state, reload };
}
