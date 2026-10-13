/**
 * Medicines prescribed in a visit. The prescription printed from the visit and the patient's medicine list are made
 * from the rows saved here, so a medicine is only kept with a real name (3 letters or more), its dose and how often
 * it is taken. Both "Update Visit" (EditVisitTabs) and "Create Visit" (AddVisitTabs) check every medicine before
 * anything is written, and save one at a time: a double click or a retry never writes a second visit or invoice.
 * The database and the heavy children are replaced; every write is recorded.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };

const mocks = vi.hoisted(() => ({
  // Every write, in order
  writes: [] as { table: string; op: 'insert' | 'update' | 'delete'; rows?: Row[] }[],
  // A table whose next insert fails (a lost connection, say), once; the failed insert writes nothing
  failNextInsert: null as string | null,
  user: { id: 'u1', name: 'Test Practitioner', role: 'doctor', practice_id: 'practice-1', practices: { name: 'Test Practice' } }
}));

vi.mock('../../../lib/supabase', () => {
  const singleRow = (table: string, inserted: boolean): Promise<Result> => {
    if (table === 'visits') {
      // A new visit's row as saved, or the existing visit being edited
      return Promise.resolve({ data: inserted ? { id: 'visit-1' } : { id: 'visit-1', patient_id: 'patient-1', practice_id: 'practice-1', status: 'in-progress', visit_type: 'consultation' }, error: null });
    }
    if (table === 'users') return Promise.resolve({ data: { practice_id: 'practice-1' }, error: null });
    if (table === 'practices') return Promise.resolve({ data: { practice_type: 'general_practice' }, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    let inserted = false;
    let failed = false;
    const self = () => chain;
    for (const name of ['select', 'eq', 'neq', 'in', 'or', 'is', 'gte', 'lte', 'order', 'limit', 'range', 'ilike', 'not']) chain[name] = self;
    chain.insert = (rows: Row[]) => {
      inserted = true;
      if (mocks.failNextInsert === table) {
        mocks.failNextInsert = null;
        failed = true;
        return chain;
      }
      mocks.writes.push({ table, op: 'insert', rows });
      return chain;
    };
    chain.update = (row: Row) => {
      mocks.writes.push({ table, op: 'update', rows: [row] });
      return chain;
    };
    chain.delete = () => {
      mocks.writes.push({ table, op: 'delete' });
      return chain;
    };
    chain.single = () => singleRow(table, inserted);
    chain.maybeSingle = () => singleRow(table, inserted);
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(failed ? { data: null, error: { message: 'The connection was lost' } } : { data: [], error: null }).then(resolve, reject);
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: () => builder('rpc'),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) }
    }
  };
});
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (selector: (state: { user: typeof mocks.user }) => unknown) => selector({ user: mocks.user }) }));
vi.mock('../../../stores/visitsStore', () => ({ useVisitsStore: { getState: () => ({ completeVisit: vi.fn(), moveVisitToStage: vi.fn() }) } }));
vi.mock('../../../services/invoiceService', () => ({ invoiceService: { generateInvoiceFromVisit: vi.fn() }, changedSplits: () => [], findInvoiceLineProblems: () => [] }));
vi.mock('../../../services/invoicingSetup', () => ({ loadInvoicingSetup: () => Promise.resolve({ lineDetails: false, createdBy: false, audit: false }) }));
vi.mock('../../../services/invoiceDocumentService', () => ({ makeInvoicePdf: vi.fn() }));
vi.mock('../../../services/invoiceContextService', () => ({ loadCopayRules: () => Promise.resolve({ rules: [], error: null }) }));
vi.mock('../../../services/documentGenerationService', () => ({ documentGenerationService: { generateVisitDocuments: vi.fn(() => Promise.resolve([])) } }));
vi.mock('../../../services/practiceTariffService', () => ({ loadPracticeTariffRows: () => Promise.resolve({ rows: [], problems: [] }) }));
vi.mock('../../../services/recordFiles', () => ({ openRecord: vi.fn() }));
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
vi.mock('../BillingLineDetails', () => ({ default: () => null }));
vi.mock('../InvoiceBillingSummary', () => ({ default: () => null }));
vi.mock('../ClaimedInvoiceNotice', () => ({ ClaimedInvoiceNotice: () => null }));
vi.mock('../../quotes/BundleMenu', () => ({ default: () => null }));
vi.mock('../../stock/StockLineMenu', () => ({ StockLineMenu: () => null }));
vi.mock('../../stock/VisitDispensingPanel', () => ({ VisitDispensingPanel: () => null }));
vi.mock('../../optometry/VisitEyeExamPanel', () => ({ default: () => null }));
vi.mock('../../dental/TeethBillingPanel', () => ({ default: () => null }));
vi.mock('../../dental/ToothPickerDialog', () => ({ default: () => null }));
vi.mock('../../uploads/FileUploadComponent', () => ({ default: () => null }));
vi.mock('../../uploads/FileDisplayComponent', () => ({ default: () => null }));
vi.mock('../../uploads/MediaUploadWrapper', () => ({ default: () => null }));
vi.mock('../../requests/LabResultsTable', () => ({ default: () => null }));
vi.mock('../../requests/ImagingTabContentSimple', () => ({ default: () => null }));
vi.mock('../LeaveFormTab', () => ({ default: () => null }));
vi.mock('../HandoffCard', () => ({ default: () => null }));
vi.mock('../../billing/Icd10DiagnosisSearch', () => ({ default: () => null }));
vi.mock('../../patients/safety/DiagnosisToProblems', () => ({ DiagnosisToProblems: () => null }));
// No allergy on record: a medicine is added straight away
vi.mock('../../patients/safety/useMedicineAllergyCheck', () => ({
  useMedicineAllergyCheck: () => ({ confirmMedicine: (_name: string, add: () => void) => add(), dialog: null })
}));
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

import { toast } from 'react-hot-toast';
import AddVisitTabs from '../AddVisitTabs';
import EditVisitTabs from '../EditVisitTabs';

const PATIENT_ID = 'patient-1';

const writesTo = (table: string, op: 'insert' | 'update' | 'delete') => mocks.writes.filter(write => write.table === table && write.op === op);
const rowsInserted = (table: string) => writesTo(table, 'insert').flatMap(write => write.rows ?? []);

// The Medications tab's "Add New Medication" row: a name, then a dose and how often from their pickers
const addMedicine = async ({ name, dosage, frequency }: { name: string; dosage: string; frequency?: string }) => {
  fireEvent.change(await screen.findByPlaceholderText('e.g., Amoxicillin'), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: /Select dosage/ }));
  fireEvent.click(await screen.findByRole('button', { name: dosage }));
  if (frequency) {
    fireEvent.click(screen.getByRole('button', { name: /Select frequency/ }));
    fireEvent.click(await screen.findByRole('button', { name: frequency }));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));
  // In the prescribed list
  await screen.findByRole('cell', { name: name.trim() });
};

// A new visit with its clinical fields filled in, opened on the Medications tab
const newVisitOnMedications = async () => {
  const onSuccess = vi.fn();
  const props = { patientId: PATIENT_ID, onSuccess, onCancel: vi.fn(), selectedServices: [], onSelectedServicesChange: vi.fn() };
  const view = render(<AddVisitTabs {...props} activeTab="general" />);
  fireEvent.change(await screen.findByPlaceholderText('Primary reason for visit'), { target: { value: 'Sore throat for three days' } });
  fireEvent.change(screen.getByPlaceholderText('Clinical diagnosis and findings'), { target: { value: 'Acute tonsillitis' } });
  fireEvent.change(screen.getByPlaceholderText('Recommended treatment and procedures'), { target: { value: 'Antibiotic course' } });
  view.rerender(<AddVisitTabs {...props} activeTab="medications" />);
  return { onSuccess };
};

beforeEach(() => {
  mocks.writes = [];
  mocks.failNextInsert = null;
  vi.mocked(toast.error).mockClear();
});

describe('Create Visit with medicines (a new visit)', () => {
  it('saves each medicine with the new visit: for this visit and patient, prescribed by the person signed in, active', async () => {
    const { onSuccess } = await newVisitOnMedications();
    // A stray space typed after the name does not make it another medicine
    await addMedicine({ name: 'Amoxicillin ', dosage: '500mg', frequency: '3 times daily' });

    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(rowsInserted('medications')).toEqual([
      expect.objectContaining({
        visit_id: 'visit-1',
        patient_id: PATIENT_ID,
        medication_name: 'Amoxicillin',
        dosage: '500mg',
        frequency: '3 times daily',
        prescribed_by: 'u1',
        status: 'active'
      })
    ]);
  });

  it('never writes a medicine without how often it is taken, and says so', async () => {
    await newVisitOnMedications();
    await addMedicine({ name: 'Amoxicillin', dosage: '500mg' });

    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Visit not saved. Frequency is required for Amoxicillin.', { duration: 8000 }));
    expect(rowsInserted('medications')).toEqual([]);
  });

  // Reported 12 Oct 2026: Create Visit wrote the visit and its invoice first and checked the medicines after, so a
  // refused medicine left the window open on a visit already saved, and pressing Create Visit again saved a second
  // visit and billed the patient twice. Every check now runs before anything is written, as on Update Visit.
  it('checks the medicines before anything is written: a refused save leaves nothing to save twice', async () => {
    const { onSuccess } = await newVisitOnMedications();
    await addMedicine({ name: 'Amoxicillin', dosage: '500mg' });

    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Visit not saved. Frequency is required for Amoxicillin.', { duration: 8000 }));
    expect(mocks.writes).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // A double click must never create two visits or bill the patient twice: the second click while the first save runs
  // does nothing
  it('saves one visit for a double click on Create Visit', async () => {
    const { onSuccess } = await newVisitOnMedications();
    await addMedicine({ name: 'Amoxicillin', dosage: '500mg', frequency: '3 times daily' });

    const create = screen.getByRole('button', { name: /Create Visit/ });
    fireEvent.click(create);
    fireEvent.click(create);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(writesTo('visits', 'insert')).toHaveLength(1);
    expect(rowsInserted('medications')).toHaveLength(1);
  });

  // When a step after the visit fails (here the vitals: a lost connection), the visit is already written. Pressing
  // Create Visit again must update that visit, not insert a second one (the patient would have two visits)
  it('updates the visit it already wrote when Create Visit is pressed again after a failed step', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const onSuccess = vi.fn();
    const props = { patientId: PATIENT_ID, onSuccess, onCancel: vi.fn(), selectedServices: [], onSelectedServicesChange: vi.fn() };
    const view = render(<AddVisitTabs {...props} activeTab="general" />);
    fireEvent.change(await screen.findByPlaceholderText('Primary reason for visit'), { target: { value: 'Sore throat for three days' } });
    view.rerender(<AddVisitTabs {...props} activeTab="vitals" />);
    fireEvent.change(await screen.findByPlaceholderText('120/80'), { target: { value: '120/80' } });
    view.rerender(<AddVisitTabs {...props} activeTab="medications" />);
    await addMedicine({ name: 'Amoxicillin', dosage: '500mg', frequency: '3 times daily' });

    mocks.failNextInsert = 'vitals';
    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));
    await waitFor(() => expect(alert).toHaveBeenCalledWith(expect.stringMatching(/^Failed to create visit/)));
    expect(writesTo('visits', 'insert')).toHaveLength(1);
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Create Visit/ }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(writesTo('visits', 'insert')).toHaveLength(1);
    expect(writesTo('visits', 'update')).toHaveLength(1);
    expect(rowsInserted('vitals')).toHaveLength(1);
    expect(rowsInserted('medications')).toHaveLength(1);
    alert.mockRestore();
  });
});

describe('Update Visit with medicines (an existing visit)', () => {
  it('checks every medicine before anything is written: one without how often it is taken stops the save, named', async () => {
    const onSuccess = vi.fn();
    render(
      <EditVisitTabs visitId="visit-1" patientId={PATIENT_ID} activeTab="medications" onSuccess={onSuccess} onCancel={vi.fn()} selectedServices={[]} onSelectedServicesChange={vi.fn()} />
    );
    await addMedicine({ name: 'Amoxicillin', dosage: '500mg' });

    fireEvent.click(screen.getByRole('button', { name: /Update Visit/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Visit not saved. Frequency is required for Amoxicillin.', { duration: 8000 }));
    expect(writesTo('visits', 'update')).toEqual([]);
    expect(mocks.writes.filter(write => write.table === 'medications')).toEqual([]);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // Two saves at once could each make the visit's invoice, and their delete-then-insert of the medicines could
  // interleave into duplicates: a double click on Update Visit saves once
  it('saves once for a double click on Update Visit', async () => {
    const onSuccess = vi.fn();
    render(
      <EditVisitTabs visitId="visit-1" patientId={PATIENT_ID} activeTab="medications" onSuccess={onSuccess} onCancel={vi.fn()} selectedServices={[]} onSelectedServicesChange={vi.fn()} />
    );
    await addMedicine({ name: 'Amoxicillin', dosage: '500mg', frequency: '3 times daily' });

    const update = screen.getByRole('button', { name: /Update Visit/ });
    fireEvent.click(update);
    fireEvent.click(update);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(writesTo('visits', 'update')).toHaveLength(1);
    expect(rowsInserted('medications')).toHaveLength(1);
  });
});
