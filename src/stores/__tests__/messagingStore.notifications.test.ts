/**
 * Notifications are loaded each time a list or panel opens (the visit tracker's Messages tab, the Dashboard panel).
 * Every load added the whole list again, so each notification showed two, three, four times; only a later page may add
 * to the list.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getNotifications: vi.fn() }));

vi.mock('../../services/internalMessagingService', () => ({
  internalMessagingService: {
    getNotifications: mocks.getNotifications,
    getUnreadNotificationCount: vi.fn().mockResolvedValue(0)
  }
}));

// No notification settings saved: everything shows (messagingStore.preferences.test.ts covers the settings)
vi.mock('../../services/notificationPreferencesService', () => ({
  loadNotificationPreferences: vi.fn().mockResolvedValue({ status: 'ready', prefs: null }),
  countWantedUnread: vi.fn()
}));

import { useMessagingStore } from '../messagingStore';

const notification = (id: string) => ({ id, title: `Notice ${id}`, priority: 'normal', status: 'pending', created_at: '2026-10-13T08:00:00Z' });

beforeEach(() => {
  useMessagingStore.setState({ notifications: [] });
  mocks.getNotifications.mockReset().mockResolvedValue({ data: [notification('n1'), notification('n2')] });
});

describe('loadNotifications', () => {
  it('opening the list again shows each notification once', async () => {
    await useMessagingStore.getState().loadNotifications('user-1', 'practice-1');
    await useMessagingStore.getState().loadNotifications('user-1', 'practice-1');
    expect(useMessagingStore.getState().notifications.map((item) => item.id)).toEqual(['n1', 'n2']);
  });

  it('a second page adds to the first', async () => {
    await useMessagingStore.getState().loadNotifications('user-1', 'practice-1', undefined, { page: 1, limit: 2 });
    mocks.getNotifications.mockResolvedValue({ data: [notification('n3')] });
    await useMessagingStore.getState().loadNotifications('user-1', 'practice-1', undefined, { page: 2, limit: 2 });
    expect(useMessagingStore.getState().notifications.map((item) => item.id)).toEqual(['n1', 'n2', 'n3']);
  });
});
