import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// All people are invented
const db = vi.hoisted(() => ({
  medicalAid: null as Record<string, unknown> | null,
  dependantCodeColumn: false,
  patientUpdate: vi.fn(),
  medicalAidUpdate: vi.fn(),
  idNumber: '90051400123'
}));

const query = (result: () => unknown) => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'order', 'limit']) chain[name] = () => chain;
  chain.maybeSingle = async () => result();
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
  return chain;
};

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: async () => ({ data: [{ id: 'nmc', name: 'Namibia Medical Care', short_name: 'NMC' }], error: null }),
    from: (table: string) => {
      if (table === 'patients') {
        return {
          ...query(() => ({ data: { id_number: db.idNumber }, error: null })),
          update: (values: unknown) => {
            db.patientUpdate(values);
            return { eq: async () => ({ error: null }) };
          }
        };
      }
      if (table === 'medical_aid_schemes') return query(() => ({ data: [], error: null }));
      if (table === 'next_of_kin') return query(() => ({ data: null, error: null }));
      if (table === 'medical_aid_details') {
        let columnCheck = false;
        const chain = query(() =>
          columnCheck
            ? db.dependantCodeColumn
              ? { data: [], error: null }
              : { data: null, error: { code: '42703', message: 'column does not exist' } }
            : { data: db.medicalAid, error: null }
        );
        const select = chain.select as (columns: string) => unknown;
        chain.select = (columns: string) => {
          columnCheck = columns === 'dependant_code';
          return select(columns);
        };
        chain.update = (values: unknown) => {
          db.medicalAidUpdate(values);
          return { eq: async () => ({ error: null }) };
        };
        return chain;
      }
      throw new Error(`Unexpected table ${table}`);
    }
  }
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import EditPatientForm from '../EditPatientForm';
import { resetDependantCodeColumnCache } from '../medicalAid/dependantCode';

const initialData = {
  first_name: 'Tangeni',
  last_name: 'Shilongo',
  email: '',
  cell_number: '',
  date_of_birth: '2015-06-01',
  gender: 'female',
  marital_status: '',
  occupation: '',
  employer: '',
  home_language: 'English',
  home_address: '',
  postal_address: '',
  postal_code: ''
};

afterEach(() => cleanup());
beforeEach(() => {
  db.medicalAid = {
    id: 'ma-3',
    provider: 'Namibia Medical Care',
    scheme: 'Standard',
    membership_number: '123456789',
    main_member_name: 'Johannes Ndapewa Shilongo',
    main_member_id_number: '70010100111',
    relationship_to_main: 'Child',
    medical_aid_provider_id: 'nmc'
  };
  db.dependantCodeColumn = false;
  db.patientUpdate.mockReset();
  db.medicalAidUpdate.mockReset();
  db.idNumber = '90051400123';
  resetDependantCodeColumnCache();
});

describe('EditPatientForm: medical aid', () => {
  it('reads an older "Child" and full main member name back into the form, and saves the name the way claims read it', async () => {
    const onSuccess = vi.fn();
    render(<EditPatientForm patientId="patient-3" initialData={initialData} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Medical Aid' }));
    expect(await screen.findByDisplayValue('Shilongo')).toBeInTheDocument();
    expect(screen.getByLabelText('Initials')).toHaveValue('JN');
    expect(screen.getByDisplayValue('Child')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.medicalAidUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ relationship_to_main: 'child', main_member_name: 'Shilongo, J N', main_member_id_number: '70010100111' })
    );
    // The unchanged ID number is not written back (it is unique across the database)
    expect(db.patientUpdate.mock.calls[0][0]).not.toHaveProperty('id_number');
    // The dependant code column does not exist yet: never sent
    expect(db.medicalAidUpdate.mock.calls[0][0]).not.toHaveProperty('dependant_code');
  });

  it('leaves the stored main member alone when the relationship was never recorded (nothing is overwritten by a guess)', async () => {
    db.medicalAid = { ...db.medicalAid, relationship_to_main: '' };
    const onSuccess = vi.fn();
    render(<EditPatientForm patientId="patient-3" initialData={initialData} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Medical Aid' }));
    await screen.findByDisplayValue('Not recorded');
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const saved = db.medicalAidUpdate.mock.calls[0][0];
    expect(saved).not.toHaveProperty('main_member_name');
    expect(saved).not.toHaveProperty('relationship_to_main');
  });

  it('saves a corrected ID number without spaces', async () => {
    const onSuccess = vi.fn();
    render(<EditPatientForm patientId="patient-3" initialData={initialData} onSuccess={onSuccess} />);
    const idField = await screen.findByLabelText('ID Number');
    await waitFor(() => expect(idField).toHaveValue('90051400123'));
    fireEvent.change(idField, { target: { value: '9005 1400 124' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientUpdate.mock.calls[0][0]).toMatchObject({ id_number: '90051400124' });
  });

  it('saves the dependant code once the column exists', async () => {
    db.dependantCodeColumn = true;
    const onSuccess = vi.fn();
    render(<EditPatientForm patientId="patient-3" initialData={initialData} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole('button', { name: 'Medical Aid' }));
    fireEvent.change(await screen.findByLabelText(/Dependant code/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.medicalAidUpdate.mock.calls[0][0]).toMatchObject({ dependant_code: '03' });
  });
});
