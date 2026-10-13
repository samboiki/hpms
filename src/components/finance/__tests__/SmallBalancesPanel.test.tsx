/**
 * Finance > Debtors > Small balances as staff use it: the list with a total, unticking an account,
 * one write-off per balance with one reason, and a plain account of anything the database refused,
 * which can be tried again without writing anything off twice. Only administrators and doctors run
 * it. Database calls are replaced; what matters is what would be sent and what staff are told.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { buildAgingReport, normalizeInvoice, type AgeAnalysisContext } from '../../../services/ledgerService';

const mocks = vi.hoisted(() => ({
  loadSmallBalanceRuns: vi.fn(),
  writeOffSmallBalance: vi.fn(),
  loadStaffNames: vi.fn(),
  user: { role: 'admin', practice_id: 'practice-1', name: 'Admin Testing' } as { role: string; practice_id: string; name: string }
}));

// Icons load on a timer that outlives the test; they are decorative here
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../debtors/debtorsService', async importOriginal => ({
  ...(await importOriginal<typeof import('../debtors/debtorsService')>()),
  loadSmallBalanceRuns: mocks.loadSmallBalanceRuns,
  writeOffSmallBalance: mocks.writeOffSmallBalance
}));
vi.mock('../receipts/arService', async importOriginal => ({
  ...(await importOriginal<typeof import('../receipts/arService')>()),
  loadStaffNames: mocks.loadStaffNames
}));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: typeof mocks.user }) => unknown) => selector({ user: mocks.user })
}));

import { SmallBalancesPanel } from '../debtors/SmallBalancesPanel';

const TODAY = '2026-10-08';
const invoice = (id: string, patientId: string, amount: number, issueDate: string) =>
  normalizeInvoice({ id, invoice_number: id.toUpperCase(), patient_id: patientId, total: amount, medical_aid_total: 0, patient_total: amount, payment_status: 'pending', issue_date: issueDate, due_date: issueDate });

const aging = buildAgingReport([
  invoice('inv-a', 'ann', 7.5, '2026-06-01'),
  invoice('inv-b1', 'ben', 4, '2026-06-20'),
  invoice('inv-b2', 'ben', 3, '2026-05-30'),
  invoice('inv-c', 'cas', 9, '2026-05-01'),
  invoice('inv-big', 'dan', 250, '2026-05-01')
], TODAY);
const context: AgeAnalysisContext = {
  patientNames: { ann: 'Ann Amukoto', ben: 'Ben Basson', cas: 'Cas Coetzee', dan: 'Dan Dausab' },
  fundByPatient: {},
  creditByPatient: {},
  flagsByPatient: {}
};

const renderPanel = (onChanged = vi.fn()) => render(
  <MemoryRouter>
    <SmallBalancesPanel practiceId="practice-1" aging={aging} context={context} accountOf={id => id} onChanged={onChanged} />
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { role: 'admin', practice_id: 'practice-1', name: 'Admin Testing' };
  mocks.loadSmallBalanceRuns.mockResolvedValue({ runs: [], patientNames: {} });
  mocks.loadStaffNames.mockResolvedValue({});
});

describe('Small balances', () => {
  it('lists each small account with a total, leaves out what is not small, and lets an admin untick one before writing off', async () => {
    renderPanel();
    expect(await screen.findByText('Ann Amukoto')).toBeInTheDocument();
    expect(screen.getByText('Ben Basson')).toBeInTheDocument();
    expect(screen.queryByText('Dan Dausab')).toBeNull(); // N$ 250.00 is not a small balance
    expect(screen.getByRole('button', { name: /Write off N\$ 23\.50/ })).toBeEnabled();

    fireEvent.click(screen.getByLabelText('Write off Cas Coetzee'));
    expect(screen.getByRole('button', { name: /Write off N\$ 14\.50/ })).toBeEnabled();
  });

  it('writes off one balance at a time with the reason, lists a refusal with the database\'s words, and tries only that one again', async () => {
    const onChanged = vi.fn();
    let refuse = true;
    mocks.writeOffSmallBalance.mockImplementation(async ({ line }: { line: { invoiceId: string } }) => {
      if (line.invoiceId === 'inv-b2' && refuse) throw new Error('This month is closed, so a write-off dated 8 Oct 2026 cannot be recorded');
      return { id: `adj-${line.invoiceId}`, number: `WO-${line.invoiceId}`, kind: 'write_off' };
    });
    renderPanel(onChanged);
    await screen.findByText('Ann Amukoto');
    fireEvent.click(screen.getByLabelText('Write off Cas Coetzee'));
    fireEvent.click(screen.getByRole('button', { name: /Write off N\$ 14\.50/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Write off 3 balances' }));

    expect(await screen.findByText('Written off 2 of 3 balances (N$ 11.50). 1 balance (N$ 3.00) was not: the reasons are below.')).toBeInTheDocument();
    expect(screen.getByText(/This month is closed/)).toBeInTheDocument();
    expect(mocks.writeOffSmallBalance).toHaveBeenCalledTimes(3);
    const calls = mocks.writeOffSmallBalance.mock.calls.map(([input]) => input as { runId: string; reason: string; line: { invoiceId: string; amountCents: number } });
    expect(calls.map(call => [call.line.invoiceId, call.line.amountCents])).toEqual([['inv-a', 750], ['inv-b2', 300], ['inv-b1', 400]]);
    expect(new Set(calls.map(call => call.runId)).size).toBe(1);
    expect(calls[0].reason).toBe('Small balance not worth collecting');
    expect(onChanged).toHaveBeenCalledTimes(1);

    refuse = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try the refused one again' }));
    expect(await screen.findByText('Written off 3 balances: N$ 14.50.')).toBeInTheDocument();
    expect(mocks.writeOffSmallBalance).toHaveBeenCalledTimes(4);
    const retry = mocks.writeOffSmallBalance.mock.calls[3][0] as { runId: string; line: { invoiceId: string } };
    expect(retry).toMatchObject({ runId: calls[0].runId, line: { invoiceId: 'inv-b2' } });
  });

  it('shows a receptionist the list but no write-off: only an administrator or doctor approves one', async () => {
    mocks.user = { role: 'receptionist', practice_id: 'practice-1', name: 'Front Desk' };
    renderPanel();
    await screen.findByText('Ann Amukoto');
    expect(screen.getByText('Only a practice administrator or doctor can write off balances')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Write off N\$/ })).toBeNull();
  });

  it('says there is nothing to write off when no account is small and old enough', async () => {
    renderPanel();
    await screen.findByText('Ann Amukoto');
    fireEvent.change(screen.getByLabelText('Owed for at least'), { target: { value: '180' } });
    expect(await screen.findByText('No small balances to write off')).toBeInTheDocument();
    expect(screen.getByText(/part of it is newer than the age chosen \(3\)/)).toBeInTheDocument();
  });
});
