import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { tableImportFile } from '../../../utils/import/importFiles';

const service = vi.hoisted(() => ({
  loadExistingFiles: vi.fn(),
  loadFundOptions: vi.fn(),
  readImportFile: vi.fn(),
  startImport: vi.fn(),
  stageRows: vi.fn()
}));

vi.mock('../../../services/import/eminanceImportService', () => ({
  ...service,
  isImportNotSetUpError: () => false
}));

import { EminanceImportWizard } from '../EminanceImportWizard';

// An invented patient list with Eminance's own headings: a main member with an unknown medical aid and a child
const PATIENTS = [
  ['ACCOUNT_KEY', 'PATIENT_KEY', 'SURNAME', 'FIRSTNAME', 'BIRTHDAY', 'SEX', 'IDNUMBER', 'MEDICALAID', 'MEMBERSHIPNO'],
  ['0000101', '0', 'Kandemo', 'Ndeshi', '15/01/1980', 'F', '', 'XYZ PLAN', '900000001'],
  ['0000101', '1', 'Kandemo', 'Petrus', '05/05/2015', 'M', '', '', '']
];

const next = () => fireEvent.click(screen.getByRole('button', { name: /Next/ }));

beforeEach(() => {
  vi.clearAllMocks();
  service.loadExistingFiles.mockResolvedValue([]);
  service.loadFundOptions.mockResolvedValue([{ id: 'fund-1', name: 'Invented Fund', short_name: 'INV', medical_aid_reference: 'INV' }]);
  service.readImportFile.mockImplementation(async (_file: File, index: number) => tableImportFile(index, 'patients.csv', PATIENTS, 0));
  service.startImport.mockResolvedValue('run-1');
  service.stageRows.mockResolvedValue(undefined);
});

describe('EminanceImportWizard', () => {
  it('goes from the files to the import, and will not import until an unknown medical aid is matched to a fund', async () => {
    const onStarted = vi.fn();
    render(<EminanceImportWizard practiceId="practice-1" onCancel={vi.fn()} onStarted={onStarted} onNotSetUp={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Files exported from Eminance'), {
      target: { files: [new File(['invented'], 'patients.csv', { type: 'text/csv' })] }
    });
    expect(await screen.findByText('patients.csv')).toBeInTheDocument();
    expect((screen.getByLabelText('What is this file?') as HTMLSelectElement).value).toBe('patients');

    next();
    expect(await screen.findByText('Every column it needs was found. Check the matches below.')).toBeInTheDocument();

    next();
    // The child's row has no medical aid: it is the account's, so it counts for both
    expect(await screen.findByText('Which fund is "XYZ PLAN"? (2 people)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Next/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/XYZ PLAN/), { target: { value: 'fund-1' } });
    await waitFor(() => expect(screen.getByRole('button', { name: /Next/ })).toBeEnabled());

    next();
    expect(await screen.findByText(/2 new patient files/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Import now/ }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, import/ }));

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('run-1'));
    expect(service.startImport).toHaveBeenCalledWith('practice-1', expect.objectContaining({ balancesAsOf: null }));
    const staged = service.stageRows.mock.calls[0][1] as Array<{ kind: string; payload: Record<string, unknown> }>;
    // Two new files and the child linked to the main member who pays for them
    expect(staged.map(row => row.kind)).toEqual(['patient', 'patient', 'family']);
    expect((staged[0].payload.medical_aid as { provider_id: string }).provider_id).toBe('fund-1');
  });
});
