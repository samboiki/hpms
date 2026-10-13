/**
 * Admin > Tariffs > Contracts and co-payments (parity D8): what the patient pays of each medical aid visit, per fund:
 * a percentage or a fixed amount per line, and a levy once per visit.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock('../../../services/invoiceContextService', () => ({ loadCopayRules: mocks.load, saveCopayRules: mocks.save }));
vi.mock('../../../services/invoicingSetup', () => ({ loadInvoicingSetup: () => Promise.resolve({ lineDetails: true }) }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import CopaymentPanel from '../CopaymentPanel';

// Invented funds: claim codes only
const funds = [
  { reference: 'MAG1', label: 'PSEMAS (MAG1)' },
  { reference: 'NHPM', label: 'NHP (NHPM)' }
];

beforeEach(() => {
  mocks.load.mockReset();
  mocks.save.mockReset();
  mocks.save.mockResolvedValue(undefined);
});

describe('co-payments and levies', () => {
  it('lists each fund rule in plain words', async () => {
    mocks.load.mockResolvedValue({ rules: [{ fundReference: 'MAG1', planOption: null, percent: 5, levy: 20 }], error: null });
    render(<CopaymentPanel practiceId="practice-1" canEdit funds={funds} />);
    expect(await screen.findByText('The patient pays 5% of each line and a N$ 20.00 levy per visit')).toBeInTheDocument();
  });

  // A fund that asks N$ 50 per line and N$ 15 per visit: both are saved on the fund's one rule
  it('saves a fixed amount per line with a levy, replacing the fund rule', async () => {
    mocks.load.mockResolvedValue({ rules: [{ fundReference: 'NHPM', planOption: null, percent: 10 }], error: null });
    render(<CopaymentPanel practiceId="practice-1" canEdit funds={funds} />);
    fireEvent.change(await screen.findByLabelText('Fund'), { target: { value: 'NHPM' } });
    fireEvent.change(screen.getByLabelText('Patient pays per line'), { target: { value: 'amount' } });
    fireEvent.change(screen.getByLabelText('Amount (N$)'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Levy per visit (N$)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: /Save for this fund/ }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('practice-1', [{ fundReference: 'NHPM', planOption: null, percent: 0, amount: 50, levy: 15 }])
    );
  });

  // A wrong amount would silently charge patients the wrong share: nothing is saved until it is fixed
  it('refuses an unusable amount or levy, saying why', async () => {
    mocks.load.mockResolvedValue({ rules: [], error: null });
    render(<CopaymentPanel practiceId="practice-1" canEdit funds={funds} />);
    fireEvent.change(await screen.findByLabelText('Percentage (%)'), { target: { value: '101' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/above 0 and up to 100/);
    expect(screen.getByRole('button', { name: /Save for this fund/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Percentage (%)'), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Levy per visit (N$)'), { target: { value: 'abc' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/levy in N\$/);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('shows the rules to other staff without letting them change them', async () => {
    mocks.load.mockResolvedValue({ rules: [{ fundReference: 'MAG1', planOption: 'Gold', percent: 0, amount: 25 }], error: null });
    render(<CopaymentPanel practiceId="practice-1" canEdit={false} funds={funds} />);
    expect(await screen.findByText('The patient pays N$ 25.00 of each line')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save for this fund/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });
});
