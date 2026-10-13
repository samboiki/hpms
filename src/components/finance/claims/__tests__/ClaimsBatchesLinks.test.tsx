/**
 * Finance > Batches: a link to a claim batch (?batch=, from an invoice or a claim line) opens it even when it is older
 * than the newest 300 batches the screen lists (a practice sends several a week, so a year's batches pass 300); before,
 * such a link did nothing at all. A batch that is not the practice's says so. A change made in a batch reloads the
 * claims and Finance's figures, and an old batch opened by link stays open through that reload. Invented data only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { BatchHeaderRow } from '../types';

vi.mock('@iconify/react', () => ({ Icon: () => null }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast }));
vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => selector({ user: { id: 'user-1', role: 'admin', is_super_admin: false } })
}));

const service = vi.hoisted(() => ({
  loadPracticeInfo: vi.fn(),
  loadFunds: vi.fn(),
  loadBatches: vi.fn(),
  loadBatchById: vi.fn(),
  loadSilentFundDays: vi.fn(),
  loadSubmissions: vi.fn(),
  loadOwedByBatch: vi.fn(),
  saveSilentFundDays: vi.fn()
}));
vi.mock('../claimsService', async importOriginal => ({ ...(await importOriginal<typeof import('../claimsService')>()), ...service }));
// The batch screens are tested on their own: here the review only names its batch and can report a change
vi.mock('../BatchReview', () => ({
  default: ({ batch, onChanged }: { batch: BatchHeaderRow; onChanged: () => void }) => (
    <div>
      <p>Reviewing batch {batch.batch_number}</p>
      <button type="button" onClick={onChanged}>Correct a line</button>
    </div>
  )
}));
vi.mock('../BatchHistory', () => ({ default: () => null }));
vi.mock('../ClaimReportSheet', () => ({ default: () => null }));
vi.mock('../FundStatementSheet', () => ({ default: () => null }));
vi.mock('../UnbatchedInvoices', () => ({ default: () => null }));
vi.mock('../ReversalsToSend', () => ({ default: () => null }));
vi.mock('../UnpaidClaimLines', () => ({ default: () => null }));
vi.mock('../SilentFundSettings', () => ({ SilentFundSettings: () => null }));

import ClaimsBatches from '../ClaimsBatches';
import { SILENT_FUND_DEFAULTS } from '../batchFollowUp';

const batch = (id: string, number: number, overrides: Partial<BatchHeaderRow> = {}): BatchHeaderRow => ({
  id, practice_id: 'practice-1', practice_number: '1234567', batch_number: number, batch_date: '2026-10-01', medical_aid_reference: 'NHPM',
  status: 'sent', total_amount: 900, total_invoices: 3, generated_file_content: null, recipient_email: null, sent_at: '2026-10-02T08:00:00Z',
  confirmed_at: null, created_at: '2026-10-01T08:00:00Z', transaction_type: null, source_software: null, source_software_version: null,
  system_identification: null, ...overrides
});
const OLD_ID = '00000000-0000-4000-8000-000000000017';

const Where = () => <p data-testid="where">{useLocation().search}</p>;
const renderBatches = (onChanged = vi.fn()) =>
  render(
    <MemoryRouter initialEntries={[`/finance?tab=batch-management&batch=${OLD_ID}`]}>
      <Routes>
        <Route path="*" element={<><ClaimsBatches practiceId="practice-1" onChanged={onChanged} /><Where /></>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  Object.values(service).forEach(mock => mock.mockReset());
  toast.error.mockReset();
  service.loadPracticeInfo.mockResolvedValue({ id: 'practice-1', name: 'Example Practice', practice_number: '1234567', practice_type: 'general', contact_email: null });
  service.loadFunds.mockResolvedValue([]);
  // The newest batches: the linked one is not among them
  service.loadBatches.mockResolvedValue([batch('new-1', 412)]);
  service.loadSilentFundDays.mockResolvedValue({ settings: SILENT_FUND_DEFAULTS, error: null });
  service.loadSubmissions.mockResolvedValue([]);
  service.loadOwedByBatch.mockResolvedValue({ owed: new Map(), warning: null });
});
afterEach(cleanup);

describe('a link to a claim batch', () => {
  it('opens a batch older than the newest 300, read by its id', async () => {
    service.loadBatchById.mockResolvedValue(batch(OLD_ID, 17));
    renderBatches();
    expect(await screen.findByText('Reviewing batch 17')).toBeTruthy();
    expect(service.loadBatchById).toHaveBeenCalledWith(expect.objectContaining({ id: 'practice-1' }), OLD_ID);
    await waitFor(() => expect(screen.getByTestId('where').textContent).not.toContain('batch='));
  });

  it('keeps that old batch open after a change in it, while the claims and Finance\'s figures reload', async () => {
    service.loadBatchById.mockResolvedValue(batch(OLD_ID, 17));
    const onChanged = vi.fn();
    renderBatches(onChanged);
    fireEvent.click(await screen.findByRole('button', { name: 'Correct a line' }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(service.loadBatches).toHaveBeenCalledTimes(2);
    // The list's reload reads the old batch again by id, so its review does not close under the user
    expect(service.loadBatchById).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Reviewing batch 17')).toBeTruthy();
  });

  it('says so when the batch is not the practice\'s (or no longer exists), instead of doing nothing', async () => {
    service.loadBatchById.mockResolvedValue(null);
    renderBatches();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/could not be found/)));
    expect(screen.queryByText(/Reviewing batch/)).toBeNull();
    await waitFor(() => expect(screen.getByTestId('where').textContent).not.toContain('batch='));
  });
});
