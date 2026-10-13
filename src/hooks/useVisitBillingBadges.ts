import { useEffect, useMemo, useState } from 'react';
import { loadBookingInvoices } from '../services/bookingLinksService';
import { billingBadgesByVisit, type BillingBadge } from '../utils/diary/billingBadge';

const NO_BADGES: Map<string, BillingBadge> = new Map();

/** Payments arrive at the front desk without changing the booking, so the badges are read again this often. */
const REFRESH_MS = 2 * 60 * 1000;

/**
 * "Invoiced" / "Paid" for the bookings on screen, by visit id (parity B13): one read for all of them, refreshed when
 * the bookings change and every two minutes while the diary is visible. Empty while loading or when it cannot be read.
 */
export function useVisitBillingBadges(visitIds: string[]): Map<string, BillingBadge> {
  // The same bookings in a new array must not read anything again
  const key = useMemo(() => [...new Set(visitIds)].sort().join(','), [visitIds]);
  const [badges, setBadges] = useState<Map<string, BillingBadge>>(NO_BADGES);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!key) {
      setBadges(NO_BADGES);
      return;
    }
    let cancelled = false;
    loadBookingInvoices(key.split(','))
      .then((invoices) => {
        if (!cancelled) setBadges(billingBadgesByVisit(invoices));
      })
      .catch((error: unknown) => console.error('Could not load the invoices of the bookings:', error));
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

  return badges;
}
