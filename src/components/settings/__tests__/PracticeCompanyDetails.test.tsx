/**
 * Owner decision 13 Oct 2026: each practice registers its own company details in Settings > System (the invented
 * OneHealth block went), and only administrators edit them (the database keeps the name, registration and tax number
 * for administrators; everyone else reads them).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: null as { role: string; practice_id: string } | null,
  load: vi.fn(),
  save: vi.fn()
}));

vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: mocks.user }) }));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('@iconify/react', async (importOriginal) => ({ ...(await importOriginal<typeof import('@iconify/react')>()), Icon: () => null }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../../services/practiceCompanyService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/practiceCompanyService')>()),
  loadCompanyDetails: mocks.load,
  saveCompanyDetails: mocks.save
}));

import { PracticeCompanyDetails } from '../PracticeCompanyDetails';

const details = {
  name: 'Example Family Practice', registration_number: 'CC/2020/0001', tax_number: '1234567', contact_phone: '061 000 000',
  contact_email: 'reception@example.com.na', address: 'PO Box 1', city: 'Windhoek', postal_code: '', website_url: ''
};

beforeEach(() => {
  mocks.load.mockReset().mockResolvedValue({ ok: true, value: { details, available: Object.keys(details).filter(key => key !== 'website_url') } });
  mocks.save.mockReset().mockResolvedValue({ ok: true });
});

describe('Settings > System > Company details', () => {
  it('shows the practice\'s own details, and no invented support number, head office or badge', async () => {
    mocks.user = { role: 'nurse', practice_id: 'practice-1' };
    render(<PracticeCompanyDetails />);
    expect(await screen.findByText('Example Family Practice')).toBeInTheDocument();
    expect(screen.getByText('1234567')).toBeInTheDocument();
    expect(screen.queryByText(/081 222 331|South Africa|Verified/)).not.toBeInTheDocument();
    // A column the database does not have yet is said, not shown as empty
    expect(screen.getByText('Not set up yet')).toBeInTheDocument();
  });

  it('someone who is not an administrator reads them without an Edit button', async () => {
    mocks.user = { role: 'doctor', practice_id: 'practice-1' };
    render(<PracticeCompanyDetails />);
    await screen.findByText('Example Family Practice');
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Only practice administrators can change them/)).toBeInTheDocument();
  });

  it('an administrator edits them and only the changed field is saved', async () => {
    mocks.user = { role: 'admin', practice_id: 'practice-1' };
    render(<PracticeCompanyDetails />);
    fireEvent.click(await screen.findByRole('button', { name: /Edit/ }));
    fireEvent.change(screen.getByLabelText('VAT / tax number'), { target: { value: '7654321' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith('practice-1', { tax_number: '7654321' }));
    expect(await screen.findByText('7654321')).toBeInTheDocument();
  });
});
