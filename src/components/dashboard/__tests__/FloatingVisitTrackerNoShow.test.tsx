/**
 * The visit tracker. A patient marked as a no-show stayed under Scheduled with a Check In button: checking them in left
 * the booking a no-show in the diary while the tracker offered Start Visit. The row now says "No-show". The panel also
 * closes with Escape, as its X does.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const store = vi.hoisted(() => {
  const state = {
    visits: [
      {
        id: 'visit-2', patient_id: 'patient-2', status: 'no-show', is_confirmed: true, is_checked_in: false, is_ready: false,
        is_cancelled: false, scheduled_time: '08:00', patient: { first_name: 'Absent', last_name: 'Patient' }
      },
      {
        id: 'visit-3', patient_id: 'patient-3', status: 'scheduled', is_confirmed: true, is_checked_in: false, is_ready: false,
        is_cancelled: false, scheduled_time: '10:00', patient: { first_name: 'Booked', last_name: 'Patient' }
      }
    ],
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
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'user-1', practice_id: 'practice-1', role: 'receptionist' } }) }));
vi.mock('../../../services/unreadMessagesService', () => ({ unreadMessagesService: { subscribe: () => () => undefined } }));
vi.mock('../../patients/ComprehensivePatientModal', () => ({ default: () => null }));
vi.mock('../../visits/FullScreenEditVisitModal', () => ({ default: () => null }));
vi.mock('../../modals/VisitActionModal', () => ({ default: () => null }));
vi.mock('../../messages/EnhancedSmsModal', () => ({ default: () => null }));
vi.mock('../../messages/InternalMessaging/NotificationsList', () => ({ NotificationsList: () => null }));
vi.mock('../HandoffCardPrintButtons', () => ({ HandoffCardPrintButtons: () => null }));

import FloatingVisitTracker from '../FloatingVisitTracker';

afterEach(cleanup);

const openTracker = () => {
  render(
    <MemoryRouter>
      <FloatingVisitTracker practiceId="practice-1" selectedDate={new Date('2026-10-13T08:00:00')} />
    </MemoryRouter>
  );
  fireEvent.click(screen.getByRole('button', { name: /Open the visit tracker/ }));
};

describe('the visit tracker', () => {
  it('says "No-show" for a no-show instead of offering Check In', () => {
    openTracker();
    expect(screen.getByText('No-show')).toBeInTheDocument();
    // Only the patient still expected gets Check In
    expect(screen.getAllByRole('button', { name: 'Check In' })).toHaveLength(1);
  });

  it('closes with Escape', () => {
    openTracker();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => { fireEvent.keyDown(document.body, { key: 'Escape' }); });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
