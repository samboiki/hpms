/**
 * A new visit's Medications tab and date (AddVisitTabs): "Edit medication" corrects a prescribed medicine the way
 * Update Visit does (back into the form, off the list, added again), so a wrong dose is fixed without retyping the
 * medicine and is never prescribed twice. No button without a working service is shown (the owner's rule: no fake
 * buttons), and the Encounter Date is written day first. The database and the heavy children are replaced.
 */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Test Practitioner', role: 'doctor', practice_id: 'practice-1', practices: { name: 'Test Practice' } }
}));

vi.mock('../../../lib/supabase', () => {
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'gte', 'lte', 'order', 'limit', 'range', 'ilike', 'not']) chain[name] = self;
    const single = () =>
      Promise.resolve({
        data: table === 'users' ? { practice_id: 'practice-1' } : table === 'practices' ? { practice_type: 'general_practice' } : null,
        error: null
      });
    chain.single = single;
    chain.maybeSingle = single;
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve, reject);
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
vi.mock('../../requests/LabResultsTable', () => ({ default: () => null }));
vi.mock('../../requests/ImagingTabContentSimple', () => ({ default: () => null }));
vi.mock('../../uploads/MediaUploadWrapper', () => ({ default: () => null }));
vi.mock('../../uploads/FileDisplayComponent', () => ({ default: () => null }));
vi.mock('../../uploads/FileUploadComponent', () => ({ default: () => null }));
vi.mock('../LeaveFormTab', () => ({ default: () => null }));
vi.mock('../HandoffCard', () => ({ default: () => null }));
vi.mock('../BillingLineDetails', () => ({ default: () => null }));
vi.mock('../InvoiceBillingSummary', () => ({ default: () => null }));
vi.mock('../../quotes/BundleMenu', () => ({ default: () => null }));
vi.mock('../../dental/TeethBillingPanel', () => ({ default: () => null }));
vi.mock('../../dental/ToothPickerDialog', () => ({ default: () => null }));
vi.mock('../../billing/Icd10DiagnosisSearch', () => ({ default: () => null }));
vi.mock('../../patients/safety/DiagnosisToProblems', () => ({ DiagnosisToProblems: () => null }));
// No allergy on file: a medicine is added straight away
vi.mock('../../patients/safety/useMedicineAllergyCheck', () => ({
  useMedicineAllergyCheck: () => ({ confirmMedicine: (_name: string, add: () => void) => add(), dialog: null })
}));
vi.mock('react-hot-toast', () => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return { toast, default: toast };
});
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import AddVisitTabs from '../AddVisitTabs';

const renderNewVisit = (activeTab: string) =>
  render(<AddVisitTabs patientId="patient-1" activeTab={activeTab} onSuccess={vi.fn()} onCancel={vi.fn()} selectedServices={[]} onSelectedServicesChange={vi.fn()} />);

const chooseDosage = (dosage: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Select dosage|mg$/ }));
  fireEvent.click(screen.getByRole('button', { name: dosage }));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('Edit medication on a new visit', () => {
  it('takes the medicine back into the form and off the list; the corrected medicine is added once', async () => {
    renderNewVisit('medications');
    fireEvent.change(await screen.findByPlaceholderText('e.g., Amoxicillin'), { target: { value: 'Amoxicillin' } });
    chooseDosage('500mg');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('cell', { name: 'Amoxicillin' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '500mg' })).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Edit medication'));
    // Nothing to retype: the medicine and its dose are back in the form, and the list no longer has it
    expect(screen.getByPlaceholderText('e.g., Amoxicillin')).toHaveValue('Amoxicillin');
    expect(screen.getByRole('button', { name: '500mg' })).toBeInTheDocument();
    expect(screen.getByText('No medications prescribed yet')).toBeInTheDocument();

    chooseDosage('250mg');
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByRole('cell', { name: 'Amoxicillin' })).toHaveLength(1);
    expect(screen.getByRole('cell', { name: '250mg' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: '500mg' })).not.toBeInTheDocument();
  });
});

describe('the Medications tab of a new visit', () => {
  // Nothing answers it yet (the AI service reads lab results and searches patients only): a button that does nothing is not shown
  it('shows no AI prescription button', async () => {
    renderNewVisit('medications');
    await screen.findByPlaceholderText('e.g., Amoxicillin');
    expect(screen.queryByTitle('AI-Powered Prescription Assistant')).not.toBeInTheDocument();
  });
});

describe('the Encounter Date of a new visit', () => {
  it('is written day first (7 Oct 2026), never month first', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 9, 30));
    renderNewVisit('general');
    expect(await screen.findByText('7 Oct 2026')).toBeInTheDocument();
    expect(screen.queryByText('Oct 7, 2026')).not.toBeInTheDocument();
  });
});
