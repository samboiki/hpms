import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

// Every database read answers "nothing" unless a test puts rows in a table: the page's own figures are not what these
// tests are about
const rows = vi.hoisted(() => ({ byTable: {} as Record<string, unknown[]> }));
vi.mock('../lib/supabase', () => {
  const query = (table: string): unknown =>
    new Proxy(
      {},
      {
        get: (_target, key) =>
          key === 'then'
            ? (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows.byTable[table] ?? null, error: null, count: 0 }).then(resolve)
            : () => query(table)
      }
    );
  return {
    supabase: { from: (table: string) => query(table), rpc: () => query('rpc'), channel: () => ({ on: () => ({ subscribe: () => ({}) }) }), removeChannel: () => undefined }
  };
});
vi.mock('../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'user-1', practice_id: 'practice-1', role: 'admin', name: 'Example Admin' }, logout: vi.fn() })
}));
vi.mock('../hooks/usePracticeSettings', () => ({ usePracticeSettings: () => ({ settings: {}, loading: false }) }));
vi.mock('../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../services/unreadMessagesService', () => ({
  unreadMessagesService: { initialize: vi.fn(), subscribe: () => () => undefined }
}));
vi.mock('../components/communications/smsRepliesService', () => ({ countSmsRepliesNeedingReply: vi.fn().mockResolvedValue(0) }));
vi.mock('../components/communications/portalRequestsService', () => ({ countPendingPortalRequests: vi.fn().mockResolvedValue(0) }));
// The tabs' own screens are stand-ins that show which tab is open and offer the page's callbacks
vi.mock('../components/communications/CommunicationsDashboard', () => ({
  CommunicationsDashboard: ({ onOpenTab }: { onOpenTab: (tab: string) => void }) => (
    <button type="button" onClick={() => onOpenTab('templates')}>Configure Templates</button>
  )
}));
vi.mock('../components/messages/SmartAutomations', () => ({
  default: ({ onOpenLists }: { onOpenLists: () => void }) => (
    <button type="button" onClick={onOpenLists}>Open Lists</button>
  )
}));
vi.mock('../components/patientLists/PatientListsPage', () => ({ PatientListsPage: () => <p>Lists screen</p> }));
vi.mock('../components/templates/TemplatesPanel', () => ({ TemplatesPanel: () => <p>Templates screen</p> }));
vi.mock('../components/communications/MessageLogPanel', () => ({
  MessageLogPanel: ({ patientId, onClearPatient }: { patientId: string | null; onClearPatient: () => void }) => (
    <div>
      <p>Message log for {patientId ?? 'every patient'}</p>
      <button type="button" onClick={onClearPatient}>Every patient</button>
    </div>
  )
}));
vi.mock('../components/communications/SmsRepliesInbox', () => ({ SmsRepliesInbox: () => <p>Replies screen</p> }));
vi.mock('../components/communications/PortalRequestsInbox', () => ({ PortalRequestsInbox: () => <p>Requests screen</p> }));
vi.mock('../components/messages/InternalMessaging/EnhancedMessagingV2', () => ({ EnhancedMessagingV2: () => <p>Messaging screen</p> }));
vi.mock('../components/communications/DeliveryStatsDashboard', () => ({ DeliveryStatsDashboard: () => null }));
vi.mock('../components/dashboard/FloatingVisitTracker', () => ({ default: () => null }));
vi.mock('../components/telemedicine/VideoConsultModal', () => ({
  default: ({ roomUrl }: { roomUrl?: string | null }) => <p>Video call in {roomUrl ?? 'a new private room'}</p>
}));
vi.mock('../components/forms/PremiumAddAppointmentForm', () => ({ default: () => null }));
vi.mock('../components/layout/ProfileMenu', () => ({ UserAvatar: () => null }));

import Communications from '../pages/Communications';

afterEach(cleanup);

const Address = () => {
  const location = useLocation();
  return <output data-testid="address">{`${location.pathname}${location.search}`}</output>;
};

const renderAt = (address: string) =>
  render(
    <MemoryRouter initialEntries={[address]}>
      <Routes>
        <Route path="/communications" element={<><Communications /><Address /></>} />
      </Routes>
    </MemoryRouter>
  );

// A patient opened from Messages (a list, a reply, the log) is left with the browser's Back: the tab staff were on
// must be in the address, or Back lands on the Dashboard tab and they start over
describe('Messages keeps the open tab in the address', () => {
  it('a tab chosen on the page is written to the address', async () => {
    renderAt('/communications');
    fireEvent.click(screen.getByRole('tab', { name: /Lists/ }));
    expect(await screen.findByText('Lists screen')).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent('/communications?tab=lists');
  });

  it("the Dashboard's and Automations' links to other tabs are kept too", async () => {
    renderAt('/communications');
    fireEvent.click(screen.getByRole('button', { name: 'Configure Templates' }));
    expect(await screen.findByText('Templates screen')).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent('/communications?tab=templates');

    fireEvent.click(screen.getByRole('tab', { name: /Automations/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Open Lists' }));
    expect(screen.getByTestId('address')).toHaveTextContent('/communications?tab=lists');
  });

  it("leaving one patient's Message log for every patient stays on the log", async () => {
    renderAt('/communications?tab=log&patient=patient-1');
    expect(await screen.findByText('Message log for patient-1')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Every patient' }));
    expect(await screen.findByText('Message log for every patient')).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent(/^\/communications\?tab=log$/);
  });
});

// A video booking's patient waits in the room their confirmation SMS named: Start Call opened a different, new room,
// and only after a desk check-in that a video patient never has
describe('Messages > Telemedicine starts a video booking in its own room', () => {
  const booking = (videoLink: string) => ({
    id: 'visit-1',
    practice_id: 'practice-1',
    patient_id: 'patient-1',
    visit_date: '2026-10-13',
    scheduled_time: '09:30',
    status: 'confirmed',
    video_link: videoLink,
    patient: { id: 'patient-1', first_name: 'Example', last_name: 'Patient', cell_number: '0811234567' }
  });

  it("opens the booking's OneHealth room in the app, without waiting for a check-in", async () => {
    rows.byTable.visits = [booking('https://meet.jit.si/onehealth-example-room')];
    renderAt('/communications?tab=telemedicine');
    fireEvent.click(await screen.findByRole('button', { name: /Start Call/ }));
    expect(await screen.findByText('Video call in https://meet.jit.si/onehealth-example-room')).toBeInTheDocument();
    rows.byTable.visits = [];
  });

  it("opens another service's room in a new tab", async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    rows.byTable.visits = [booking('https://video.example.com/room-1')];
    renderAt('/communications?tab=telemedicine');
    fireEvent.click(await screen.findByRole('button', { name: /Start Call/ }));
    expect(open).toHaveBeenCalledWith('https://video.example.com/room-1', '_blank', 'noopener,noreferrer');
    open.mockRestore();
    rows.byTable.visits = [];
  });
});
