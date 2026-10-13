import { useEffect, useMemo, useState } from 'react';
import { loadReminderStatuses } from '../services/reminderStatusService';
import type { ReminderStatus } from '../utils/diary/reminderStatus';

const NO_STATUSES: Map<string, ReminderStatus> = new Map();

/** Replies arrive by SMS without changing the booking, so the statuses are read again this often. */
const REFRESH_MS = 2 * 60 * 1000;

/** Reminder and SMS confirmation status of the bookings on screen, by visit id. */
export function useReminderStatuses(visitIds: string[]): Map<string, ReminderStatus> {
  // The same bookings in a new array must not reload anything
  const key = useMemo(() => [...new Set(visitIds)].sort().join(','), [visitIds]);
  const [statuses, setStatuses] = useState<Map<string, ReminderStatus>>(NO_STATUSES);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!key) {
      setStatuses(NO_STATUSES);
      return;
    }
    let cancelled = false;
    loadReminderStatuses(key.split(','))
      .then((loaded) => {
        if (!cancelled) setStatuses(loaded);
      })
      .catch((error: unknown) => console.error('Could not load reminder statuses:', error));
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  useEffect(() => {
    if (!key) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick((current) => current + 1);
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [key]);

  return statuses;
}
