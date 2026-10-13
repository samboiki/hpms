import { createContext, useContext, useEffect, useState } from 'react';
import type { LinkedPatient } from './portalModel';
import type { PortalLoad, PortalStatus } from './portalService';

export type PortalLoadState = 'loading' | 'ready' | 'not_enabled' | 'error';

export interface PortalContextValue {
  /** Patients linked to this login (the person and children they added) */
  patients: LinkedPatient[];
  /** The patient whose records are shown */
  selected: LinkedPatient | null;
  selectPatient: (patientId: string) => void;
  /** Files on this number and linking lock, from the patient-portal edge function (null until known) */
  status: PortalStatus | null;
  loadState: PortalLoadState;
  reload: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const value = useContext(PortalContext);
  if (!value) throw new Error('usePortal must be used inside PortalProvider');
  return value;
}

export type LoadView<T> = PortalLoad<T> | { state: 'loading' };

/**
 * Loads data for a screen and reloads it on request. Pass a loader made with useCallback (it changes when
 * the patient changes), or null to load nothing.
 */
export function usePortalLoad<T>(load: (() => Promise<PortalLoad<T>>) | null): { view: LoadView<T>; reload: () => void } {
  const [view, setView] = useState<LoadView<T>>({ state: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!load) return;
    let current = true;
    setView({ state: 'loading' });
    load()
      .then((result) => {
        if (current) setView(result);
      })
      .catch(() => {
        if (current) setView({ state: 'error', message: 'Could not load this right now. Check your connection and try again.' });
      });
    return () => {
      current = false;
    };
  }, [load, version]);

  return { view, reload: () => setVersion((value) => value + 1) };
}
