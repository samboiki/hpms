import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ImportProgress, ImportRun } from '../../../services/import/eminanceImportService';

const service = vi.hoisted(() => ({
  continueImport: vi.fn(),
  undoImport: vi.fn(),
  loadRunRows: vi.fn()
}));
vi.mock('../../../services/import/eminanceImportService', () => service);

import { ImportRunView } from '../ImportRunView';

const RUN: ImportRun = {
  id: 'run-1', status: 'staging', balancesAsOf: '2026-10-07', createdAt: '2026-10-08T06:00:00Z', importedAt: null, undoneAt: null,
  undoReason: null, counts: {}, openingBalanceCents: 0, claimLines: 0
};

const progress = (status: ImportProgress['status'], pending: number, extra: Partial<ImportProgress> = {}): ImportProgress => ({
  runId: 'run-1', status, done: status === 'imported' || status === 'undone', balancesAsOf: '2026-10-07',
  counts: { patient: { pending, created: 10 - pending - 1, matched: 0, skipped: 1 } }, openingBalanceCents: 58172, claimLines: 0, undoLeft: 0,
  ...extra
});

const renderView = (run: ImportRun, mode: 'continue' | 'continue-undo' | 'view') =>
  render(
    <MemoryRouter>
      <ImportRunView run={run} mode={mode} onBack={vi.fn()} onChanged={vi.fn()} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  service.loadRunRows.mockResolvedValue([
    { kind: 'patient', key: 'p:1:6', line: 6, accountNumber: '0000104', label: 'Line 6', status: 'skipped', reason: 'No date of birth', patientId: null }
  ]);
});

describe('ImportRunView', () => {
  it('imports step by step until done, then lists what was left out and why', async () => {
    service.continueImport
      .mockResolvedValueOnce(progress('importing', 5))
      .mockResolvedValueOnce(progress('importing', 0))
      .mockResolvedValueOnce(progress('imported', 0));
    renderView(RUN, 'continue');
    expect(await screen.findByText('Imported from Eminance')).toBeInTheDocument();
    expect(service.continueImport).toHaveBeenCalledTimes(3);
    expect(await screen.findByText('Not brought over')).toBeInTheDocument();
    expect(screen.getByText('N$ 581.72')).toBeInTheDocument();
    // The recall lists are a link like Patients and Finance > Debtors beside them, not plain text
    expect(screen.getByRole('link', { name: 'Messages > Lists' })).toHaveAttribute('href', '/communications?tab=lists');
  });

  it('stops with a message instead of calling forever when the import does not move', async () => {
    service.continueImport.mockResolvedValue(progress('importing', 5));
    renderView(RUN, 'continue');
    expect(await screen.findByText(/The import is not moving forward/)).toBeInTheDocument();
    expect(service.continueImport.mock.calls.length).toBeLessThan(6);
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });

  it('asks why before undoing, and shows the reason the database gives when it can no longer be undone', async () => {
    service.undoImport.mockRejectedValue(new Error('This import can no longer be undone: visits or bookings were added to the imported patients or their opening balances after the import (1). Correct the files one by one instead.'));
    renderView({ ...RUN, status: 'imported', importedAt: '2026-10-08T06:05:00Z', counts: progress('imported', 0).counts }, 'view');
    const undo = await screen.findByRole('button', { name: /Undo the import/ });
    expect(undo).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Why are you undoing it?'), { target: { value: 'Wrong age analysis' } });
    fireEvent.click(undo);
    fireEvent.click(screen.getByRole('button', { name: /Yes, undo it/ }));
    await waitFor(() => expect(service.undoImport).toHaveBeenCalledWith('run-1', 'Wrong age analysis'));
    expect(await screen.findByText(/can no longer be undone: visits or bookings/)).toBeInTheDocument();
  });
});
