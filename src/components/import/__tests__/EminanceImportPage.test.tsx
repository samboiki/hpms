import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ImportRun } from '../../../services/import/eminanceImportService';

const auth = vi.hoisted(() => ({ role: 'admin' }));
const service = vi.hoisted(() => ({
  loadRuns: vi.fn(),
  undoImport: vi.fn()
}));

vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'user-1', role: auth.role } }) }));
vi.mock('../../../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../../../services/import/eminanceImportService', () => ({
  loadRuns: service.loadRuns,
  undoImport: service.undoImport,
  isImportNotSetUpError: (error: unknown) => (error as { code?: string } | null)?.code === '42P01'
}));
// The wizard and the run view are not opened in these tests
vi.mock('../EminanceImportWizard', () => ({ EminanceImportWizard: () => null }));
vi.mock('../ImportRunView', () => ({ ImportRunView: () => null }));

import { EminanceImportPage } from '../EminanceImportPage';

const run = (overrides: Partial<ImportRun>): ImportRun => ({
  id: 'run-1', status: 'imported', balancesAsOf: '2026-10-07', createdAt: '2026-10-07T08:00:00Z', importedAt: '2026-10-07T08:05:00Z',
  undoneAt: null, undoReason: null, counts: { patient: { pending: 0, created: 120, matched: 4, skipped: 2 } }, openingBalanceCents: 1234550, claimLines: 0,
  ...overrides
});

beforeEach(() => {
  auth.role = 'admin';
  service.loadRuns.mockReset();
});

describe('EminanceImportPage', () => {
  it('tells other staff that only a practice administrator can move patients over (the database refuses them too)', async () => {
    auth.role = 'receptionist';
    render(<EminanceImportPage />);
    expect(await screen.findByText('Only a practice administrator can move patients over from Eminance.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start moving over/ })).not.toBeInTheDocument();
    expect(service.loadRuns).not.toHaveBeenCalled();
  });

  it('says the import is not set up yet instead of showing a database error before its SQL is applied', async () => {
    service.loadRuns.mockRejectedValue({ code: '42P01', message: 'relation "public.legacy_import_runs" does not exist' });
    render(<EminanceImportPage />);
    expect(await screen.findByText('Moving over from Eminance is not set up yet')).toBeInTheDocument();
    // Plain words for staff: who to ask, never the name of a database file
    expect(screen.getByText(/Please contact OneHealth support/)).toBeInTheDocument();
    expect(screen.queryByText(/\.sql/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start moving over/ })).not.toBeInTheDocument();
  });

  it('offers to continue an unfinished import and blocks a second one, since only one may run at a time', async () => {
    service.loadRuns.mockResolvedValue([run({ status: 'importing' }), run({ id: 'run-0', status: 'undone', undoReason: 'Wrong age analysis' })]);
    render(<EminanceImportPage />);
    expect(await screen.findByRole('button', { name: /Continue/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start moving over/ })).toBeDisabled();
    expect(screen.getByText(/Wrong age analysis/)).toBeInTheDocument();
  });

  it('shows what an earlier import brought over, with its result and undo', async () => {
    service.loadRuns.mockResolvedValue([run({})]);
    render(<EminanceImportPage />);
    expect(await screen.findByText('120 new files, 4 already in OneHealth · N$ 12,345.50 in opening balances')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Result and undo/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Start moving over/ })).toBeEnabled();
  });
});
