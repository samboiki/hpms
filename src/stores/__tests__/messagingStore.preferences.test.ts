/**
 * Owner decision 13 Oct 2026: notification settings must be real. The notification lists, the Dashboard panel and
 * the tracker's unread badge all read this store, so a kind the person switched off must leave the list and the
 * counts here, and arrive nowhere when it comes in live.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadNotificationCount: vi.fn(),
  loadNotificationPreferences: vi.fn(),
  countWantedUnread: vi.fn()
}));

vi.mock('../../services/internalMessagingService', () => ({
  internalMessagingService: {
    getNotifications: mocks.getNotifications,
    getUnreadNotificationCount: mocks.getUnreadNotificationCount
  }
}));
vi.mock('../../services/notificationPreferencesService', () => ({
  loadNotificationPreferences: mocks.loadNotificationPreferences,
  countWantedUnread: mocks.countWantedUnread
}));

import { useMessagingStore } from '../messagingStore';
import type { SystemNotification } from '../../types/internal-messaging.types';

const notification = (id: string, notification_type: string, priority = 'normal') =>
  ({ id, notification_type, priority, status: 'pending', title: id, created_at: '2026-10-13T08:00:00Z' } as unknown as SystemNotification);

const billingOff = { notificationsEnabled: true, types: { billing: false } };

beforeEach(() => {
  useMessagingStore.setState({ notifications: [], unreadNotificationCount: 0, notificationPrefs: null, notificationPrefsUserId: null });
  mocks.getNotifications.mockReset().mockResolvedValue({
    data: [notification('n1', 'invoice_generated'), notification('n2', 'appointment_cancelled'), notification('n3', 'emergency')]
  });
  mocks.getUnreadNotificationCount.mockReset().mockResolvedValue(3);
  mocks.loadNotificationPreferences.mockReset().mockResolvedValue({ status: 'ready', prefs: billingOff });
  mocks.countWantedUnread.mockReset().mockResolvedValue(2);
});

describe('notification settings in the store', () => {
  it('a kind switched off is not listed, and the unread count counts only what is shown', async () => {
    await useMessagingStore.getState().loadNotifications('user-1', 'practice-1');
    const state = useMessagingStore.getState();
    expect(state.notifications.map((item) => item.id)).toEqual(['n2', 'n3']);
    await vi.waitFor(() => expect(useMessagingStore.getState().unreadNotificationCount).toBe(2));
    expect(mocks.countWantedUnread).toHaveBeenCalledWith('user-1', billingOff);
  });

  it('a live notification of a hidden kind is not added or counted', async () => {
    useMessagingStore.setState({ notificationPrefs: billingOff, notificationPrefsUserId: 'user-1' });
    useMessagingStore.getState().addNotification(notification('n4', 'payment_received'));
    useMessagingStore.getState().addNotification(notification('n5', 'patient_arrived'));
    const state = useMessagingStore.getState();
    expect(state.notifications.map((item) => item.id)).toEqual(['n5']);
    expect(state.unreadNotificationCount).toBe(1);
  });

  it('saved settings apply at once (no reload needed)', async () => {
    useMessagingStore.setState({ notifications: [notification('n1', 'invoice_generated'), notification('n2', 'appointment_cancelled')] });
    useMessagingStore.getState().applyNotificationPrefs('user-1', billingOff);
    expect(useMessagingStore.getState().notifications.map((item) => item.id)).toEqual(['n2']);
  });

  it('settings that cannot be read show everything (never silence notifications by mistake)', async () => {
    mocks.loadNotificationPreferences.mockResolvedValue({ status: 'not_set_up' });
    await useMessagingStore.getState().loadNotifications('user-2', 'practice-1');
    expect(useMessagingStore.getState().notifications).toHaveLength(3);
  });
});
