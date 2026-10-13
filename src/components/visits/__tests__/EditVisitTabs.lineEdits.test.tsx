/**
 * Update Visit (EditVisitTabs) tells the visit screen when a medicine or a billing line changes by clicking only
 * (onLinesEdited, visitEdits.ts), so the screen's X and links ask before that unsaved work is lost. Opening the visit
 * and loading what it already has is never reported: staff are not asked about changes they did not make.
 * The database and the heavy children are replaced; the visit has one medicine saved (invented).
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Test Practitioner', role: 'doctor', practice_id: 'practice-1', practices: { name: 'Test Practice' } },
  savedMedicine: { id: 'med-1', medication_name: 'Amoxicillin', dosage: '500mg', frequency: '3 times daily', duration: '5 days', instructions: '', notes: null }
}));

vi.mock('../../../lib/supabase', () => {
  const singleRow = (table: string) => {
    if (table === 'visits') return Promise.resolve({ data: { id: 'visit-1', patient_id: 'patient-1', practice_id: 'practice-1', status: 'in-progress', visit_type: 'consultation' }, error: null });
    if (table === 'users') return Promise.resolve({ data: { practice_id: 'practice-1' }, error: null });
    if (table === 'practices') return Promise.resolve({ data: { practice_type: 'general_practice' }, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  const builder = (table: string): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'gte', 'lte', 'order', 'limit', 'range', 'ilike', 'not']) chain[name] = self;
    chain.single = () => singleRow(table);
    chain.maybeSingle = () => singleRow(table);
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: table === 'medications_with_details' ? [mocks.savedMedicine] : [], error: null }).then(resolve, reject);
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

import EditVisitTabs from '../EditVisitTabs';

const openVisitOnMedications = async () => {
  const onLinesEdited = vi.fn();
  render(
    <EditVisitTabs
      visitId="visit-1"
      patientId="patient-1"
      activeTab="medications"
      onSuccess={vi.fn()}
      onCancel={vi.fn()}
      selectedServices={[]}
      onSelectedServicesChange={vi.fn()}
      onLinesEdited={onLinesEdited}
    />
  );
  // The saved medicine is on the list once the visit has loaded
  expect(await screen.findByRole('cell', { name: 'Amoxicillin' })).toBeInTheDocument();
  return { onLinesEdited };
};

describe('Update Visit reports changes made by clicking only', () => {
  it('reports nothing for opening the visit and loading its medicine', async () => {
    const { onLinesEdited } = await openVisitOnMedications();
    expect(onLinesEdited).not.toHaveBeenCalled();
  });

  it('reports a medicine removed with its button', async () => {
    const { onLinesEdited } = await openVisitOnMedications();
    fireEvent.click(screen.getByTitle('Remove medication'));
    expect(screen.queryByRole('cell', { name: 'Amoxicillin' })).not.toBeInTheDocument();
    expect(onLinesEdited).toHaveBeenCalled();
  });

  // "Edit medication" takes the medicine off the list into the form: until it is added again, closing would lose it
  it('reports a medicine taken back into the form with Edit medication', async () => {
    const { onLinesEdited } = await openVisitOnMedications();
    fireEvent.click(screen.getByTitle('Edit medication'));
    expect(onLinesEdited).toHaveBeenCalled();
  });
});
