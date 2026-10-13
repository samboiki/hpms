import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { PortalContext, type PortalContextValue, type PortalLoadState } from './portalContext';
import type { LinkedPatient } from './portalModel';
import { loadMyPatients, loadPortalStatus, type PortalStatus } from './portalService';

// The chosen person is remembered on this phone (a parent usually looks at the same child again)
const SELECTED_KEY = 'hpms-portal-patient';

const readSelected = (): string | null => {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
};

const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patients, setPatients] = useState<LinkedPatient[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(readSelected);
  const [status, setStatus] = useState<PortalStatus | null>(null);
  const [loadState, setLoadState] = useState<PortalLoadState>('loading');

  const reload = useCallback(async () => {
    const [patientLoad, statusLoad] = await Promise.all([loadMyPatients(), loadPortalStatus()]);
    if (statusLoad.state === 'ready') setStatus(statusLoad.data);
    if (patientLoad.state === 'ready') {
      setPatients(patientLoad.data);
      // Nobody linked yet and the linking service missing: the "Confirm who you are" form could never work, so the
      // app says it is not switched on (before, the patient filled the form in and only then read that)
      setLoadState(patientLoad.data.length === 0 && statusLoad.state === 'not_enabled' ? 'not_enabled' : 'ready');
    } else {
      setLoadState(patientLoad.state === 'not_enabled' || statusLoad.state === 'not_enabled' ? 'not_enabled' : 'error');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectPatient = useCallback((patientId: string) => {
    setSelectedId(patientId);
    try {
      localStorage.setItem(SELECTED_KEY, patientId);
    } catch {
      // Not remembered in private browsing
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      localStorage.removeItem(SELECTED_KEY);
    } catch {
      // Nothing stored
    }
    await useAuthStore.getState().logout();
  }, []);

  const value = useMemo<PortalContextValue>(() => {
    const selected = patients.find((patient) => patient.patientId === selectedId) ?? patients[0] ?? null;
    return { patients, selected, selectPatient, status, loadState, reload, signOut };
  }, [patients, selectedId, selectPatient, status, loadState, reload, signOut]);

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
};

export default PortalProvider;
