import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PatientListRecord } from '../../../services/patientListService';
import { DEFAULT_AUTOMATION } from '../../../utils/patientLists/listAutomation';
import { windhoekClock } from '../../../utils/patientLists/listDates';
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
    render(<PatientListsPage />);
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
    render(<PatientListsPage />);
    const card = (await screen.findByText('Birthdays today')).closest('button') as HTMLElement;
    await waitFor(() => expect(within(card).getByText('1')).toBeInTheDocument());
    expect(within(card).getByText('patient')).toBeInTheDocument();
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
