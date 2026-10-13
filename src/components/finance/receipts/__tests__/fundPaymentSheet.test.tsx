/**
 * Payments > "Medical aid payment" as a billing clerk uses it: key a fund's payment line by line against the total
 * on its remittance, post it only once it adds up, save it part way and carry on later (or let a colleague), and be
 * told when a colleague saved the same payment in between. The database calls are replaced; what matters is what
 * would be saved and posted. Invented values only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

const mocks = vi.hoisted(() => {
  class DraftConflictError extends Error {}
  return {
    DraftConflictError,
    loadFundOpenClaims: vi.fn(),
    loadStaffNames: vi.fn(),
    loadDrafts: vi.fn(),
    loadDraft: vi.fn(),
    loadKeyingClaims: vi.fn(),
    saveDraft: vi.fn(),
    postDraft: vi.fn(),
    discardDraft: vi.fn()
  };
});

vi.mock('../arService', () => ({
  loadFundOpenClaims: mocks.loadFundOpenClaims,
  loadStaffNames: mocks.loadStaffNames,
  isArNotSetUp: () => false,
  AR_NOT_SET_UP_MESSAGE: 'Receipts are not set up',
  FUND_NOT_RECORDED: 'Medical aid not recorded',
  fundKeyOf: (claim: { fundCode: string | null }) => claim.fundCode ?? 'Medical aid not recorded'
}));
vi.mock('../fundPaymentService', () => ({
  DraftConflictError: mocks.DraftConflictError,
  KEYING_NOT_SET_UP_MESSAGE: 'Keying is not set up',
  loadDrafts: mocks.loadDrafts,
  loadDraft: mocks.loadDraft,
  loadKeyingClaims: mocks.loadKeyingClaims,
  saveDraft: mocks.saveDraft,
  postDraft: mocks.postDraft,
  discardDraft: mocks.discardDraft
}));
vi.mock('../../../ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));
vi.mock('../ReceiptShareActions', () => ({ ReceiptShareActions: () => null }));
vi.mock('../../../ui/DateInput', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <input aria-label="Date received" value={value} onChange={event => onChange(event.target.value)} />
  )
}));

import { FundPaymentSheet } from '../FundPaymentSheet';

const fund = { key: 'NMC1', fundCode: 'NMC1', fund: 'Namibia Medical Care', claimCount: 1, owedCents: 60000 };
const openClaim = {
  invoiceId: 'inv-1', invoiceNumber: 'INV-0001', patientId: 'pt-1', patientName: 'Ana Tester', dateKey: '2026-09-01',
  fundCode: 'NMC1', fund: 'Namibia Medical Care', medicalAidOwedCents: 60000, patientOwedCents: 0, batchId: 'batch-12', inClaimBatch: true
};
const claimLine = (id: string, lineNumber: number, claimedCents: number, tariffCode: string) => ({
  claimLineId: id, batchId: 'batch-12', batchNumber: 12, lineNumber, serviceDate: '2026-09-01', tariffCode, claimedCents, resubmitted: false, outcome: null
});
const keyingClaim = {
  invoiceId: 'inv-1', invoiceNumber: 'INV-0001', patientId: 'pt-1', patientName: 'Ana Tester', accountReference: '0000101',
  dateKey: '2026-09-01', owedCents: 60000, lines: [claimLine('l1', 1, 45000, '0190'), claimLine('l2', 2, 15000, '0191')]
};
const savedRow = (version: number, lines: Array<{ claim_line_id: string; invoice_id: string; paid: string }>) => ({
  id: 'draft-1', version, fund_code: 'NMC1', fund_name: 'Namibia Medical Care', amount: '600.00', received_on: '2026-10-09',
  reference: 'REM-77', method: 'medical_aid', notes: null, lines, unmatched: '0.00', rest_to_patient: [],
  updated_at: '2026-10-09T08:30:00Z', updated_by: 'user-2', created_by: 'user-2'
});

const renderSheet = () =>
  render(
    <MemoryRouter>
      <FundPaymentSheet practiceId="practice-1" practiceName="Rehearsal Practice" staffName="Clerk" onClose={vi.fn()} />
    </MemoryRouter>
  );

const lineInput = (lineNumber: number, code: string) => screen.getByLabelText(`Paid on line ${lineNumber} of batch 12, code ${code}`);

beforeEach(() => {
  Object.values(mocks).forEach(mock => {
    if (typeof mock === 'function' && 'mockReset' in mock) (mock as ReturnType<typeof vi.fn>).mockReset();
  });
  mocks.loadFundOpenClaims.mockResolvedValue({ funds: [fund], claims: [openClaim] });
  mocks.loadStaffNames.mockResolvedValue({ 'user-2': 'Second Clerk' });
  mocks.loadDrafts.mockResolvedValue({ state: 'ready', drafts: [] });
  mocks.loadKeyingClaims.mockResolvedValue([keyingClaim]);
  mocks.saveDraft.mockResolvedValue({ id: 'draft-1', version: 1, updated_at: '2026-10-09T10:00:00Z' });
  mocks.postDraft.mockResolvedValue({ draft_id: 'draft-1', already_posted: false, receipt_id: 'r9', receipt_number: 'RC-000009', batches_moved: 1 });
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('Medical aid payment keyed line by line', () => {
  it('posts only once the lines add up to the amount received: saved first, then posted as one receipt', async () => {
    renderSheet();
    fireEvent.click(await screen.findByRole('button', { name: /Namibia Medical Care/ }));
    fireEvent.change(await screen.findByLabelText('Amount received'), { target: { value: '600' } });
    fireEvent.click(await screen.findByRole('button', { name: /Ana Tester/ }));

    fireEvent.change(lineInput(1, '0190'), { target: { value: '450' } });
    const post = screen.getByRole('button', { name: /Post payment of N\$ 600\.00/ });
    expect(post).toBeDisabled();
    expect(screen.getAllByText('N$ 150.00 still to key').length).toBeGreaterThan(0);

    fireEvent.change(lineInput(2, '0191'), { target: { value: '150' } });
    expect(post).toBeEnabled();
    fireEvent.click(post);

    await screen.findByText('Receipt RC-000009 saved');
    expect(mocks.saveDraft).toHaveBeenCalledTimes(1);
    expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      practice_id: 'practice-1',
      fund_code: 'NMC1',
      fund_name: 'Namibia Medical Care',
      amount: '600.00',
      lines: [
        { claim_line_id: 'l1', invoice_id: 'inv-1', paid: '450.00' },
        { claim_line_id: 'l2', invoice_id: 'inv-1', paid: '150.00' }
      ]
    }));
    expect(mocks.postDraft).toHaveBeenCalledWith('draft-1', 1);
    expect(mocks.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(mocks.postDraft.mock.invocationCallOrder[0]);
  });

  it('saves a part-keyed payment, and anyone can carry on from the saved version', async () => {
    mocks.loadDrafts.mockResolvedValue({ state: 'ready', drafts: [savedRow(4, [{ claim_line_id: 'l1', invoice_id: 'inv-1', paid: '450.00' }])] });
    mocks.saveDraft.mockResolvedValue({ id: 'draft-1', version: 5, updated_at: '2026-10-09T10:05:00Z' });
    renderSheet();

    expect(await screen.findByText(/N\$ 450\.00 keyed/)).toBeInTheDocument();
    expect(await screen.findByText(/by Second Clerk/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Carry on/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Ana Tester/ }));
    expect(lineInput(1, '0190')).toHaveValue('450.00');

    fireEvent.change(lineInput(2, '0191'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and finish later' }));

    await waitFor(() => expect(mocks.saveDraft).toHaveBeenCalledTimes(1));
    expect(mocks.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
      id: 'draft-1',
      version: 4,
      lines: [
        { claim_line_id: 'l1', invoice_id: 'inv-1', paid: '450.00' },
        { claim_line_id: 'l2', invoice_id: 'inv-1', paid: '0.00' }
      ]
    }));
    expect(await screen.findByText(/Saved .* carry on/)).toBeInTheDocument();
    expect(mocks.postDraft).not.toHaveBeenCalled();
  });

  it("says when a colleague saved the same payment in between, and opens their version instead of overwriting it", async () => {
    mocks.loadDrafts.mockResolvedValue({ state: 'ready', drafts: [savedRow(4, [])] });
    mocks.saveDraft.mockRejectedValue(new mocks.DraftConflictError('Someone else saved this payment after you opened it (Second Clerk, 9 Oct 10:04).'));
    mocks.loadDraft.mockResolvedValue(savedRow(6, [{ claim_line_id: 'l1', invoice_id: 'inv-1', paid: '450.00' }, { claim_line_id: 'l2', invoice_id: 'inv-1', paid: '150.00' }]));
    renderSheet();

    fireEvent.click(await screen.findByRole('button', { name: /Carry on/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Ana Tester/ }));
    fireEvent.change(lineInput(1, '0190'), { target: { value: '400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and finish later' }));

    expect(await screen.findByText(/Someone else saved this payment/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open their version' }));
    await waitFor(() => expect(lineInput(1, '0190')).toHaveValue('450.00'));
    expect(lineInput(2, '0191')).toHaveValue('150.00');
    expect(mocks.postDraft).not.toHaveBeenCalled();
  });
});
