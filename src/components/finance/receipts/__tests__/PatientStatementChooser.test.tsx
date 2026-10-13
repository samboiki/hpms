/**
 * The patient's Billing tab had two statements: the account's own (the ledger statement) and Manage invoices >
 * Statement, an older one that left part-paid invoices out of every total and ignored payments, credit notes and
 * discounts. Once receipts are in use Manage invoices > Statement opens the ledger statement too: one statement, the
 * right figures. Before receipts are set up nothing else exists, so the older statement stays. Invented data only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  loadPatientBalances: vi.fn(),
  loadPatientContact: vi.fn(),
  seesFinance: true,
  practiceId: 'practice-1' as string | null
}));

vi.mock('../arService', () => ({ loadPatientBalances: mocks.loadPatientBalances, loadPatientContact: mocks.loadPatientContact }));
vi.mock('../../../../hooks/useScreenAccess', () => ({ useSeesFinanceFigures: () => mocks.seesFinance }));
vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { practice_id: mocks.practiceId, practices: { name: 'Example Practice' } } })
}));
vi.mock('../../../modals/PrintStatementModal', () => ({ default: () => <p>The older invoice statement</p> }));
vi.mock('../PatientStatementDialog', () => ({
  PatientStatementDialog: ({ patientName, onOpenInvoice }: { patientName: string; onOpenInvoice?: (id: string) => void }) => (
    <div>
      <p>Ledger statement of {patientName}</p>
      {onOpenInvoice ? <button type="button" onClick={() => onOpenInvoice('inv-1')}>Open INV-1</button> : <p>Invoice lines are text</p>}
    </div>
  )
}));

import { PatientStatementChooser } from '../PatientStatementChooser';

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;

const renderChooser = () =>
  render(
    <MemoryRouter initialEntries={['/patients?patientId=pt1&tab=billing']}>
      <Routes>
        <Route path="*" element={<><PatientStatementChooser patientId="pt1" invoices={[]} onClose={vi.fn()} /><Where /></>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  mocks.seesFinance = true;
  mocks.practiceId = 'practice-1';
  mocks.loadPatientBalances.mockReset();
  mocks.loadPatientContact.mockReset();
  mocks.loadPatientContact.mockResolvedValue({ name: 'Example Patient', cellNumber: null, email: null, fund: null });
});
afterEach(cleanup);

describe('Manage invoices > Statement', () => {
  it('opens the ledger statement once receipts are in use, so the patient gets one statement with the right figures', async () => {
    mocks.loadPatientBalances.mockResolvedValue({ state: 'ready', balances: {} });
    renderChooser();
    expect(await screen.findByText('Ledger statement of Example Patient')).toBeInTheDocument();
    expect(screen.queryByText('The older invoice statement')).toBeNull();
    expect(mocks.loadPatientBalances).toHaveBeenCalledWith('pt1', 'practice-1');
  });

  it('keeps the older invoice statement before receipts are set up (nothing else exists then)', async () => {
    mocks.loadPatientBalances.mockResolvedValue({ state: 'not_set_up', balances: {} });
    renderChooser();
    expect(await screen.findByText('The older invoice statement')).toBeInTheDocument();
  });

  it('a statement line opens its invoice in Finance for staff the practice lets into Finance', async () => {
    mocks.loadPatientBalances.mockResolvedValue({ state: 'ready', balances: {} });
    renderChooser();
    fireEvent.click(await screen.findByRole('button', { name: 'Open INV-1' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/finance?tab=invoicing&invoice=inv-1');
  });

  it('gives a role kept out of Finance no link into it (the invoice list is right there on the tab)', async () => {
    mocks.seesFinance = false;
    mocks.loadPatientBalances.mockResolvedValue({ state: 'ready', balances: {} });
    renderChooser();
    expect(await screen.findByText('Invoice lines are text')).toBeInTheDocument();
  });

  it('a failed check is not "not set up": the ledger statement opens and says what went wrong itself', async () => {
    mocks.loadPatientBalances.mockRejectedValue(new Error('Network down'));
    mocks.loadPatientContact.mockRejectedValue(new Error('Network down'));
    renderChooser();
    expect(await screen.findByText('Ledger statement of Patient')).toBeInTheDocument();
  });
});
