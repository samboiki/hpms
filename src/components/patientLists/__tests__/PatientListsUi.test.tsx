import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { PatientListRecord } from '../../../services/patientListService';
import { DEFAULT_AUTOMATION } from '../../../utils/patientLists/listAutomation';
import { windhoekClock } from '../../../utils/patientLists/listDates';
import { addMonthsToKey } from '../../../utils/billing/dates';
import type { PatientFacts } from '../../../utils/patientLists/listRules';

const service = vi.hoisted(() => ({
  loadLists: vi.fn(),
  loadMemberRows: vi.fn(),
  loadPractice: vi.fn(),
  loadFacts: vi.fn(),
  addPatients: vi.fn(),
  createList: vi.fn(),
  setExcluded: vi.fn()
}));

vi.mock('../../../services/patientListService', () => ({
  patientListService: service,
  isListsNotEnabledError: (error: unknown) => (error as { code?: string } | null)?.code === '42P01'
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'user-1', practice_id: 'practice-1' } })
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
// The file's Lists control also reads the patient's recalls; none here
vi.mock('../../../services/patientRecallService', () => ({
  patientRecallService: { loadForPatient: vi.fn().mockResolvedValue([]), setRecall: vi.fn(), removeRecall: vi.fn() },
  isRecallsNotSetUpError: () => false
}));
// Icons load their drawings later; in a test that can land after the page is gone ("window is not defined")
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { AddToListButton } from '../AddToListButton';
import { PatientListsControl } from '../PatientListsControl';
import { PatientListsPage } from '../PatientListsPage';

const list = (overrides: Partial<PatientListRecord>): PatientListRecord => ({
  id: 'L1',
  practiceId: 'practice-1',
  name: 'Birthdays today',
  description: null,
  kind: 'smart',
  rule: { type: 'birthday', window: 'today' },
  ruleError: null,
  automation: DEFAULT_AUTOMATION,
  automationEnabled: false,
  lastRunOn: null,
  lastRunAt: null,
  lastRunSummary: null,
  createdAt: '2026-10-07T07:00:00Z',
  ...overrides
});

const patient = (id: string, dateOfBirth: string): PatientFacts => ({
  patientId: id,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  dateOfBirth,
  cellNumber: '081 123 4567',
  smsOptOut: false,
  lastCompletedVisitOn: null,
  lastCompletedByType: {},
  completedVisitsLastYear: 0,
  nextBookingOn: null,
  nextBookingTime: null,
  lastNoShowOn: null,
  balanceDue: 0,
  oldestUnpaidOn: null
});

const notEnabled = { code: '42P01', message: 'relation "public.patient_lists" does not exist' };

beforeEach(() => {
  vi.clearAllMocks();
  service.loadMemberRows.mockResolvedValue([]);
  service.loadPractice.mockResolvedValue({ name: 'Eros Family Clinic', phone: '061 123 456' });
  service.loadFacts.mockResolvedValue([]);
});

