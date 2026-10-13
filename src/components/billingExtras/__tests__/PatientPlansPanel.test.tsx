/**
 * Payment plans and prepaid packages on the patient's Billing tab (parity D16, D17). There is no scheduler, so opening
 * the tab is what puts the instalments that fell due on the account: the panel must post them then (and only when one
 * is due), say what it posted and let the invoice list reload; it shows what is left on each plan and package, and every
 * posted instalment opens its invoice. Invented plans, packages and amounts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
const auth = vi.hoisted(() => ({ user: { id: 'u1', role: 'receptionist', is_active: true } }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (selector?: (state: typeof auth) => unknown) => (selector ? selector(auth) : auth) }));

const service = vi.hoisted(() => ({
  loadPatientPlans: vi.fn(),
  loadPatientPackages: vi.fn(),
  postDueInstalments: vi.fn(),
  stopPaymentPlan: vi.fn(),
  cancelPackage: vi.fn(),
  loadPackageTypes: vi.fn(),
  sellPackage: vi.fn(),
  savePaymentPlan: vi.fn()
}));
vi.mock('../../../services/billing/billingExtrasService', () => service);
vi.mock('../../../services/invoiceContextService', () => ({ loadPracticeStaff: vi.fn(async () => []) }));

import PatientPlansPanel from '../PatientPlansPanel';
import { todayKey } from '../../../utils/billing/dates';

const today = todayKey();

const plan = (overrides: Record<string, unknown> = {}) => ({
  id: 'plan-1',
  patientId: 'patient-1',
  title: 'Braces',
  totalCents: 100_000,
  practitionerId: null,
  notes: null,
  createdAt: '2026-09-01T08:00:00Z',
  stoppedAt: null,
  stopReason: null,
  instalments: [
    { id: 'i1', number: 1, dueOn: '2026-09-03', amountCents: 40_000, invoiceId: 'inv-11', postedOn: '2026-09-03' },
    { id: 'i2', number: 2, dueOn: today, amountCents: 30_000, invoiceId: null, postedOn: null },
    { id: 'i3', number: 3, dueOn: '2099-01-01', amountCents: 30_000, invoiceId: null, postedOn: null }
  ],
  ...overrides
});

const renderPanel = (onInvoicesChanged = vi.fn()) => {
  render(
    <MemoryRouter>
      <PatientPlansPanel practiceId="practice-1" patientId="patient-1" patientName="Pat Testing" onInvoicesChanged={onInvoicesChanged} />
    </MemoryRouter>
  );
  return onInvoicesChanged;
};

beforeEach(() => {
  vi.clearAllMocks();
  service.loadPatientPlans.mockResolvedValue({ status: 'ready', data: { plans: [plan()], invoiceNumbers: { 'inv-11': 'INV-000011' } } });
  service.loadPatientPackages.mockResolvedValue({
    status: 'ready',
    data: [{
      id: 'pack-1', name: 'Ten physio sessions', codes: ['0190'], sessions: 10, priceCents: 450_000, soldOn: '2026-10-01', expiresOn: '2099-04-01',
      saleInvoiceId: 'inv-9', saleInvoiceNumber: 'INV-000009', saleCancelled: false, cancelledAt: null, cancelReason: null, used: 4
    }]
  });
  service.postDueInstalments.mockResolvedValue({ posted: 1, totalCents: 30_000, waiting: 0 });
});

describe('PatientPlansPanel', () => {
  it('posts the instalment that fell due when the tab opens, says so, and lets the invoice list reload', async () => {
    const onInvoicesChanged = renderPanel();
    await waitFor(() => expect(service.postDueInstalments).toHaveBeenCalledWith('practice-1', 'patient-1'));
    expect(await screen.findByText('1 instalment (N$ 300.00) posted to the account.')).toBeInTheDocument();
    expect(onInvoicesChanged).toHaveBeenCalled();
  });

  it('posts nothing when no instalment is due (a plan whose next instalment is later)', async () => {
    service.loadPatientPlans.mockResolvedValue({
      status: 'ready',
      data: { plans: [plan({ instalments: [{ id: 'i3', number: 1, dueOn: '2099-01-01', amountCents: 100_000, invoiceId: null, postedOn: null }] })], invoiceNumbers: {} }
    });
    renderPanel();
    expect(await screen.findByText('Braces')).toBeInTheDocument();
    expect(service.postDueInstalments).not.toHaveBeenCalled();
  });

  it("shows where each plan and package stands, and each posted instalment opens its invoice", async () => {
    renderPanel();
    expect(await screen.findByText(/N\$ 1,000\.00: 1 of 3 posted \(N\$ 400\.00\)/)).toBeInTheDocument();
    expect(screen.getByText(/6 of 10 left, until 1 Apr 2099/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show the instalments' }));
    expect(screen.getByRole('link', { name: 'INV-000011' })).toHaveAttribute('href', '/finance?tab=invoicing&invoice=inv-11');
    expect(screen.getByRole('link', { name: 'INV-000009' })).toBeInTheDocument();
  });

  it('stops a plan only with a reason', async () => {
    service.stopPaymentPlan.mockResolvedValue(undefined);
    renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Stop the plan' }));
    const stop = screen.getAllByRole('button', { name: 'Stop the plan' }).find(button => (button as HTMLButtonElement).type === 'submit') as HTMLButtonElement;
    expect(stop).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Why is the plan stopped?'), { target: { value: 'Paid the rest in cash' } });
    fireEvent.click(stop);
    await waitFor(() => expect(service.stopPaymentPlan).toHaveBeenCalledWith('plan-1', 'Paid the rest in cash'));
  });

  it('says plainly when the database update is not applied yet', async () => {
    service.loadPatientPlans.mockResolvedValue({ status: 'not_set_up' });
    service.loadPatientPackages.mockResolvedValue({ status: 'not_set_up' });
    renderPanel();
    expect(await screen.findByText('Payment plans and prepaid packages are not set up in this database yet.')).toBeInTheDocument();
    expect(service.postDueInstalments).not.toHaveBeenCalled();
  });
});
