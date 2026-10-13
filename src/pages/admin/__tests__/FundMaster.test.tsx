/**
 * Administration > Medical aid funds (parity E10). OneHealth support changes the rules every practice's claims follow;
 * a practice administrator must be able to read them but never change them (one practice's change would move every
 * practice's claims), and keeps the practice's own note per fund instead. Invented values only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { getFundRule } from '../../../utils/billing/fundRules';
import type { FundMasterData } from '../../../services/fundMasterService';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../components/ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));
vi.mock('../../../hooks/useMedicalAidLogo', () => ({ forgetFundLogos: vi.fn() }));

const auth = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Test Person', email: 'person@example.test', role: 'admin', practice_id: 'practice-a', is_super_admin: false, avatar: null as string | null },
  selectedPracticeId: null as string | null,
  logout: vi.fn(async () => undefined)
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector?: (state: typeof auth) => unknown) => (selector ? selector(auth) : auth)
}));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-a' }) }));

const service = vi.hoisted(() => ({
  loadFundMaster: vi.fn(),
  saveFundDetails: vi.fn(async () => undefined),
  savePracticeFundNote: vi.fn(async (_practice: string, _code: string, note: string) => note.trim() || null),
  loadFundChanges: vi.fn(async () => [])
}));
vi.mock('../../../services/fundMasterService', () => service);

import FundMaster from '../FundMaster';

const data = (overrides: Partial<FundMasterData> = {}): FundMasterData => ({
  setUp: true,
  practiceWaits: null,
  problems: [],
  funds: [
    {
      providerId: 'p-namm', name: 'Nammed Medical Aid Fund', shortName: 'Nammed', code: 'NAMM', claimsEmail: 'claims@example.invalid',
      logoUrl: null, rule: getFundRule('NAMM'), changedAt: null, note: null
    },
    {
      providerId: 'p-nmc', name: 'Namibia Medical Care', shortName: 'NMC', code: 'NMC1', claimsEmail: 'claims@example.invalid',
      logoUrl: null, rule: getFundRule('NMC1'), changedAt: '2026-10-12T10:00:00Z', note: { text: 'Our contact: the claims desk.', updatedAt: '2026-10-12T11:00:00Z' }
    }
  ],
  ...overrides
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/funds']}>
      <FundMaster />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { ...auth.user, role: 'admin', is_super_admin: false };
  service.loadFundMaster.mockResolvedValue(data());
});

describe('a practice administrator', () => {
  it('reads every fund\'s rules in words, with the unconfirmed deadline said plainly, and cannot change them', async () => {
    renderPage();
    const nammed = await screen.findByRole('article', { name: 'Nammed Medical Aid Fund' });
    expect(screen.getAllByRole('heading', { level: 1 }).map(heading => heading.textContent)).toEqual(['Medical aid funds']);
    expect(within(nammed).getByText('120 days from the service date')).toBeInTheDocument();
    expect(within(nammed).getByText('Not confirmed: later lines are only flagged')).toBeInTheDocument();
    expect(within(nammed).getByText('Digits only, 11 digits')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Namibia Medical Care' })).getByText('Confirmed: later lines are not sent')).toBeInTheDocument();
    expect(screen.getByText(/OneHealth support keeps these rules for every practice/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Change Nammed/ })).not.toBeInTheDocument();
  });

  it("keeps the practice's own note on a fund", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Add a note on Nammed Medical Aid Fund' }));
    fireEvent.change(screen.getByLabelText(/Your practice's note on Nammed Medical Aid Fund/), { target: { value: 'Send claims before the 20th.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(service.savePracticeFundNote).toHaveBeenCalledWith('practice-a', 'NAMM', 'Send claims before the 20th.'));
    expect(await screen.findByText('Send claims before the 20th.')).toBeInTheDocument();
  });

  // The practice's own wait wins over the fund's payment terms, so the card says which one the alert uses
  it("says when the practice's own wait applies instead of the fund's payment terms", async () => {
    service.loadFundMaster.mockResolvedValue(data({ practiceWaits: { default: 45, byFund: {} } }));
    renderPage();
    const nammed = await screen.findByRole('article', { name: 'Nammed Medical Aid Fund' });
    expect(within(nammed).getByText('Usually answers within 30 days')).toBeInTheDocument();
    expect(within(nammed).getByText(/Your practice warns after 45 days/)).toBeInTheDocument();
  });
});

describe('OneHealth support', () => {
  beforeEach(() => {
    auth.user = { ...auth.user, role: 'admin', is_super_admin: true };
  });

  it("changes a fund's rules: NAMMED's deadline confirmed at 90 days, and the page reads them again", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Change Nammed Medical Aid Fund' }));
    const sheet = await screen.findByRole('dialog', { name: 'Change Nammed Medical Aid Fund' });
    expect(await within(sheet).findByText(/No changes yet/)).toBeInTheDocument();
    fireEvent.change(within(sheet).getByLabelText('How long'), { target: { value: '90' } });
    fireEvent.click(within(sheet).getByRole('checkbox', { name: /Confirmed with the fund/ }));
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(service.saveFundDetails).toHaveBeenCalledWith('p-namm', expect.objectContaining({ deadlineDays: 90, deadlineMonths: null, deadlineConfirmed: true, membershipDigits: [11] }))
    );
    await waitFor(() => expect(service.loadFundMaster).toHaveBeenCalledTimes(2));
  });

  it('cannot save a deadline the database would refuse, and says why on the field', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Change Nammed Medical Aid Fund' }));
    const sheet = await screen.findByRole('dialog', { name: 'Change Nammed Medical Aid Fund' });
    fireEvent.change(within(sheet).getByLabelText('How long'), { target: { value: '0' } });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Whole days from 1 to 730.')).toBeInTheDocument();
    expect(service.saveFundDetails).not.toHaveBeenCalled();
  });

  it('offers no changes before the fund master is set up in the database', async () => {
    service.loadFundMaster.mockResolvedValue(data({ setUp: false }));
    renderPage();
    expect(await screen.findByText('The fund rules are not set up yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Change / })).not.toBeInTheDocument();
  });
});

describe('the page frame', () => {
  // The owner's admin look (as Tariffs): one heading in a white header bar, no second profile picture; a failed load
  // says what went wrong in plain words and Try again loads the funds
  it("wears the admin pages' look and recovers from a failed load with Try again", async () => {
    service.loadFundMaster.mockRejectedValueOnce(new Error('timeout'));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The medical aid funds could not be loaded: Please check the connection and try again.');
    expect(alert).not.toHaveTextContent('timeout');
    expect(screen.getAllByRole('heading', { level: 1 }).map(heading => heading.textContent)).toEqual(['Medical aid funds']);
    expect(screen.queryByRole('button', { name: /open profile menu/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('article', { name: 'Nammed Medical Aid Fund' })).toBeInTheDocument();
    expect(service.loadFundMaster).toHaveBeenCalledTimes(2);
  });
});
