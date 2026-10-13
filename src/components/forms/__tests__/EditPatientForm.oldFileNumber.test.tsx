import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// All people and numbers are invented
const db = vi.hoisted(() => ({ patientUpdate: vi.fn() }));
const numbers = vi.hoisted(() => ({ loadPatientFileNumbers: vi.fn(), isImportedOldFileNumber: vi.fn() }));

const query = (result: () => unknown) => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'order', 'limit']) chain[name] = () => chain;
  chain.maybeSingle = async () => result();
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
  return chain;
};

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: async () => ({ data: [], error: null }),
    from: (table: string) => {
      if (table === 'patients') {
        return {
          ...query(() => ({ data: { id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female' }, error: null })),
          update: (values: unknown) => {
            db.patientUpdate(values);
            return { eq: async () => ({ error: null }) };
          }
        };
      }
      if (table === 'medical_aid_details') return query(() => ({ data: null, error: { code: '42703', message: 'column does not exist' } }));
      return query(() => ({ data: null, error: null }));
    }
  }
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('../../../services/patientFileService', () => ({ loadPatientFileNumbers: numbers.loadPatientFileNumbers }));
vi.mock('../../../services/import/eminanceImportService', () => ({ isImportedOldFileNumber: numbers.isImportedOldFileNumber }));

import EditPatientForm from '../EditPatientForm';
import { PATIENT_FILE_NUMBERS_CHANGED } from '../../../utils/patients/patientNumbers';

const initialData = { first_name: 'Ndapewa', last_name: 'Shilongo', date_of_birth: '1990-05-14', gender: 'female', home_language: 'English' };

const save = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
  await waitFor(() => expect(db.patientUpdate).toHaveBeenCalled());
};

afterEach(() => cleanup());
beforeEach(() => {
  db.patientUpdate.mockReset();
  numbers.loadPatientFileNumbers.mockReset().mockResolvedValue({ reference: 1234, oldFileNumber: null, oldFileNumberAvailable: true });
  numbers.isImportedOldFileNumber.mockReset().mockResolvedValue(false);
});

// A patient who had a paper file or an account in the previous system, but was not imported, is found by that number
// once reception types it here.
describe('EditPatientForm: old file number', () => {
  it('saves a typed old file number, and the open patient file shows it at once', async () => {
    const heard = vi.fn();
    window.addEventListener(PATIENT_FILE_NUMBERS_CHANGED, heard);
    render(<EditPatientForm patientId="patient-1" initialData={initialData} onSuccess={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Old file number'), { target: { value: ' P-123 ' } });
    await save();
    expect(db.patientUpdate.mock.calls[0][0]).toMatchObject({ legacy_account_number: 'P-123' });
    await waitFor(() => expect(heard).toHaveBeenCalled());
    expect((heard.mock.calls[0][0] as CustomEvent).detail).toBe('patient-1');
    window.removeEventListener(PATIENT_FILE_NUMBERS_CHANGED, heard);
  });

  it('removes an old file number reception cleared', async () => {
    numbers.loadPatientFileNumbers.mockResolvedValue({ reference: 1234, oldFileNumber: 'P-123', oldFileNumberAvailable: true });
    render(<EditPatientForm patientId="patient-1" initialData={initialData} onSuccess={vi.fn()} />);
    fireEvent.change(await screen.findByDisplayValue('P-123'), { target: { value: '' } });
    await save();
    expect(db.patientUpdate.mock.calls[0][0]).toMatchObject({ legacy_account_number: null });
  });

  it('does not write an unchanged number back', async () => {
    numbers.loadPatientFileNumbers.mockResolvedValue({ reference: 1234, oldFileNumber: 'P-123', oldFileNumberAvailable: true });
    render(<EditPatientForm patientId="patient-1" initialData={initialData} onSuccess={vi.fn()} />);
    await screen.findByDisplayValue('P-123');
    await save();
    expect(db.patientUpdate.mock.calls[0][0]).not.toHaveProperty('legacy_account_number');
  });

  // The patient's Eminance statements and claims quote the number the import brought over
  it('keeps an Eminance number as imported: read-only, never written back', async () => {
    numbers.loadPatientFileNumbers.mockResolvedValue({ reference: 1234, oldFileNumber: '0004321', oldFileNumberAvailable: true });
    numbers.isImportedOldFileNumber.mockResolvedValue(true);
    render(<EditPatientForm patientId="patient-1" initialData={initialData} onSuccess={vi.fn()} />);
    const field = await screen.findByDisplayValue('0004321');
    expect(field).toHaveAttribute('readonly');
    expect(screen.getByText(/Brought over from Eminance and kept as imported/)).toBeInTheDocument();
    await save();
    expect(db.patientUpdate.mock.calls[0][0]).not.toHaveProperty('legacy_account_number');
  });

  it('hides the field before the database has the column, so nothing is saved blindly', async () => {
    numbers.loadPatientFileNumbers.mockResolvedValue({ reference: 1234, oldFileNumber: null, oldFileNumberAvailable: false });
    render(<EditPatientForm patientId="patient-1" initialData={initialData} onSuccess={vi.fn()} />);
    await waitFor(() => expect(numbers.loadPatientFileNumbers).toHaveBeenCalled());
    expect(screen.queryByLabelText('Old file number')).not.toBeInTheDocument();
    await save();
    expect(db.patientUpdate.mock.calls[0][0]).not.toHaveProperty('legacy_account_number');
  });
});
