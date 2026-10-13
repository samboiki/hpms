/**
 * Build a report (parity R22) as staff meet it: the period's records with the columns they pick, a grouping whose rows
 * list their records, and saving that saves a definition of fields only (never SQL). When saving is not set up yet the
 * builder still works and says so in plain words. The database calls are replaced; invented data only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { invoice } from '../../../../services/__tests__/ledgerTestUtils';
import type { PeriodLabels } from '../../financeNav';

const mocks = vi.hoisted(() => ({
  loadBuilderInput: vi.fn(),
  loadSavedQueries: vi.fn(),
  saveQuery: vi.fn(),
  removeQuery: vi.fn()
}));

vi.mock('../reportBuilderService', async importOriginal => ({
  ...(await importOriginal<typeof import('../reportBuilderService')>()),
  ...mocks
}));

import { ReportBuilderReport } from '../ReportBuilderReport';
import { parseDefinition } from '../reportBuilder';

const labels: PeriodLabels = {
  ranges: { preset: 'this_month', current: { startKey: '2026-10-01', endKey: '2026-10-13' }, previous: { startKey: '2026-09-01', endKey: '2026-09-13' } },
  current: '1-13 Oct 2026', previous: '1-13 Sep 2026', today: '13 Oct 2026', todayKey: '2026-10-13'
};

const input = {
  source: 'invoices' as const,
  invoices: [
    invoice({ id: 'i1', invoiceNumber: 'INV-1', patientId: 'p1', practitionerId: 'dr-a', issueDate: '2026-10-02', total: 1000, medicalAidTotal: 800 }),
    invoice({ id: 'i2', invoiceNumber: 'INV-2', patientId: 'p2', practitionerId: 'dr-b', issueDate: '2026-10-09', total: 250 })
  ],
  balances: {},
  patientNames: { p1: 'Pat Testing', p2: 'Sam Testing' },
  fundByPatient: { p1: 'NMC1' }
};

const renderBuilder = () => render(
  <MemoryRouter>
    <ReportBuilderReport practiceId="practice-1" practiceName="Test Practice" labels={labels} staffNames={{ 'dr-a': 'Dr Anna Testing', 'dr-b': 'Dr Ben Testing' }} />
  </MemoryRouter>
);

describe('Build a report', () => {
  beforeEach(() => {
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.loadBuilderInput.mockResolvedValue({ state: 'ready', data: input });
    mocks.loadSavedQueries.mockResolvedValue({ state: 'ready', data: [] });
    mocks.saveQuery.mockResolvedValue('q-1');
  });

  it('shows the period\'s invoices with the chosen columns, and a column can be put on and taken off', async () => {
    renderBuilder();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('INV-1')).toBeTruthy();
    expect(within(table).queryByRole('columnheader', { name: 'Medical aid portion' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Medical aid portion' }));
    expect(within(screen.getByRole('table')).getByRole('columnheader', { name: 'Medical aid portion' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Patient' }));
    expect(within(screen.getByRole('table')).queryByRole('columnheader', { name: 'Patient' })).toBeNull();
  });

  it('groups by practitioner, and a group\'s row lists that practitioner\'s invoices', async () => {
    renderBuilder();
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'practitioner' } });
    const row = await screen.findByRole('row', { name: /List the invoices of Dr Anna Testing/ });
    fireEvent.click(row);
    const table = screen.getByRole('table');
    expect(within(table).getByText('INV-1')).toBeTruthy();
    expect(within(table).queryByText('INV-2')).toBeNull();
  });

  it('saves a definition of fields only, under the name typed, for everyone in the practice', async () => {
    renderBuilder();
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Name to save it under'), { target: { value: '  Big invoices ' } });
    fireEvent.change(screen.getByLabelText('Amount at least (N$)'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
    await waitFor(() => expect(mocks.saveQuery).toHaveBeenCalledTimes(1));
    const [practiceId, id, name, definition] = mocks.saveQuery.mock.calls[0];
    expect([practiceId, id, name]).toEqual(['practice-1', null, '  Big invoices ']);
    expect(definition).toEqual({
      v: 1, source: 'invoices', columns: ['number', 'date', 'patient', 'practitioner', 'fund', 'status', 'total', 'owed'],
      filters: {}, search: '', min_amount: 50000, group_by: null
    });
    // Only the invoice of at least N$500 is listed
    expect(within(screen.getByRole('table')).queryByText('INV-2')).toBeNull();
  });

  it('opens a saved report as it was saved, and saves a copy as a new report without changing the original', async () => {
    mocks.loadSavedQueries.mockResolvedValue({
      state: 'ready',
      data: [{ id: 'q-9', name: 'Per practitioner', updatedAt: '2026-10-12', definition: parseDefinition({ source: 'invoices', columns: ['number', 'total'], filters: {}, group_by: 'practitioner' }) }]
    });
    renderBuilder();
    await screen.findByRole('table');
    await waitFor(() => expect((screen.getByLabelText('Saved reports') as HTMLSelectElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Saved reports'), { target: { value: 'q-9' } });
    expect(await screen.findByRole('row', { name: /List the invoices of Dr Ben Testing/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name to save it under'), { target: { value: 'Per practitioner, copy' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    await waitFor(() => expect(mocks.saveQuery).toHaveBeenCalledTimes(1));
    expect(mocks.saveQuery.mock.calls[0].slice(0, 3)).toEqual(['practice-1', null, 'Per practitioner, copy']);
    expect(mocks.saveQuery.mock.calls[0][3]).toMatchObject({ columns: ['number', 'total'], group_by: 'practitioner' });
  });

  it('says plainly that saving is not set up yet, and the builder still works', async () => {
    mocks.loadSavedQueries.mockResolvedValue({ state: 'not_set_up' });
    renderBuilder();
    expect(await screen.findByText(/Saving reports is not set up in this database yet/)).toBeTruthy();
    expect(within(await screen.findByRole('table')).getByText('INV-2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save report' })).toBeNull();
  });
});
