/**
 * "Invoice and take payment" on a new visit's Billing tab, end to end inside the visit screen: the
 * visit is saved and its invoice made exactly as "Create Visit" makes it, then Receive payment opens
 * for that invoice, and the visit screen closes only when the payment step is done. It is not
 * offered where the database would refuse the receipt. The database and the heavy children are replaced.
 */
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { ServiceSelection } from '../../../types/billing';

const mocks = vi.hoisted(() => ({
  generateInvoiceFromVisit: vi.fn(),
  practiceId: 'practice-1',
  user: { id: 'u1', name: 'Front Desk', role: 'receptionist', practice_id: 'practice-1', practices: { name: 'Test Practice' } }
}));

// Every query answers: lists are empty, single rows carry the ids the save needs
vi.mock('../../../lib/supabase', () => {
  const single = () => Promise.resolve({ data: { id: 'visit-1', practice_id: 'practice-1', practice_type: 'general_practice' }, error: null });
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
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: mocks.practiceId }) }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (selector: (state: { user: typeof mocks.user }) => unknown) => selector({ user: mocks.user }) }));
// The lines are checked before the visit is written (findInvoiceLineProblems); these lines are fine
vi.mock('../../../services/invoiceService', () => ({ invoiceService: { generateInvoiceFromVisit: mocks.generateInvoiceFromVisit }, findInvoiceLineProblems: () => [] }));
vi.mock('../../../services/documentGenerationService', () => ({ documentGenerationService: { generateVisitDocuments: vi.fn(() => Promise.resolve([])) } }));
vi.mock('../patientMedicalAid', () => ({ loadPatientHasMedicalAid: () => Promise.resolve(false) }));
// Iconify fetches icon data and fires timers after the test ends ("window is not defined")
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../useFundPricing', () => ({
  useFundPricing: () => ({ status: 'ready', pricing: { practiceId: 'practice-1', fund: null, book: { rows: [], contracts: [] } }, blockMessage: null, infectionControlStaff: [] })
}));
vi.mock('../useVisitBilling', () => ({
  useVisitBilling: ({ services }: { services: unknown[] }) => ({
    invoiceContext: { status: 'ready', problems: [], practitioners: [], invoice: null, copayRules: [], billedLines: [] },
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
    withLineDetails: () => []
  })
}));
vi.mock('../useVisitClaimDetails', () => ({
  useVisitClaimDetails: () => ({ status: 'ready', message: null, draft: {}, setDraft: () => undefined, dirty: false, save: () => Promise.resolve(null) })
}));
vi.mock('../VisitClaimDetailsCard', () => ({ default: () => null }));
vi.mock('../BillingLineDetails', () => ({ default: () => null }));
vi.mock('../InvoiceBillingSummary', () => ({ default: () => null }));
vi.mock('../../quotes/BundleMenu', () => ({ default: () => null }));
vi.mock('../../uploads/FileUploadComponent', () => ({ default: () => null }));
vi.mock('../../uploads/FileDisplayComponent', () => ({ default: () => null }));
vi.mock('../../uploads/MediaUploadWrapper', () => ({ default: () => null }));
vi.mock('../../requests/LabResultsTable', () => ({ default: () => null }));
vi.mock('../../requests/ImagingTabContentSimple', () => ({ default: () => null }));
vi.mock('../LeaveFormTab', () => ({ default: () => null }));
vi.mock('../HandoffCard', () => ({ default: () => null }));
vi.mock('../../patients/safety/DiagnosisToProblems', () => ({ DiagnosisToProblems: () => null }));
vi.mock('../../patients/safety/useMedicineAllergyCheck', () => ({ useMedicineAllergyCheck: () => ({ confirmMedicine: vi.fn(), dialog: null }) }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }), default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
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

import AddVisitTabs from '../AddVisitTabs';

const consultation: ServiceSelection = {
  id: 'line-1', tariffId: 't-0190', code: '0190', description: 'Consultation', category: 'Consultation', unitPrice: 450, quantity: 1, totalPrice: 450
};

const renderBilling = (onSuccess = vi.fn()) => {
  render(
    <AddVisitTabs patientId="pt1" activeTab="billing" onSuccess={onSuccess} onCancel={vi.fn()} selectedServices={[consultation]} onSelectedServicesChange={vi.fn()} />
  );
  return onSuccess;
};

beforeEach(() => {
  mocks.generateInvoiceFromVisit.mockReset();
  mocks.generateInvoiceFromVisit.mockResolvedValue({ id: 'inv-9', invoiceNumber: 'INV-9', warnings: [] });
  mocks.practiceId = 'practice-1';
  mocks.user = { id: 'u1', name: 'Front Desk', role: 'receptionist', practice_id: 'practice-1', practices: { name: 'Test Practice' } };
});

describe('Invoice and take payment on a new visit', () => {
  it('saves the visit with its invoice, opens Receive payment for that invoice, and closes the visit only after', async () => {
    const onSuccess = renderBilling();
    fireEvent.click(await screen.findByRole('button', { name: 'Invoice and take payment' }));

    await waitFor(() => expect(mocks.generateInvoiceFromVisit).toHaveBeenCalledTimes(1));
    expect(mocks.generateInvoiceFromVisit).toHaveBeenCalledWith(expect.objectContaining({ visitId: 'visit-1', patientId: 'pt1', services: [consultation] }));
    expect(await screen.findByTestId('take-payment')).toHaveTextContent('Paying inv-9');
    expect(onSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Payment done' }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('take-payment')).toBeNull();
  });

  it('closes as before when the invoice could not be made: there is nothing to take payment for', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.generateInvoiceFromVisit.mockRejectedValue(new Error('No free invoice number'));
    const onSuccess = renderBilling();
    fireEvent.click(await screen.findByRole('button', { name: 'Invoice and take payment' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(alert).toHaveBeenCalledWith(expect.stringMatching(/invoice was not generated/));
    expect(screen.queryByTestId('take-payment')).toBeNull();
    alert.mockRestore();
    consoleError.mockRestore();
  });

  it('is not offered when the visit is in another practice than the person\'s own: the receipt would be refused after the save', async () => {
    mocks.practiceId = 'practice-2';
    renderBilling();
    await screen.findByText('Invoice & Payment Options');
    expect(screen.queryByRole('button', { name: 'Invoice and take payment' })).toBeNull();
  });
});