describe('before the database update is applied', () => {
  it('the Lists page says lists are not switched on yet, instead of showing an error', async () => {
    service.loadLists.mockRejectedValue(notEnabled);
    render(<PatientListsPage />, { wrapper: MemoryRouter });
    expect(await screen.findByText('Automation lists are not switched on yet')).toBeInTheDocument();
    expect(screen.queryByText(/could not be loaded/i)).not.toBeInTheDocument();
  });

  it("the patient file's Lists button explains it too", async () => {
    service.loadLists.mockRejectedValue(notEnabled);
    render(<PatientListsControl practiceId="practice-1" patient={{ id: 'p1', first_name: 'Maria', last_name: 'Shikongo' }} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lists' })).toHaveAttribute('title', 'Automation lists are not switched on yet'));
    fireEvent.click(screen.getByRole('button', { name: 'Lists' }));
    expect(await screen.findByText('Automation lists are not switched on yet')).toBeInTheDocument();
  });
});

describe('the Lists page', () => {
  it('shows a live count: a smart list counts the patients who match today, with no manual work', async () => {
    const today = windhoekClock(new Date()).dateKey;
    const birthdayToday = today.endsWith('-02-29') ? '1996-02-29' : `${Number(today.slice(0, 4)) - 30}${today.slice(4)}`;
    const notToday = today.slice(5) === '01-01' ? '1990-01-02' : '1990-01-01';
    service.loadLists.mockResolvedValue([list({})]);
    service.loadFacts.mockResolvedValue([patient('1', birthdayToday), patient('2', notToday)]);
    render(<PatientListsPage />, { wrapper: MemoryRouter });
    const card = (await screen.findByText('Birthdays today')).closest('button') as HTMLElement;
    await waitFor(() => expect(within(card).getByText('1')).toBeInTheDocument());
    expect(within(card).getByText('patient')).toBeInTheDocument();
  });
});

// Business rule: reception should see at a glance why to talk to this patient today (recall due, balance owed,
// birthday), on the patient file itself, without opening the Lists sheet.
describe('notices on the patient file', () => {
  it('shows a smart list the patient is on today, with the reason as the tooltip', async () => {
    const today = windhoekClock(new Date()).dateKey;
    service.loadLists.mockResolvedValue([
      list({ id: 'L2', name: 'Recall by treatment', rule: { type: 'recall_by_code', months: 6, codes: ['8159'] } })
    ]);
    service.loadFacts.mockResolvedValue([{ ...patient('p1', '1990-01-01'), lastBilledByCode: { '8159': addMonthsToKey(today, -8) } }]);
    render(<PatientListsControl practiceId="practice-1" patient={{ id: 'p1', first_name: 'Maria', last_name: 'Shikongo' }} />);
    const notice = await screen.findByRole('button', { name: 'Recall by treatment' });
    expect(notice.getAttribute('title')).toMatch(/8159 on .* ago/);
  });

  it('shows no notice when the patient is on no smart list today', async () => {
    const today = windhoekClock(new Date()).dateKey;
    service.loadLists.mockResolvedValue([
      list({ id: 'L2', name: 'Recall by treatment', rule: { type: 'recall_by_code', months: 6, codes: ['8159'] } })
    ]);
    service.loadFacts.mockResolvedValue([{ ...patient('p1', '1990-01-01'), lastBilledByCode: { '8159': addMonthsToKey(today, -2) } }]);
    render(<PatientListsControl practiceId="practice-1" patient={{ id: 'p1', first_name: 'Maria', last_name: 'Shikongo' }} />);
    await waitFor(() => expect(service.loadFacts).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Recall by treatment' })).toBeNull();
  });
});

describe('Add to list (Patients page)', () => {
  it('adds the ticked patients in two clicks: the button, then the list', async () => {
    service.loadLists.mockResolvedValue([list({ id: 'L2', name: 'Flu vaccine 2026', kind: 'manual', rule: null })]);
    service.addPatients.mockResolvedValue({ added: 2, alreadyOnList: 0 });
    const onAdded = vi.fn();
    render(<AddToListButton practiceId="practice-1" patientIds={['p1', 'p2']} scope="selected" onAdded={onAdded} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add 2 patients (ticked) to a list' }));
    fireEvent.click(await screen.findByRole('button', { name: /Flu vaccine 2026/ }));

    await waitFor(() => expect(service.addPatients).toHaveBeenCalledWith('practice-1', 'L2', ['p1', 'p2']));
    expect(onAdded).toHaveBeenCalledWith({ listId: 'L2', listName: 'Flu vaccine 2026', added: 2 });
  });

  it('cannot be pressed when there is nobody to add', () => {
    render(<AddToListButton practiceId="practice-1" patientIds={[]} scope="shown" />);
    expect(screen.getByRole('button', { name: 'No patients to add to a list' })).toBeDisabled();
  });
});

// Links both ways between the patient file and Messages > Lists: reception works a recall list by opening each
// patient's file to book or phone them, then comes back to the same list for the next one
describe('links between lists and patient files', () => {
  const Address = () => {
    const location = useLocation();
    return <output data-testid="address">{`${location.pathname}${location.search}`}</output>;
  };
  const renderPage = (address: string) =>
    render(
      <MemoryRouter initialEntries={[address]}>
        <Routes>
          <Route path="/communications" element={<><PatientListsPage /><Address /></>} />
        </Routes>
      </MemoryRouter>
    );
  const birthdayToday = () => {
    const today = windhoekClock(new Date()).dateKey;
    return today.endsWith('-02-29') ? '1996-02-29' : `${Number(today.slice(0, 4)) - 30}${today.slice(4)}`;
  };

  it('a list opened from the grid is kept in the address, so Back from a patient file returns to it', async () => {
    service.loadLists.mockResolvedValue([list({})]);
    renderPage('/communications?tab=lists');
    fireEvent.click((await screen.findByText('Birthdays today')).closest('button') as HTMLElement);
    expect(screen.getByTestId('address')).toHaveTextContent('/communications?tab=lists&list=L1');
  });

  it("a link to a list opens it, and each patient's name opens their file", async () => {
    service.loadLists.mockResolvedValue([list({})]);
    service.loadFacts.mockResolvedValue([patient('1', birthdayToday())]);
    renderPage('/communications?tab=lists&list=L1');
    const name = await screen.findByRole('link', { name: 'First1 Last1' });
    expect(name).toHaveAttribute('href', '/patients?patientId=1&tab=overview');
  });

  it("the patient file's Lists sheet links each list the patient is on to that list", async () => {
    const today = windhoekClock(new Date()).dateKey;
    service.loadLists.mockResolvedValue([
      list({ id: 'L2', name: 'Recall by treatment', rule: { type: 'recall_by_code', months: 6, codes: ['8159'] } })
    ]);
    service.loadFacts.mockResolvedValue([{ ...patient('p1', '1990-01-01'), lastBilledByCode: { '8159': addMonthsToKey(today, -8) } }]);
    render(<PatientListsControl practiceId="practice-1" patient={{ id: 'p1', first_name: 'Maria', last_name: 'Shikongo' }} />, {
      wrapper: MemoryRouter
    });
    fireEvent.click(await screen.findByRole('button', { name: /^Lists: Maria Shikongo is on 1 list$/ }));
    expect(await screen.findByRole('link', { name: 'Recall by treatment' })).toHaveAttribute('href', '/communications?tab=lists&list=L2');
  });
});
