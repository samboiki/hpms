/**
 * A new visit (AddVisitTabs, inside the full-screen "Add visit" window): it starts empty, each tab the window's
 * tab bar opens shows its own panel, a visit is only saved with its clinical reason, diagnosis and plan, and
 * "Create Visit" saves it once, for this patient in the practice of the person signed in, with its vitals.
 * The database and the heavy children are replaced; every write is recorded so a test can say what was saved.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  // Every table the screen opens, in order, and every insert: { table, rows }
  tables: [] as string[],
  inserts: [] as { table: string; rows: Row[] }[],
  // The answer to saving the visit row (a test can hold it to look at the screen while it saves)
  visitInsert: (): Promise<Result> => Promise.resolve({ data: { id: 'visit-1' }, error: null }),
  practiceId: 'practice-1',
  user: { id: 'u1', name: 'Test Practitioner', role: 'doctor', practice_id: 'practice-1', practices: { name: 'Test Practice' } }
}));

vi.mock('../../../lib/supabase', () => {
  // Single rows the screen reads while it loads: the person's practice and its practice type
  const singleRow = (table: string, inserted: boolean): Promise<Result> => {
    if (table === 'visits' && inserted) return mocks.visitInsert();
    if (table === 'users') return Promise.resolve({ data: { practice_id: 'practice-1' }, error: null });
    if (table === 'practices') return Promise.resolve({ data: { practice_type: 'general_practice' }, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    let inserted = false;
    const self = () => chain;
    for (const name of ['select', 'update', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'gte', 'lte', 'order', 'limit', 'range', 'ilike', 'not']) chain[name] = self;
    chain.insert = (rows: Row[]) => {
      inserted = true;
      mocks.inserts.push({ table, rows });
      return chain;
    };
    chain.single = () => singleRow(table, inserted);
    chain.maybeSingle = () => singleRow(table, inserted);
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => {
        mocks.tables.push(table);
        return builder(table);
      },
      rpc: () => builder('rpc'),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) }
    }
  };
});
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: mocks.practiceId }) }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (selector: (state: { user: typeof mocks.user }) => unknown) => selector({ user: mocks.user }) }));
vi.mock('../../../services/invoiceService', () => ({ invoiceService: { generateInvoiceFromVisit: vi.fn() } }));
vi.mock('../../../services/documentGenerationService', () => ({ documentGenerationService: { generateVisitDocuments: vi.fn(() => Promise.resolve([])) } }));
vi.mock('../../../services/practiceTariffService', () => ({ loadPracticeTariffRows: () => Promise.resolve({ rows: [], problems: [] }) }));
vi.mock('../patientMedicalAid', () => ({ loadPatientHasMedicalAid: () => Promise.resolve(false) }));
vi.mock('../useFundPricing', () => ({
  useFundPricing: () => ({ status: 'ready', pricing: { practiceId: 'practice-1', fund: null, book: { rows: [], contracts: [] } }, blockMessage: null, infectionControlStaff: [] })
}));
vi.mock('../useVisitBilling', () => ({
  useVisitBilling: ({ services }: { services: unknown[] }) => ({
    invoiceContext: { status: 'ready', problems: [], practitioners: [], invoice: null, copayRules: [], billedLines: [] },
    copayRule: null,
    lineAmounts: new Map(),
    totals: { totalCents: 0, fundCents: 0, patientCents: 0, discountCents: 0 },
    duplicates: [],
    lineDetailsEditable: false,
    lineCodesEditable: false,
    canChangeFee: false,
    lineIcd10: new Map(),
    servicesForInvoice: services,
    // No referrals or authorisations on file
    registers: { status: 'ready', message: null, referrals: [], authorisations: [], usage: new Map(), reload: () => undefined },
    lineAuthorisations: new Map(),
    authorisationNotices: [],
    linePeople: { editable: false, referrals: [] },
    toothProblem: null,
    withLineDetails: () => []
  })
}));
vi.mock('../useVisitClaimDetails', () => ({
  useVisitClaimDetails: () => ({ status: 'ready', message: null, draft: {}, setDraft: () => undefined, dirty: false, save: () => Promise.resolve(null) })
}));
vi.mock('../VisitClaimDetailsCard', () => ({ default: () => null }));
// The panels other tabs open: each shows whose record it files into
vi.mock('../../requests/LabResultsTable', () => ({ default: ({ patientId }: { patientId: string }) => <div data-testid="lab-results-table">{patientId}</div> }));
vi.mock('../../requests/ImagingTabContentSimple', () => ({ default: ({ patientId }: { patientId: string }) => <div data-testid="imaging-tab-content">{patientId}</div> }));
vi.mock('../../uploads/MediaUploadWrapper', () => ({ default: ({ patientId }: { patientId: string }) => <div data-testid="media-upload-wrapper">{patientId}</div> }));
vi.mock('../../uploads/FileDisplayComponent', () => ({ default: ({ patientId }: { patientId: string }) => <div data-testid="file-display-component">{patientId}</div> }));
vi.mock('../../uploads/FileUploadComponent', () => ({ default: () => null }));
vi.mock('../LeaveFormTab', () => ({ default: () => <div data-testid="leave-form" /> }));
vi.mock('../HandoffCard', () => ({ default: () => null }));
vi.mock('../BillingLineDetails', () => ({ default: () => null }));
vi.mock('../InvoiceBillingSummary', () => ({ default: () => null }));
vi.mock('../../quotes/BundleMenu', () => ({ default: () => null }));
vi.mock('../../dental/TeethBillingPanel', () => ({ default: () => null }));
vi.mock('../../dental/ToothPickerDialog', () => ({ default: () => null }));
vi.mock('../../billing/Icd10DiagnosisSearch', () => ({ default: () => null }));
vi.mock('../../patients/safety/DiagnosisToProblems', () => ({ DiagnosisToProblems: () => null }));
vi.mock('../../patients/safety/useMedicineAllergyCheck', () => ({ useMedicineAllergyCheck: () => ({ confirmMedicine: vi.fn(), dialog: null }) }));
// Icons are decorative here; a real icon fetches its shape on a timer that can outlive the test
vi.mock('@iconify/react', async (importOriginal) => ({ ...(await importOriginal<typeof import('@iconify/react')>()), Icon: () => null }));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast, default: toast };
});
vi.mock('framer-motion', () => {
  // One stable component (a new one per render would remount the screen on every update)
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return {
    motion: new Proxy({}, { get: () => Plain }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
  };
});

import AddVisitTabs from '../AddVisitTabs';

const PATIENT_ID = 'patient-1';

const renderNewVisit = (activeTab = 'general') => {
  const onSuccess = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <AddVisitTabs patientId={PATIENT_ID} activeTab={activeTab} onSuccess={onSuccess} onCancel={onCancel} selectedServices={[]} onSelectedServicesChange={vi.fn()} />
  );
  // The window's tab bar changes the tab on the same visit (what was typed stays)
  const showTab = (tab: string) =>
    view.rerender(
      <AddVisitTabs patientId={PATIENT_ID} activeTab={tab} onSuccess={onSuccess} onCancel={onCancel} selectedServices={[]} onSelectedServicesChange={vi.fn()} />
    );
  return { onSuccess, onCancel, showTab };
};

const fillClinicalFields = async () => {
  fireEvent.change(await screen.findByPlaceholderText('Primary reason for visit'), { target: { value: 'Sore throat for three days' } });
  fireEvent.change(screen.getByPlaceholderText('Clinical diagnosis and findings'), { target: { value: 'Acute pharyngitis' } });
  fireEvent.change(screen.getByPlaceholderText('Recommended treatment and procedures'), { target: { value: 'Rest and fluids' } });
};

const insertsInto = (table: string) => mocks.inserts.filter(insert => insert.table === table).flatMap(insert => insert.rows);

beforeEach(() => {
  mocks.tables = [];
  mocks.inserts = [];
  mocks.visitInsert = () => Promise.resolve({ data: { id: 'visit-1' }, error: null });
  mocks.practiceId = 'practice-1';
});

describe('a new visit starts empty', () => {
  // A new encounter must never show (and then save) another visit's notes against this patient
  it('opens with empty clinical fields, as a consultation, with Create Visit (not Update Visit) and Cancel', async () => {
    renderNewVisit();
    expect(await screen.findByPlaceholderText('Primary reason for visit')).toHaveValue('');
    expect(screen.getByPlaceholderText('Clinical diagnosis and findings')).toHaveValue('');
    expect(screen.getByPlaceholderText('Recommended treatment and procedures')).toHaveValue('');
    expect(screen.getByPlaceholderText('Additional notes and observations (optional)')).toHaveValue('');
    expect(screen.getByRole('button', { name: /Consultation/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Visit/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByText('Update Visit')).not.toBeInTheDocument();
  });

  it('loads nothing from earlier visits: it does not open the visits table until it saves its own', async () => {
    renderNewVisit();
    // Settled: the practitioners list has loaded
    await screen.findByText('Select Doctor');
    expect(mocks.tables).toContain('users');
    expect(mocks.tables).not.toContain('visits');
  });
});

// The "Add visit" window's tab bar sends these keys; each must open its own panel, filed under this patient
describe('the tabs of a new visit', () => {
  it('Laboratory shows the lab results for this patient', async () => {
    renderNewVisit('laboratory');
    expect(await screen.findByTestId('lab-results-table')).toHaveTextContent(PATIENT_ID);
  });

  it('Imaging shows the imaging requests for this patient', async () => {
    renderNewVisit('imaging');
    expect(await screen.findByTestId('imaging-tab-content')).toHaveTextContent(PATIENT_ID);
  });

  it('Media offers the upload and the files already filed for this patient', async () => {
    renderNewVisit('media');
    expect(await screen.findByTestId('media-upload-wrapper')).toHaveTextContent(PATIENT_ID);
    expect(screen.getByTestId('file-display-component')).toHaveTextContent(PATIENT_ID);
  });

  it('Leave asks to save the visit first: a sick note belongs to a saved visit', async () => {
    renderNewVisit('leave');
    expect(await screen.findByText('Please save the visit first to create a leave form')).toBeInTheDocument();
    expect(screen.queryByTestId('leave-form')).not.toBeInTheDocument();
  });
});

describe('Cancel', () => {
  it('closes the window without saving anything', async () => {
    const { onCancel, onSuccess } = renderNewVisit();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.inserts).toEqual([]);
  });
});

describe('Create Visit', () => {
  // The encounter (and any claim made from it) needs the reason for the visit, the diagnosis and the plan
  it('saves nothing until the chief complaint, diagnosis and treatment plan are filled in, and says what is missing', async () => {
    const { onSuccess } = renderNewVisit();
    fireEvent.click(await screen.findByRole('button', { name: /Create Visit/ }));

    expect(await screen.findByText('Chief complaint is required')).toBeInTheDocument();
    expect(screen.getByText('Diagnosis is required')).toBeInTheDocument();
    expect(screen.getByText('Treatment plan is required')).toBeInTheDocument();
    expect(mocks.inserts).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('saves the visit once, for this patient in the practice of the person signed in, in progress, then closes the window', async () => {
    const { onSuccess } = renderNewVisit();
    await fillClinicalFields();
    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(insertsInto('visits')).toEqual([
      expect.objectContaining({
        patient_id: PATIENT_ID,
        practice_id: 'practice-1',
        // No treating practitioner chosen: the person who records the visit
        doctor_id: 'u1',
        visit_type: 'consultation',
        chief_complaint: 'Sore throat for three days',
        diagnosis: 'Acute pharyngitis',
        treatment_plan: 'Rest and fluids',
        status: 'in-progress',
        // Not booked: a walk-in
        is_scheduled: false
      })
    ]);
  });

  it('saves the visit type staff chose instead of the consultation default', async () => {
    const { onSuccess } = renderNewVisit();
    await fillClinicalFields();
    fireEvent.click(screen.getByRole('button', { name: /Consultation/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Follow-up Visit/ }));
    expect(screen.getByRole('button', { name: /Follow-up Visit/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(insertsInto('visits')).toEqual([expect.objectContaining({ visit_type: 'follow-up' })]);
  });

  // A second click while the first save is still running would create a second visit (and a second invoice)
  it('shows "Creating Visit..." and cannot be pressed again while the visit is being saved', async () => {
    let finishSave: (result: Result) => void = () => undefined;
    mocks.visitInsert = () => new Promise(resolve => { finishSave = resolve; });
    const { onSuccess } = renderNewVisit();
    await fillClinicalFields();
    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));

    const saving = await screen.findByRole('button', { name: /Creating Visit/ });
    expect(saving).toBeDisabled();
    fireEvent.click(saving);
    expect(insertsInto('visits')).toHaveLength(1);

    finishSave({ data: { id: 'visit-1' }, error: null });
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(insertsInto('visits')).toHaveLength(1);
  });
});

describe('vitals of a new visit', () => {
  // The practitioner sees the BMI and its band without working it out, and it is kept with the visit
  it('works out the BMI from weight and height and saves the vitals with the new visit', async () => {
    const { onSuccess, showTab } = renderNewVisit();
    await fillClinicalFields();
    showTab('vitals');
    fireEvent.change(await screen.findByPlaceholderText('70.0'), { target: { value: '70' } });
    fireEvent.change(screen.getByPlaceholderText('175.0'), { target: { value: '175' } });

    // 70 kg / (1.75 m)^2 = 22.86, shown to one decimal
    await waitFor(() => expect(screen.getByText('Normal weight')).toBeInTheDocument());
    expect(screen.getByDisplayValue('22.9')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    const [vitals] = insertsInto('vitals');
    expect(vitals).toEqual(expect.objectContaining({ visit_id: 'visit-1', bmi: 22.9 }));
    expect(Number(vitals.weight)).toBe(70);
    expect(Number(vitals.height)).toBe(175);
  });

  it('saves no vitals row when none were taken', async () => {
    const { onSuccess } = renderNewVisit();
    await fillClinicalFields();
    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(insertsInto('vitals')).toEqual([]);
  });
});
