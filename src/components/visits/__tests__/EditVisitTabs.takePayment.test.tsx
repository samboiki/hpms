/**
 * "Invoice and take payment" on an existing visit's Billing tab (the usual case: the patient is at
 * the desk after the consultation): the visit is saved with its invoice exactly as "Update Visit"
 * saves it, Receive payment opens for that invoice, and the visit screen closes only afterwards.
 * A visit whose invoice is already paid has nothing to take, so the action is not offered.
 * The database and the heavy children are replaced.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ServiceSelection } from '../../../types/billing';

const mocks = vi.hoisted(() => ({
  generateInvoiceFromVisit: vi.fn(),
  toothProblem: null as string | null,
  visitInvoice: null as null | { id: string; invoiceNumber: string; paymentStatus: string; lock: null; claim: null },
  user: { id: 'u1', name: 'Front Desk', role: 'receptionist', practice_id: 'practice-1', practices: { name: 'Test Practice' } }
}));

// Every query answers: lists are empty, single rows carry the ids the save needs
vi.mock('../../../lib/supabase', () => {
  const single = () => Promise.resolve({ data: { id: 'visit-1', practice_id: 'practice-1', practice_type: 'general_practice', status: 'in-progress' }, error: null });
  const builder = (): Record<string, unknown> => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'or', 'is', 'gte', 'lte', 'order', 'limit', 'range', 'ilike', 'not']) chain[name] = self;
    chain.single = single;
    chain.maybeSingle = single;
    chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve, reject);
    return chain;
  };
  return {
    supabase: {
      from: () => builder(),
      rpc: () => builder(),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) }
    }
  };
});
// Icons load on a timer that outlives the test; they are decorative here
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (selector: (state: { user: typeof mocks.user }) => unknown) => selector({ user: mocks.user }) }));
vi.mock('../../../stores/visitsStore', () => ({ useVisitsStore: { getState: () => ({ completeVisit: vi.fn(), moveVisitToStage: vi.fn() }) } }));
vi.mock('../../../services/invoiceService', () => ({
  invoiceService: { generateInvoiceFromVisit: mocks.generateInvoiceFromVisit },
  changedSplits: () => [],
  findInvoiceLineProblems: () => []
}));
vi.mock('../../../services/invoicingSetup', () => ({ loadInvoicingSetup: () => Promise.resolve({ lineDetails: false, createdBy: false, audit: false }) }));
vi.mock('../../../services/invoiceDocumentService', () => ({ makeInvoicePdf: vi.fn() }));
vi.mock('../../../services/invoiceContextService', () => ({ loadCopayRules: () => Promise.resolve({ rules: [], error: null }) }));
vi.mock('../../../services/documentGenerationService', () => ({ documentGenerationService: { generateVisitDocuments: vi.fn(() => Promise.resolve([])) } }));
vi.mock('../../../services/recordFiles', () => ({ openRecord: vi.fn() }));
vi.mock('../patientMedicalAid', () => ({ loadPatientHasMedicalAid: () => Promise.resolve(false) }));
vi.mock('../useFundPricing', () => ({
  useFundPricing: () => ({ status: 'ready', pricing: { practiceId: 'practice-1', fund: null, book: { rows: [], contracts: [] } }, blockMessage: null, infectionControlStaff: [] })
}));
vi.mock('../useVisitBilling', () => ({
  useVisitBilling: ({ services }: { services: unknown[] }) => ({
    invoiceContext: { status: 'ready', problems: [], practitioners: [], invoice: mocks.visitInvoice, copayRules: [], billedLines: [] },
    copayRule: null,
    lineAmounts: new Map(),
    totals: { totalCents: 45000, fundCents: 0, patientCents: 45000, discountCents: 0 },
    duplicates: [],
    lineDetailsEditable: false,
    lineCodesEditable: false,
    canChangeFee: false,
    lineIcd10: new Map(),
    // The invoice saves the lines as the Billing tab shows them (no codes to add here)
    servicesForInvoice: services,
    // No referrals or authorisations on file
    registers: { status: 'ready', message: null, referrals: [], authorisations: [], usage: new Map(), reload: () => undefined },
    lineAuthorisations: new Map(),
    authorisationNotices: [],
    linePeople: { editable: false, referrals: [] },
    toothProblem: mocks.toothProblem,
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
vi.mock('../../uploads/FileDisplayComponent', () => ({ default: () => null }));
vi.mock('../../uploads/MediaUploadWrapper', () => ({ default: () => null }));
vi.mock('../../requests/LabResultsTable', () => ({ default: () => null }));
vi.mock('../../requests/ImagingTabContentSimple', () => ({ default: () => null }));
vi.mock('../LeaveFormTab', () => ({ default: () => null }));
vi.mock('../HandoffCard', () => ({ default: () => null }));
vi.mock('../../patients/safety/DiagnosisToProblems', () => ({ DiagnosisToProblems: () => null }));
vi.mock('../../patients/safety/useMedicineAllergyCheck', () => ({ useMedicineAllergyCheck: () => ({ confirmMedicine: vi.fn(), dialog: null }) }));
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
vi.mock('../VisitTakePayment', async importOriginal => ({
  ...(await importOriginal<typeof import('../VisitTakePayment')>()),
  VisitTakePayment: ({ invoiceId, onDone }: { invoiceId: string; onDone: () => void }) => (
    <div data-testid="take-payment">
      Paying {invoiceId}
      <button type="button" onClick={onDone}>Payment done</button>
    </div>
  )
}));

import { toast } from 'react-hot-toast';
import EditVisitTabs from '../EditVisitTabs';

const consultation: ServiceSelection = {
  id: 'line-1', tariffId: 't-0190', code: '0190', description: 'Consultation', category: 'Consultation', unitPrice: 450, quantity: 1, totalPrice: 450
};

const renderBilling = (onSuccess = vi.fn()) => {
  render(
    <EditVisitTabs visitId="visit-1" patientId="pt1" activeTab="billing" onSuccess={onSuccess} onCancel={vi.fn()} selectedServices={[consultation]} onSelectedServicesChange={vi.fn()} />
  );
  return onSuccess;
};

beforeEach(() => {
  mocks.generateInvoiceFromVisit.mockReset();
  mocks.generateInvoiceFromVisit.mockResolvedValue({ id: 'inv-7', invoiceNumber: 'INV-7', warnings: [] });
  mocks.visitInvoice = null;
  mocks.toothProblem = null;
});

// Dental practices: a fund rejects a claim line whose code needs a tooth but carries none, so the visit is not saved
// (and no invoice is made) until the line has its tooth; staff are told which code, on the Billing tab
describe('a dental line without the tooth its code needs', () => {
  it('stops the save with the code named, before anything is invoiced', async () => {
    mocks.toothProblem = 'Choose the tooth for 8341 before saving.';
    const onSuccess = renderBilling();
    fireEvent.click(await screen.findByRole('button', { name: 'Invoice and take payment' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Visit not saved. Choose the tooth for 8341 before saving.', { duration: 8000 }));
    expect(mocks.generateInvoiceFromVisit).not.toHaveBeenCalled();
    expect(screen.queryByTestId('take-payment')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('Invoice and take payment on an existing visit', () => {
  it('saves the visit and makes its invoice as "Update Visit" does, then takes payment for it before the visit closes', async () => {
    const onSuccess = renderBilling();
    fireEvent.click(await screen.findByRole('button', { name: 'Invoice and take payment' }));

    await waitFor(() => expect(mocks.generateInvoiceFromVisit).toHaveBeenCalledTimes(1));
    expect(mocks.generateInvoiceFromVisit).toHaveBeenCalledWith(expect.objectContaining({ visitId: 'visit-1', patientId: 'pt1', services: [consultation] }));
    expect(await screen.findByTestId('take-payment')).toHaveTextContent('Paying inv-7');
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Payment done' }));
    expect(onSuccess).toHaveBeenCalledWith({ completed: false });
  });

  it('is not offered when the visit\'s invoice is already paid: there is nothing left to take', async () => {
    mocks.visitInvoice = { id: 'inv-paid', invoiceNumber: 'INV-3', paymentStatus: 'paid', lock: null, claim: null };
    renderBilling();
    await screen.findByText('Invoice & Payment Options');
    expect(screen.queryByRole('button', { name: 'Invoice and take payment' })).toBeNull();
  });
});
