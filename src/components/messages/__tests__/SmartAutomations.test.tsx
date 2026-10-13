import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { automationSettingFromRow } from '../../../../supabase/functions/process-automation-queue/automationRules';
import { automationStatusFromRpc } from '../../../utils/automations/processorHealth';

const service = vi.hoisted(() => ({ loadAutomations: vi.fn(), saveAutomationSetting: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: 'user-1', practice_id: 'practice-1', role: 'admin' as string, is_super_admin: false } }));
const navigate = vi.hoisted(() => vi.fn());

vi.mock('../../../services/automations/automationSettingsService', () => service);
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => auth }));
// The diary's own reminder switch and when its schedule last checked the practice
const diary = vi.hoisted(() => ({ settings: { reminders: { enabled: false }, remindersLastRunAt: null as string | null } }));
vi.mock('../../../hooks/useDiarySettings', () => ({ useDiarySettings: () => diary }));
vi.mock('../../../hooks/useSmsRepliesLive', () => ({ useSmsRepliesLive: () => false }));
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import SmartAutomations from '../SmartAutomations';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const settings = (welcomeOn: boolean) => ({
  'welcome-new-patient': automationSettingFromRow('welcome-new-patient', { enabled: welcomeOn }),
  'appointment-confirmation': automationSettingFromRow('appointment-confirmation', null)
});

const ready = (welcomeOn: boolean, lastRun: string | null) => ({
  state: 'ready',
  settings: settings(welcomeOn),
  status: automationStatusFromRpc({ processor_last_run_at: lastRun })
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.user.role = 'admin';
  service.saveAutomationSetting.mockResolvedValue({ ok: true });
  diary.settings = { reminders: { enabled: false }, remindersLastRunAt: null };
});

describe('only what really runs looks switched on', () => {
  // About 20 cards used to look on while only one had anything behind it: the default view now lists only
  // automations that run, and a card nothing runs never gets a switch
  it('the default view shows the automations that are on, and nothing that is not offered', async () => {
    service.loadAutomations.mockResolvedValue(ready(true, minutesAgo(5)));
    render(<SmartAutomations />);
    expect(await screen.findByRole('article', { name: 'Welcome new patients' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: /Lab results ready/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Birthday wishes' })).not.toBeInTheDocument();
  });

  it('cards that are not offered have no switch, even under "All"', async () => {
    service.loadAutomations.mockResolvedValue(ready(false, minutesAgo(5)));
    render(<SmartAutomations />);
    fireEvent.click(await screen.findByRole('button', { name: /^All/ }));
    fireEvent.click(screen.getByRole('button', { name: /Not available yet/ }));
    const lab = screen.getByRole('article', { name: 'Lab results ready: not available yet' });
    expect(within(lab).queryByRole('switch')).not.toBeInTheDocument();
    // Exactly the two automations the sender handles can be switched
    expect(screen.getAllByRole('switch')).toHaveLength(2);
  });
});

describe('the screen says whether the sender runs', () => {
  it('tells the practice the scheduler must be started when nothing has run', async () => {
    service.loadAutomations.mockResolvedValue(ready(true, null));
    render(<SmartAutomations />);
    expect(await screen.findByText('Automations are switched on but not running yet: OneHealth support must start the scheduler')).toBeInTheDocument();
  });

  it('shows the last check when the sender runs', async () => {
    service.loadAutomations.mockResolvedValue(ready(true, minutesAgo(5)));
    render(<SmartAutomations />);
    expect(await screen.findByText(/^Running: last check/)).toBeInTheDocument();
  });

  // Before the database update a switch would only save a row: nothing can be switched on, and nothing looks on
  it('before the database update nothing can be switched on', async () => {
    service.loadAutomations.mockResolvedValue({ state: 'not_set_up', settings: settings(true) });
    render(<SmartAutomations />);
    expect(await screen.findByText(/Automatic messages are not set up yet/)).toBeInTheDocument();
    expect(screen.getByText('Nothing is switched on')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^All/ }));
    for (const toggle of screen.getAllByRole('switch')) expect(toggle).toBeDisabled();
  });
});

describe('switching', () => {
  // Off must mean nothing more is queued or sent: the save says enabled = false
  it('switching an automation off saves it off', async () => {
    service.loadAutomations.mockResolvedValue(ready(true, minutesAgo(5)));
    render(<SmartAutomations />);
    const welcome = await screen.findByRole('article', { name: 'Welcome new patients' });
    fireEvent.click(within(welcome).getByRole('switch', { name: 'Welcome new patients' }));
    await waitFor(() => expect(service.saveAutomationSetting).toHaveBeenCalledTimes(1));
    expect(service.saveAutomationSetting.mock.calls[0].slice(0, 3)).toEqual(['practice-1', 'welcome-new-patient', false]);
  });

  // Automatic SMS cost the practice: only administrators switch them (the database refuses anyone else too)
  it('staff who are not administrators cannot switch', async () => {
    auth.user.role = 'receptionist';
    service.loadAutomations.mockResolvedValue(ready(true, minutesAgo(5)));
    render(<SmartAutomations />);
    const welcome = await screen.findByRole('article', { name: 'Welcome new patients' });
    expect(within(welcome).getByRole('switch')).toBeDisabled();
    expect(within(welcome).getByRole('button', { name: 'See the message' })).toBeInTheDocument();
  });

  // "Done elsewhere" is only honest if the card takes you there
  it('a card whose job is done in Lists opens Lists', async () => {
    service.loadAutomations.mockResolvedValue(ready(false, minutesAgo(5)));
    const onOpenLists = vi.fn();
    render(<SmartAutomations onOpenLists={onOpenLists} />);
    fireEvent.click(await screen.findByRole('button', { name: /^All/ }));
    fireEvent.click(within(screen.getByRole('article', { name: 'Birthday wishes' })).getByRole('button', { name: /Open Lists/ }));
    expect(onOpenLists).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screen.getByRole('article', { name: 'Appointment reminders' })).getByRole('button', { name: /Open reminder settings/ }));
    expect(navigate).toHaveBeenCalledWith('/?diarySettings=reminders');
  });
});

describe('the appointment reminders card', () => {
  // The diary's switch alone sent "On" while no reminder schedule ran: a practice would stop phoning patients,
  // believing they had been reminded
  it('says "On, but not running yet" while the reminder schedule has never checked the practice', async () => {
    diary.settings = { reminders: { enabled: true }, remindersLastRunAt: null };
    service.loadAutomations.mockResolvedValue(ready(false, minutesAgo(5)));
    render(<SmartAutomations />);
    const card = await screen.findByRole('article', { name: 'Appointment reminders' });
    expect(within(card).getByText('Not running')).toBeInTheDocument();
    expect(within(card).getByText('On, but not running yet: OneHealth support must start the scheduler.')).toBeInTheDocument();
    expect(within(card).queryByText('On')).not.toBeInTheDocument();
  });

  it('says "On" with the last check once the schedule runs', async () => {
    diary.settings = { reminders: { enabled: true }, remindersLastRunAt: minutesAgo(10) };
    service.loadAutomations.mockResolvedValue(ready(false, minutesAgo(5)));
    render(<SmartAutomations />);
    const card = await screen.findByRole('article', { name: 'Appointment reminders' });
    expect(within(card).getByText('On')).toBeInTheDocument();
    expect(within(card).getByText(/^Last checked /)).toBeInTheDocument();
  });
});
