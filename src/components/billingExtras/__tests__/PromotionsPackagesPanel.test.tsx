/**
 * Admin > Tariffs > Contracts and co-payments: the practice's promotions and prepaid packages (parity D18, D17). An
 * administrator starts and ends promotions and sets up packages; everyone else sees them without the buttons (the
 * database refuses them too). Invented promotions and packages.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
const toasts = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('react-hot-toast', () => toasts);
const service = vi.hoisted(() => ({
  loadPromotions: vi.fn(),
  loadPackageTypes: vi.fn(),
  savePromotion: vi.fn(),
  endPromotion: vi.fn(),
  savePackageType: vi.fn()
}));
vi.mock('../../../services/billing/billingExtrasService', () => service);

import PromotionsPackagesPanel from '../PromotionsPackagesPanel';

beforeEach(() => {
  vi.clearAllMocks();
  service.loadPromotions.mockResolvedValue({
    status: 'ready',
    data: [{ id: 'promo-1', name: 'Spring smile', kind: 'percent', percent: 10, amountCents: null, codes: ['8261'], startsOn: '2026-10-01', endsOn: '2099-10-31', endedAt: null }]
  });
  service.loadPackageTypes.mockResolvedValue({
    status: 'ready',
    data: [{ id: 'type-1', name: 'Ten physio sessions', codes: ['0190'], sessions: 10, priceCents: 450_000, validMonths: 6, isActive: true }]
  });
  service.savePromotion.mockResolvedValue({ id: 'promo-2' });
});

describe('PromotionsPackagesPanel', () => {
  it('lists the promotions and packages in words', async () => {
    render(<PromotionsPackagesPanel practiceId="practice-1" canEdit />);
    expect(await screen.findByText(/10% off 8261 from 1 Oct 2026 to 31 Oct 2099/)).toBeInTheDocument();
    expect(screen.getByText('10 sessions of 0190 for N$ 4,500.00, valid 6 months')).toBeInTheDocument();
  });

  it('saves a new promotion as typed, and names what to fix first', async () => {
    render(<PromotionsPackagesPanel practiceId="practice-1" canEdit />);
    fireEvent.click(await screen.findByRole('button', { name: 'New promotion' }));
    fireEvent.change(screen.getByPlaceholderText('Spring smile'), { target: { value: 'Winter whitening' } });
    fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '150' } });
    fireEvent.change(screen.getByPlaceholderText('8261, 8262'), { target: { value: '8262' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save promotion' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A percentage is at most 100.');
    expect(service.savePromotion).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('10'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save promotion' }));
    await waitFor(() => expect(service.savePromotion).toHaveBeenCalledWith(expect.objectContaining({ practice_id: 'practice-1', name: 'Winter whitening', kind: 'percent', value: 15, codes: ['8262'] })));
  });

  it('shows no buttons to someone who is not a practice administrator', async () => {
    render(<PromotionsPackagesPanel practiceId="practice-1" canEdit={false} />);
    expect(await screen.findByText(/Spring smile/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New promotion' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'End now' })).not.toBeInTheDocument();
    expect(screen.getByText('Only a practice administrator can change promotions.')).toBeInTheDocument();
  });

  it('says plainly when the database update is not applied yet', async () => {
    service.loadPromotions.mockResolvedValue({ status: 'not_set_up' });
    render(<PromotionsPackagesPanel practiceId="practice-1" canEdit />);
    expect(await screen.findByText('Promotions and prepaid packages are not set up in this database yet.')).toBeInTheDocument();
  });
});
