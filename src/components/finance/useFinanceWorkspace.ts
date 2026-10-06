import { useCallback, useEffect, useRef, useState } from 'react';
import { loadFinanceWorkspace, type FinanceLoadRequest, type FinanceWorkspace } from './financeData';

interface WorkspaceState {
  data: FinanceWorkspace | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the Finance workspace for a practice and period window. A slow, superseded request can
 * never overwrite a newer one, and data from another practice is never shown while switching.
 */
export function useFinanceWorkspace(request: FinanceLoadRequest | null) {
  const [state, setState] = useState<WorkspaceState>({ data: null, loading: !!request, error: null });
  const requestIdRef = useRef(0);
  const practiceId = request?.practiceId ?? null;
  const windowStartKey = request?.windowStartKey ?? '';
  const lineStartKey = request?.lineItemRange.startKey ?? '';
  const lineEndKey = request?.lineItemRange.endKey ?? '';

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!practiceId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loadFinanceWorkspace({
        practiceId,
        windowStartKey,
        lineItemRange: { startKey: lineStartKey, endKey: lineEndKey }
      });
      if (requestId === requestIdRef.current) setState({ data, loading: false, error: null });
    } catch (error) {
      console.error('Finance: workspace load failed', error);
      if (requestId === requestIdRef.current) {
        setState(prev => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Finance data could not be loaded'
        }));
      }
    }
  }, [practiceId, windowStartKey, lineStartKey, lineEndKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const data = state.data && state.data.practiceId === practiceId ? state.data : null;
  return { data, loading: state.loading, error: state.error, reload: load };
}
