/**
 * Prepaid packages and promotions on the visit's Billing tab (parity D17, D18): a code staff add is paid from the
 * patient's package, or a private patient's line takes the running promotion, by itself and named, so reception does
 * not have to remember either; the lines the visit opened with are never changed; each can be undone on the spot.
 * Invented codes, packages and promotions.
 */
import React, { useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ServiceSelection } from '../../../types/billing';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
const toasts = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('react-hot-toast', () => toasts);

const service = vi.hoisted(() => ({
  loadPromotions: vi.fn(),
  loadPatientPackages: vi.fn()
}));
vi.mock('../../../services/billing/billingExtrasService', () => service);

import { VisitBillingExtras } from '../VisitBillingExtras';

const line = (id: string, code: string, unitPrice = 500): ServiceSelection => ({
  id, tariffId: `t-${code}`, code, description: `Service ${code}`, category: 'Service', unitPrice, quantity: 1, totalPrice: unitPrice
});

const TARIFFS = [{ id: 't-0190', price: '500.00' }, { id: 't-8261', price: '1200.00' }];

let latest: ServiceSelection[] = [];

const Harness: React.FC<{ initial: ServiceSelection[]; hasMedicalAid?: boolean }> = ({ initial, hasMedicalAid = false }) => {
  const [services, setServices] = useState(initial);
  latest = services;
  return (
    <>
      <button type="button" onClick={() => setServices(current => [...current, line('new-1', '0190')])}>add 0190</button>
      <button type="button" onClick={() => setServices(current => [...current, line('new-2', '8261', 1200)])}>add 8261</button>
      <VisitBillingExtras
        ready
        practiceId="practice-1"
        patientId="patient-1"
        invoiceId={null}
        services={services}
        setServices={setServices}
        hasMedicalAid={hasMedicalAid}
        visitDateKey="2026-10-13"
        tariffs={TARIFFS}
        locked={false}
      />
    </>
  );
};

beforeEach(() => {
  toasts.toast.mockClear();
  service.loadPromotions.mockResolvedValue({
    status: 'ready',
    data: [{ id: 'promo-1', name: 'Spring smile', kind: 'percent', percent: 10, amountCents: null, codes: ['8261'], startsOn: '2026-10-01', endsOn: '2026-10-31', endedAt: null }]
  });
  service.loadPatientPackages.mockResolvedValue({
    status: 'ready',
    data: [{
      id: 'pack-1', name: 'Ten physio sessions', codes: ['0190'], sessions: 10, priceCents: 450_000, soldOn: '2026-10-01', expiresOn: '2027-04-01',
      saleInvoiceId: 'inv-1', saleInvoiceNumber: 'INV-0001', saleCancelled: false, cancelledAt: null, cancelReason: null, used: 3
    }]
  });
});

describe('VisitBillingExtras', () => {
  it('shows what is left on the patient\'s package before anything is billed', async () => {
    render(<Harness initial={[]} />);
    expect(await screen.findByText(/7 of 10 left, until 1 Apr 2027/)).toBeInTheDocument();
  });

  it('pays a newly added covered code from the package, and bills it normally again when staff say so', async () => {
    render(<Harness initial={[]} />);
    await screen.findByText(/7 of 10 left/);
    fireEvent.click(screen.getByText('add 0190'));
    await waitFor(() => expect(latest[0]).toMatchObject({ unitPrice: 0, totalPrice: 0, packageId: 'pack-1' }));
    expect(screen.getByText(/6 of 10 left, until 1 Apr 2027 after this visit/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Bill it normally' }));
    await waitFor(() => expect(latest[0]).toMatchObject({ unitPrice: 500, totalPrice: 500 }));
    expect(latest[0].packageId).toBeUndefined();
  });

  it("takes a private patient's promotion off a new line, named, and lets staff remove it", async () => {
    render(<Harness initial={[]} />);
    await screen.findByText(/7 of 10 left/);
    fireEvent.click(screen.getByText('add 8261'));
    await waitFor(() => expect(latest[0]).toMatchObject({ discountAmount: 120, promotionId: 'promo-1' }));
    expect(screen.getByText(/8261: Spring smile, N\$ 120\.00 off/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove the promotion' }));
    await waitFor(() => expect(latest[0].promotionId).toBeUndefined());
    expect(latest[0].discountAmount).toBeUndefined();
    // Offered again, never forced
    expect(screen.getByRole('button', { name: 'Apply it' })).toBeInTheDocument();
  });

  it('never changes the lines the visit opened with', async () => {
    const saved = [line('saved-1', '0190'), line('saved-2', '8261', 1200)];
    render(<Harness initial={saved} />);
    await screen.findByText(/7 of 10 left/);
    await act(async () => undefined);
    expect(latest).toEqual(saved);
  });

  it("gives a medical aid patient's line no promotion and says why", async () => {
    render(<Harness initial={[]} hasMedicalAid />);
    await screen.findByText(/7 of 10 left/);
    fireEvent.click(screen.getByText('add 8261'));
    expect(await screen.findByText(/promotions are for private patients/)).toBeInTheDocument();
    expect(latest[0].promotionId).toBeUndefined();
  });
});
