import { useCallback, useEffect, useRef, useState } from 'react';
import { financeRequestKey, loadFinanceWorkspace, type FinanceLoadRequest, type FinanceWorkspace } from './financeData';

const inFlight = new Map<string, Promise<FinanceWorkspace>>();

/**
 * One load per practice and window at a time: a second mount (React's development double-mount, or a quick
 * leave-and-return) joins the load already running instead of reading every invoice again. A refresh after a
 * save (force) always starts a fresh load so the saved change is in it.
 */
export function loadWorkspaceOnce(request: FinanceLoadRequest, force = false): Promise<FinanceWorkspace> {
  const key = financeRequestKey(request);
  const running = inFlight.get(key);
  if (running && !force) return running;
  const task = loadFinanceWorkspace(request).finally(() => {
    if (inFlight.get(key) === task) inFlight.delete(key);
  });
  inFlight.set(key, task);
  return task;
}

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

  const load = useCallback(async (force = false) => {
    const requestId = ++requestIdRef.current;
    if (!practiceId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const data = await loadWorkspaceOnce({
        practiceId,
        windowStartKey,
        lineItemRange: { startKey: lineStartKey, endKey: lineEndKey }
      }, force);
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
  const reload = useCallback(() => load(true), [load]);
  return { data, loading: state.loading, error: state.error, reload };
}
