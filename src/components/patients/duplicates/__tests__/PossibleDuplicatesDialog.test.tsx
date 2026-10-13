import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// All people are invented. The database calls are stand-ins; the pair finder and the labels are the real ones.
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('../../../ui/MedicalAidLogo', () => ({ MedicalAidLogo: () => null }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: toastMock, default: toastMock }));

const service = vi.hoisted(() => {
  class MergeNotSetUpError extends Error {}
  class MergeHasNewRecordsError extends Error {
    added: Record<string, number>;
    constructor(added: Record<string, number>) {
      super('new records');
      this.added = added;
    }
  }
  return {
    MergeNotSetUpError,
    MergeHasNewRecordsError,
    loadPracticeFiles: vi.fn(),
    loadRecordCounts: vi.fn(),
    loadMergeHistory: vi.fn(),
    mergePatients: vi.fn(),
    undoMerge: vi.fn()
  };
});
vi.mock('../../../../services/patientMergeService', () => service);

import { PossibleDuplicatesDialog } from '../PossibleDuplicatesDialog';

const withHistory = { id: 'p-busy', first_name: 'Ndapewa', last_name: 'Shilongo', id_number: '90051400123', date_of_birth: '1990-05-14', cell_number: '081 123 4567', system_patient_reference_number: 900, medical_aid_details: [] };
const newer = { id: 'p-new', first_name: 'Ndapewa', last_name: 'Shilongo', id_number: '9005 1400 123', date_of_birth: '1990-05-14', cell_number: null, system_patient_reference_number: 1200, medical_aid_details: [] };
const unrelated = { id: 'p-other', first_name: 'Tangeni', last_name: 'Nangolo', id_number: '85030200456', date_of_birth: '1985-03-02', cell_number: null, system_patient_reference_number: 5, medical_aid_details: [] };

const renderDialog = () => {
  const props = { practiceId: 'practice-1', onClose: vi.fn(), onFilesChanged: vi.fn(), onOpenPatient: vi.fn() };
  render(<PossibleDuplicatesDialog {...props} />);
  return props;
};

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  service.loadPracticeFiles.mockResolvedValue([withHistory, newer, unrelated]);
  service.loadRecordCounts.mockResolvedValue(new Map([
    ['p-busy', { visits: 12, invoices: 8, claims: 5 }],
    ['p-new', { visits: 1, invoices: 0, claims: 0 }]
  ]));
  service.loadMergeHistory.mockResolvedValue([]);
});

describe('PossibleDuplicatesDialog', () => {
  it('shows why two files may be one person and how much history each has', async () => {
    renderDialog();
    const pair = (await screen.findAllByRole('listitem')).find(item => within(item).queryByText('Same ID number'));
    expect(pair).toBeDefined();
    expect(within(pair as HTMLElement).getByText('Same name and date of birth')).toBeInTheDocument();
    expect(within(pair as HTMLElement).getByText('12')).toBeInTheDocument();
    // The unrelated patient is not offered
    expect(screen.queryByText(/Tangeni/)).not.toBeInTheDocument();
    expect(service.loadRecordCounts).toHaveBeenCalledWith(['p-busy', 'p-new']);
  });

  // Keeping the file with the history moves fewer rows and keeps the reference claims already carry
  it('suggests keeping the file with more history and merges the other one into it', async () => {
    service.mergePatients.mockResolvedValue({ mergeId: 'm1', moved: { visits: 1 }, leftWithArchived: {} });
    const props = renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: /Merge these files/ }));
    const choices = screen.getAllByRole('radio');
    expect(choices.find(choice => (choice as HTMLInputElement).checked)).toHaveAttribute('value', 'p-busy');
    expect(screen.getByText(/Suggested: more history/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Merge into Ndapewa Shilongo/ }));
    await waitFor(() => expect(service.mergePatients).toHaveBeenCalledWith('p-busy', 'p-new'));
    // The archived file no longer pairs with anything, and the patient list reloads
    await waitFor(() => expect(screen.getByText('No possible duplicates')).toBeInTheDocument());
    expect(props.onFilesChanged).toHaveBeenCalled();
    expect(toastMock.success).toHaveBeenCalledWith('Files merged. Moved 1 visit.');
  });

  it('keeps the file the administrator chooses, even when it is not the suggested one', async () => {
    service.mergePatients.mockResolvedValue({ mergeId: 'm1', moved: {}, leftWithArchived: {} });
    renderDialog();
    fireEvent.click(await screen.findByRole('button', { name: /Merge these files/ }));
    fireEvent.click(screen.getAllByRole('radio').find(choice => (choice as HTMLInputElement).value === 'p-new') as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /Merge into/ }));
    await waitFor(() => expect(service.mergePatients).toHaveBeenCalledWith('p-new', 'p-busy'));
  });

  it('cannot merge before the database is set up, but still shows the possible duplicates', async () => {
    service.loadRecordCounts.mockRejectedValue(new service.MergeNotSetUpError('not set up'));
    renderDialog();
    expect(await screen.findByText(/Merging patient files is not set up yet/)).toBeInTheDocument();
    expect(screen.getByText('Same ID number')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Merge these files/ })).toBeDisabled();
  });

  it('opens a file from the pair, so the administrator can look before merging', async () => {
    const props = renderDialog();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Ndapewa Shilongo' }))[0]);
    expect(props.onOpenPatient).toHaveBeenCalledWith('p-busy');
  });

  it('says why a merge can no longer be undone (records added to the kept file since)', async () => {
    service.loadMergeHistory.mockResolvedValue([{
      id: 'm1', keptPatientId: 'p-busy', keptName: 'Ndapewa Shilongo', keptReference: 900, mergedName: 'Ndapewa Shilongo', mergedReference: 1200,
      moved: { visits: 1 }, leftWithArchived: {}, mergedAt: '2026-10-09T10:00:00Z', mergedBy: 'Invented Administrator', undoneAt: null, undoneBy: null
    }]);
    service.undoMerge.mockRejectedValue(new service.MergeHasNewRecordsError({ visits: 1 }));
    renderDialog();
    fireEvent.click(await screen.findByRole('tab', { name: /Merges/ }));
    expect(await screen.findByText('Moved: 1 visit.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Undo merge/ }));
    fireEvent.click(within(screen.getByText(/comes back as a file of its own/).parentElement as HTMLElement).getByRole('button', { name: /Undo merge/ }));
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(
      'Ndapewa Shilongo has new records since the merge (1 visit), so the merge can no longer be undone.', { duration: 8000 }
    ));
  });

  it('closes with Escape', async () => {
    const props = renderDialog();
    await screen.findByText('Same ID number');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalled();
  });
});
