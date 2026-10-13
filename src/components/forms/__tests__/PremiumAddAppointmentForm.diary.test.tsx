import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DEFAULT_TYPE_LENGTHS } from '../../../utils/diary/bookingLength';

// An invented practice in memory: two doctors and a receptionist, one patient. Queries filter on eq() only.
const mocks = vi.hoisted(() => {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    users: [
      { id: 'dr-a', practice_id: 'pr1', full_name: 'Ama Example', role: 'doctor', is_active: true },
      { id: 'dr-b', practice_id: 'pr1', full_name: 'Ben Sample', role: 'doctor', is_active: true },
      { id: 'rec-1', practice_id: 'pr1', full_name: 'Dee Front', role: 'receptionist', is_active: true }
    ],
    patients: [{ id: 'pt-1', practice_id: 'pr1', first_name: 'Anna', last_name: 'Tester', cell_number: '0810000001' }],
    practices: [{ id: 'pr1', business_hours: null }]
  };
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    let single = false;
    const api: Record<string, unknown> = {};
    for (const name of ['select', 'order', 'limit', 'range', 'gte', 'lte', 'in', 'neq', 'or', 'is', 'update']) api[name] = () => api;
    api.eq = (column: string, value: unknown) => {
      rows = rows.filter((row) => !(column in row) || row[column] === value);
      return api;
    };
    api.single = () => {
      single = true;
      return api;
    };
    api.maybeSingle = api.single;
    api.then = (resolve: (value: unknown) => void) => resolve({ data: single ? rows[0] ?? null : rows, error: null });
    return api;
  };
  return {
    from,
    user: { id: 'rec-1', role: 'receptionist' },
    diaryDefault: { status: 'ready', saved: null as string[] | null, save: vi.fn() },
    // The same objects on every render, as the real hooks return (new arrays each time would re-run the form's effects
    // forever)
    blocks: { status: 'ready', blocks: [], error: null, reload: () => {} },
    settings: null as unknown
  };
});
vi.mock('../../../lib/supabase', () => ({ supabase: { from: mocks.from } }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: mocks.user }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../hooks/useDiaryDefault', () => ({ useDiaryDefault: () => mocks.diaryDefault }));
vi.mock('../../../hooks/useDiaryBlocks', () => ({ useDiaryBlocks: () => mocks.blocks }));
vi.mock('../../../hooks/useDiarySettings', () => ({ useDiarySettings: () => mocks.settings }));
mocks.settings = { status: 'ready', settings: { lengths: DEFAULT_TYPE_LENGTHS }, hours: [], hoursStatus: 'ready', reload: () => {} };
vi.mock('../../../services/diaryService', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  loadBookedTimes: vi.fn().mockResolvedValue([]),
  loadNoShowHistory: vi.fn().mockResolvedValue(null),
  checkBooking: vi.fn().mockResolvedValue([])
}));

import PremiumAddAppointmentForm from '../PremiumAddAppointmentForm';

const practitionerSelect = () => screen.findByLabelText('Practitioner') as Promise<HTMLSelectElement>;
const signIn = (id: string, role: string, saved: string[] | null = null) => {
  mocks.user = { id, role };
  mocks.diaryDefault = { status: 'ready', saved, save: vi.fn().mockResolvedValue({ ok: true }) };
};

beforeEach(() => signIn('rec-1', 'receptionist'));

