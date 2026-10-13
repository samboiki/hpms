/**
 * The Dashboard's Notifications panel. The page passes its own items (booking requests, today's follow-ups); the
 * person's system notifications ("visit ready", "visit cancelled") were loaded but never shown beside them, because the
 * page always passes a list. Rows open their actions from the keyboard too.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  systemNotifications: [] as unknown[]
}));

vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1', practice_id: 'practice-1' } }) }));
vi.mock('../../../hooks/useRealtimeMessaging', () => ({ useNotificationSubscription: vi.fn() }));
vi.mock('../../../stores/messagingStore', () => ({
  useMessagingStore: () => ({
    notifications: mocks.systemNotifications,
    loadNotifications: vi.fn(),
    markNotificationRead: mocks.markNotificationRead,
    markAllNotificationsRead: mocks.markAllNotificationsRead,
    unreadNotificationCount: 1
  })
}));
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import { NotificationsPanel, type Notification } from '../NotificationsPanel';

const pageItem: Notification = {
  id: 'booking-v1',
  type: 'booking',
  priority: 'high',
  title: 'New Booking Request',
  description: 'Test Patient asked for a visit',
  time: new Date('2026-10-13T08:00:00Z'),
  actionRequired: true,
  read: false,
  actions: { primary: { label: 'Confirm', onClick: vi.fn() } }
};

beforeEach(() => {
  mocks.markNotificationRead.mockReset();
  mocks.markAllNotificationsRead.mockReset();
  mocks.systemNotifications = [{
    id: 'sys-1', notification_type: 'visit_status', priority: 'normal', title: 'Visit ready', message: 'Test Patient is ready for you',
    created_at: '2026-10-13T08:30:00Z', status: 'unread', action_required: false
  }];
});

describe('Dashboard notifications', () => {
  it('shows the page\'s items and the person\'s system notifications together', () => {
    render(<NotificationsPanel notifications={[pageItem]} onMarkAsRead={vi.fn()} />);
    expect(screen.getByText('New Booking Request')).toBeInTheDocument();
    expect(screen.getByText('Visit ready')).toBeInTheDocument();
  });

  it('marks a system notification read in the database, and the page\'s own item through the page', () => {
    const onMarkAsRead = vi.fn();
    render(<NotificationsPanel notifications={[pageItem]} onMarkAsRead={onMarkAsRead} />);
    fireEvent.click(screen.getByText('Visit ready'));
    expect(mocks.markNotificationRead).toHaveBeenCalledWith('sys-1');
    fireEvent.click(screen.getByText('New Booking Request'));
    expect(onMarkAsRead).toHaveBeenCalledWith('booking-v1');
  });

  it('opens a row\'s actions with Enter', () => {
    render(<NotificationsPanel notifications={[pageItem]} onMarkAsRead={vi.fn()} />);
    const row = screen.getByText('New Booking Request').closest('[role="button"]') as HTMLElement;
    expect(row).toHaveAttribute('aria-expanded', 'false');
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(row).toHaveAttribute('aria-expanded', 'true');
  });
});
