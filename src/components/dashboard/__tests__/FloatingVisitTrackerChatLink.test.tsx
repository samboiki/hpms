/**
 * The visit tracker's red count is unread staff chat, but its Messages tab lists only the person's notifications, with
 * no way to the chat. The tab now leads to Messages > Messaging, where the unread messages are.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const store = vi.hoisted(() => {
  const state = {
    visits: [],
    loading: false,
    startVisit: async () => undefined,
    checkInPatient: async () => undefined,
    fetchTodayVisits: async () => undefined,
    fetchVisits: async () => undefined
  };
  return { useVisitsStore: (selector?: (value: typeof state) => unknown) => (selector ? selector(state) : state) };
});
vi.mock('../../../stores/visitsStore', () => store);
vi.mock('../../../stores/themeStore', () => ({ useTheme: () => ({ currentTheme: { gradients: {} } }) }));
vi.mock('../../../stores/messagingStore', () => ({ useMessagingStore: () => ({ unreadNotificationCount: 0 }) }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'user-1', practice_id: 'practice-1', role: 'nurse' } }) }));
// Three unread staff chat messages
vi.mock('../../../services/unreadMessagesService', () => ({
  unreadMessagesService: { subscribe: (listener: (count: number) => void) => { listener(3); return () => undefined; } }
}));
vi.mock('../../patients/ComprehensivePatientModal', () => ({ default: () => null }));
vi.mock('../../visits/FullScreenEditVisitModal', () => ({ default: () => null }));
vi.mock('../../modals/VisitActionModal', () => ({ default: () => null }));
vi.mock('../../messages/EnhancedSmsModal', () => ({ default: () => null }));
vi.mock('../../messages/InternalMessaging/NotificationsList', () => ({ NotificationsList: () => <p>Notifications list</p> }));
vi.mock('../HandoffCardPrintButtons', () => ({ HandoffCardPrintButtons: () => null }));

import FloatingVisitTracker from '../FloatingVisitTracker';

afterEach(cleanup);

const Where: React.FC = () => {
  const location = useLocation();
  return <p>At {location.pathname}{location.search}</p>;
};

describe('the visit tracker and staff chat', () => {
  it('its Messages tab leads to the unread staff messages', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<FloatingVisitTracker practiceId="practice-1" selectedDate={new Date('2026-10-13T08:00:00')} />} />
          <Route path="/communications" element={<Where />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Open the visit tracker/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Messages/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Staff messages: 3 unread' }));
    expect(screen.getByText('At /communications?tab=messaging')).toBeTruthy();
  });
});