// Q9: a new booking starts with the practitioner the user works with, unless reception clicked another's column
describe('PremiumAddAppointmentForm: who a new booking starts with', () => {
  it("starts a doctor's booking with themselves, as their diary opens on their own column", async () => {
    signIn('dr-a', 'doctor');
    render(<PremiumAddAppointmentForm onSuccess={() => {}} />);
    await waitFor(async () => expect((await practitionerSelect()).value).toBe('dr-a'));
  });

  it("starts with the receptionist's saved default practitioner", async () => {
    signIn('rec-1', 'receptionist', ['dr-b']);
    render(<PremiumAddAppointmentForm onSuccess={() => {}} />);
    await waitFor(async () => expect((await practitionerSelect()).value).toBe('dr-b'));
  });

  it('leaves the practitioner to reception when the default is everyone: a guess would go unnoticed', async () => {
    render(<PremiumAddAppointmentForm onSuccess={() => {}} />);
    const select = await practitionerSelect();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(select.value).toBe('');
  });

  it("starts with the column or slot it was opened from, over the user's default", async () => {
    signIn('dr-a', 'doctor');
    render(<PremiumAddAppointmentForm onSuccess={() => {}} initialDoctorId="dr-b" />);
    await waitFor(async () => expect((await practitionerSelect()).value).toBe('dr-b'));
  });

  it('keeps the chosen practitioner as the default with "Remember as my default"', async () => {
    render(<PremiumAddAppointmentForm onSuccess={() => {}} />);
    fireEvent.change(await practitionerSelect(), { target: { value: 'dr-b' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Remember as my default' }));
    await waitFor(() => expect(mocks.diaryDefault.save).toHaveBeenCalledWith(['dr-b']));
  });

  it('says when the chosen practitioner already is the default, instead of offering to save it again', async () => {
    signIn('rec-1', 'receptionist', ['dr-b']);
    render(<PremiumAddAppointmentForm onSuccess={() => {}} />);
    expect(await screen.findByText('Your default practitioner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remember as my default' })).toBeNull();
  });

  it('offers no "Remember as my default" before the database can keep it', async () => {
    mocks.diaryDefault = { status: 'not_enabled', saved: null, save: vi.fn() };
    render(<PremiumAddAppointmentForm onSuccess={() => {}} initialDoctorId="dr-b" />);
    await waitFor(async () => expect((await practitionerSelect()).value).toBe('dr-b'));
    expect(screen.queryByRole('button', { name: 'Remember as my default' })).toBeNull();
  });
});

// B8: "Book again" and a pasted copy fill the form in; everything stays editable and the usual checks run on save
describe('PremiumAddAppointmentForm: a copied booking', () => {
  const copy = {
    patientId: 'pt-1',
    patientName: 'Anna Tester',
    patientFirstName: 'Anna',
    practitionerId: 'dr-b',
    type: 'procedure' as const,
    durationMinutes: 45,
    reason: 'Dressing change'
  };

  it("starts with the copy's patient, practitioner, type and reason, and lets reception change the patient", async () => {
    render(<PremiumAddAppointmentForm onSuccess={() => {}} prefill={copy} />);
    const patient = screen.getByPlaceholderText('Search by name, ID, cell or reference...') as HTMLInputElement;
    expect(patient.value).toBe('Anna Tester');
    expect(patient.disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Clear the selected patient' })).toBeInTheDocument();
    expect((screen.getByPlaceholderText('Add any special instructions or notes...') as HTMLTextAreaElement).value).toBe('Dressing change');
    expect(screen.getByText('procedure')).toBeInTheDocument();
    await waitFor(async () => expect((await practitionerSelect()).value).toBe('dr-b'));
  });

  it('opens without a date when "Book again" found no free time, and asks for one instead of saving', async () => {
    const onSuccess = vi.fn();
    render(<PremiumAddAppointmentForm onSuccess={onSuccess} prefill={copy} initialDate={null} />);
    expect(screen.getByText('Select date')).toBeInTheDocument();
    await waitFor(async () => expect((await practitionerSelect()).value).toBe('dr-b'));
    fireEvent.click(screen.getByRole('button', { name: /Schedule Appointment/ }));
    expect(await screen.findByText('Choose the date of the appointment.')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

// B6: the practice's own appointment types set the length, and their daily limit is checked before saving
describe("PremiumAddAppointmentForm: the practice's appointment types", () => {
  const NEW_PATIENT = { id: 't-new', name: 'New patient', visitType: 'consultation' as const, lengthMinutes: 45, dailyLimit: 4, isActive: true };
  const REMOVED = { id: 't-old', name: 'Old type', visitType: 'procedure' as const, lengthMinutes: 60, dailyLimit: null, isActive: false };
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const withTypes = () => {
    mocks.settings = {
      status: 'ready',
      settings: { lengths: DEFAULT_TYPE_LENGTHS, slots: {} },
      hours: [],
      hoursStatus: 'ready',
      statuses: [],
      appointmentTypes: [NEW_PATIENT, REMOVED],
      reload: () => {}
    };
  };

  it('offers the active types first and books "New patient" for its 45 minutes', async () => {
    withTypes();
    render(<PremiumAddAppointmentForm onSuccess={() => {}} initialDoctorId="dr-a" initialDate={nextWeek} initialTime="09:00" />);
    fireEvent.click(await screen.findByRole('button', { name: /consultation/i }));
    expect(screen.getByText("Your practice's appointment types")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Old type/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /New patient/ }));
    expect(await screen.findByText('45 min, at most 4 a day per practitioner, billed as Consultation')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Appointment ends at').parentElement).toHaveTextContent('9:45 AM'));
  });

  it('checks the type\'s daily limit before saving and lets reception book anyway', async () => {
    withTypes();
    const { checkBooking } = await import('../../../services/diaryService');
    vi.mocked(checkBooking).mockResolvedValueOnce([
      { kind: 'type_daily_limit', message: 'New patient: Ama Example already has 4 on that day, and the practice books at most 4 a day.' }
    ]);
    render(
      <PremiumAddAppointmentForm onSuccess={() => {}} initialDoctorId="dr-a" initialPatientId="pt-1" initialDate={nextWeek} initialTime="09:00" initialAppointmentTypeId="t-new" />
    );
    expect(await screen.findByText('New patient')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Schedule Appointment/ }));
    expect(await screen.findByText(/already has 4 on that day/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book anyway' })).toBeInTheDocument();
    expect(vi.mocked(checkBooking)).toHaveBeenCalledWith(expect.objectContaining({ appointmentType: NEW_PATIENT }));
  });
});

// The Reschedule form's Cancel Appointment freed the time without telling the diary, so the waiting list was never
// offered it (Cancel Visit and Delete Booking offer it)
describe('PremiumAddAppointmentForm: cancelling the booking being rescheduled', () => {
  it('says the booking was cancelled before closing, so the diary can offer its time to the waiting list', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const calls: string[] = [];
    render(
      <PremiumAddAppointmentForm
        onSuccess={() => calls.push('closed')}
        onCancelled={() => calls.push('cancelled')}
        editingAppointmentId="visit-1"
        initialDoctorId="dr-a"
        initialPatientId="pt-1"
        initialDate={new Date(2026, 9, 20)}
        initialTime="09:00"
      />
    );
    fireEvent.click(await screen.findByRole('button', { name: /Cancel Appointment/ }));
    await waitFor(() => expect(calls).toEqual(['cancelled', 'closed']));
    confirm.mockRestore();
  });

  it('says nothing when reception changes their mind at the question', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onCancelled = vi.fn();
    render(<PremiumAddAppointmentForm onSuccess={() => {}} onCancelled={onCancelled} editingAppointmentId="visit-1" initialDoctorId="dr-a" />);
    fireEvent.click(await screen.findByRole('button', { name: /Cancel Appointment/ }));
    expect(onCancelled).not.toHaveBeenCalled();
    confirm.mockRestore();
  });
});
