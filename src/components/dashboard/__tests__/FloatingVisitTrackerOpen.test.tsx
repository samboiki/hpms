import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// One invented patient waiting for the practitioner today
const store = vi.hoisted(() => {
  const state = {
    visits: [
      {
        id: 'visit-1',
        patient_id: 'patient-1',
        status: 'confirmed',
        is_ready: true,
        is_cancelled: false,
        scheduled_time: '09:00',
        patient: { first_name: 'Example', last_name: 'Patient' },
        doctor: { full_name: 'Example Practitioner' }
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
vi.mock('../../patients/ComprehensivePatientModal', () => ({ default: () => <p>The tracker's own patient window</p> }));
vi.mock('../../visits/FullScreenEditVisitModal', () => ({ default: () => null }));
vi.mock('../../modals/VisitActionModal', () => ({ default: () => null }));
vi.mock('../../messages/EnhancedSmsModal', () => ({ default: () => null }));
vi.mock('../../messages/InternalMessaging/NotificationsList', () => ({ NotificationsList: () => null }));
vi.mock('../HandoffCardPrintButtons', () => ({ HandoffCardPrintButtons: () => null }));

import FloatingVisitTracker from '../FloatingVisitTracker';

afterEach(cleanup);

describe("the visit tracker opens a patient from today's list", () => {
  // The Dashboard turns the tracker's own window off and opens the patient file itself: every row there did nothing
  it('on the Dashboard a waiting patient opens their file on the visits', () => {
    const onOpenPatientModal = vi.fn();
    render(
      <MemoryRouter>
        <FloatingVisitTracker practiceId="practice-1" selectedDate={new Date('2026-10-13T08:00:00')} disablePatientModal onOpenPatientModal={onOpenPatientModal} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Open the visit tracker/ }));
    fireEvent.click(screen.getByText('Example Patient'));
    expect(onOpenPatientModal).toHaveBeenCalledWith('patient-1', 'encounters');
  });

  // Patients, Encounters, Settings and Communications keep the tracker's own patient window; its code now loads when it
  // is first opened (not with the Dashboard), and it must still open
  it("elsewhere a waiting patient opens the tracker's own patient window", async () => {
    render(
      <MemoryRouter>
        <FloatingVisitTracker practiceId="practice-1" selectedDate={new Date('2026-10-13T08:00:00')} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Open the visit tracker/ }));
    fireEvent.click(screen.getByText('Example Patient'));
    expect(await screen.findByText("The tracker's own patient window")).toBeInTheDocument();
  });

  it('with neither a window nor a way to open the file, a row stays a plain line', () => {
    render(
      <MemoryRouter>
        <FloatingVisitTracker practiceId="practice-1" selectedDate={new Date('2026-10-13T08:00:00')} disablePatientModal />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /Open the visit tracker/ }));
    const row = screen.getByText('Example Patient').closest('div[class*="rounded-lg"]') as HTMLElement;
    expect(row.className).not.toContain('cursor-pointer');
  });
});
