import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

// A patient booked by phone or on the website with a name and cell number only: reception completes the file when
// they arrive. All people and numbers are invented.
const db = vi.hoisted(() => ({
  file: {} as Record<string, unknown>,
  titleColumns: true,
  titles: { title: null as string | null, initials: null as string | null },
  patientUpdate: vi.fn(),
  medicalAidInsert: vi.fn()
}));

const query = (result: (columns: string) => unknown) => {
  let columns = '';
  const chain: Record<string, unknown> = {};
  chain.select = (selected: string) => {
    columns = selected;
    return chain;
  };
  for (const name of ['eq', 'order', 'limit']) chain[name] = () => chain;
  chain.maybeSingle = async () => result(columns);
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result(columns)).then(resolve, reject);
  return chain;
};

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    rpc: async () => ({ data: [{ id: 'nmc', name: 'Namibia Medical Care', short_name: 'NMC' }], error: null }),
    from: (table: string) => {
      if (table === 'patients') {
        return {
          ...query(columns => {
            if (columns.includes('title')) {
              return db.titleColumns ? { data: db.titles, error: null } : { data: null, error: { code: '42703', message: 'column patients.title does not exist' } };
            }
            return { data: db.file, error: null };
          }),
          update: (values: unknown) => {
            db.patientUpdate(values);
            return { eq: async () => ({ error: null }) };
          }
        };
      }
      if (table === 'medical_aid_schemes') return query(() => ({ data: [], error: null }));
      if (table === 'next_of_kin') return query(() => ({ data: null, error: null }));
      if (table === 'medical_aid_details') {
        return {
          ...query(columns => (columns === 'dependant_code' ? { data: null, error: { code: '42703', message: 'no column' } } : { data: null, error: null })),
          insert: (rows: unknown) => {
            db.medicalAidInsert(rows);
            return Promise.resolve({ error: null });
          }
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }
  }
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import EditPatientForm from '../EditPatientForm';
import { resetPatientTitleColumnsCache } from '../patientTitleColumns';
import { resetDependantCodeColumnCache } from '../medicalAid/dependantCode';

// What the patient file passes in for a file opened with a name and cell only (placeholders included)
const initialData = {
  first_name: 'Ndapewa',
  last_name: 'Shilongo',
  email: '',
  cell_number: '081 123 4567',
  date_of_birth: '1990-01-01',
  gender: 'other',
  marital_status: '',
  occupation: '',
  employer: '',
  home_language: '',
  home_address: '',
  postal_address: '',
  postal_code: ''
};
const temporaryFile = { id_number: 'TEMP-1728000000000-abc123xyz', date_of_birth: '1990-01-01', gender: 'other' };

const field = (name: string) => document.querySelector(`[name="${name}"]`) as HTMLInputElement;
const renderForm = () => {
  const onSuccess = vi.fn();
  render(<EditPatientForm patientId="patient-9" initialData={initialData} onSuccess={onSuccess} />);
  return onSuccess;
};

afterEach(() => cleanup());
beforeEach(() => {
  db.file = { ...temporaryFile };
  db.titleColumns = true;
  db.titles = { title: null, initials: null };
  db.patientUpdate.mockReset();
  db.medicalAidInsert.mockReset();
  resetPatientTitleColumnsCache();
  resetDependantCodeColumnCache();
});

describe('EditPatientForm: completing a file opened with a name and cell only', () => {
  it('asks for what is missing and shows blank fields, never the placeholders as the answers', async () => {
    renderForm();
    expect(await screen.findByText('This file is not complete yet')).toBeInTheDocument();
    expect(screen.getByText(/Add the ID number, date of birth and gender/)).toBeInTheDocument();
    await waitFor(() => expect(field('date_of_birth')).toHaveValue(''));
    expect(screen.getByLabelText('ID Number')).toHaveValue('');
    expect(screen.getByLabelText('Gender')).toHaveValue('');
  });

  it('completes the file: the ID number fills the date of birth, and ID, birthday and gender are saved together', async () => {
    const onSuccess = renderForm();
    await screen.findByText('This file is not complete yet');
    await waitFor(() => expect(field('date_of_birth')).toHaveValue(''));
    fireEvent.change(screen.getByLabelText('ID Number'), { target: { value: '9005 1400 123' } });
    await waitFor(() => expect(field('date_of_birth')).toHaveValue('1990-05-14'));
    fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'female' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientUpdate.mock.calls[0][0]).toMatchObject({ id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female' });
  });

  it('will not complete the file without the gender (a claim needs M or F)', async () => {
    renderForm();
    await screen.findByText('This file is not complete yet');
    fireEvent.change(screen.getByLabelText('ID Number'), { target: { value: '90051400123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    expect(await screen.findByText('Choose the gender to complete the file')).toBeInTheDocument();
    expect(db.patientUpdate).not.toHaveBeenCalled();
  });

  it('saves other changes with the ID number left blank and keeps the placeholders, so the file stays not complete', async () => {
    const onSuccess = renderForm();
    await screen.findByText('This file is not complete yet');
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const saved = db.patientUpdate.mock.calls[0][0];
    expect(saved).not.toHaveProperty('id_number');
    expect(saved).not.toHaveProperty('date_of_birth');
    expect(saved).not.toHaveProperty('gender');
    // The database accepts only listed values for these: a blank '' made every such save fail
    expect(saved).toMatchObject({ marital_status: null, home_language: null });
  });

  it("never gives a medical aid the placeholder as the main member's ID number", async () => {
    const onSuccess = renderForm();
    await screen.findByText('This file is not complete yet');
    fireEvent.click(screen.getByRole('button', { name: 'Medical Aid' }));
    fireEvent.change(await screen.findByDisplayValue('Select Medical Aid Provider'), { target: { value: 'nmc' } });
    fireEvent.change(screen.getByPlaceholderText('As on the card'), { target: { value: '123456789' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.medicalAidInsert.mock.calls[0][0][0]).toMatchObject({ relationship_to_main: 'self', main_member_id_number: '' });
  });
});

describe('EditPatientForm: title and initials', () => {
  it('fills the initials from the first names and saves the title and initials once the columns exist', async () => {
    db.file = { id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female' };
    const onSuccess = renderForm();
    const initials = await screen.findByLabelText('Initials');
    await waitFor(() => expect(initials).toHaveValue('N'));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Mrs' } });
    fireEvent.change(field('first_name'), { target: { value: 'Ndapewa Maria' } });
    expect(initials).toHaveValue('NM');
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientUpdate.mock.calls[0][0]).toMatchObject({ title: 'Mrs', initials: 'NM' });
  });

  it('keeps a title already on the file that is not in the list, so saving never wipes it', async () => {
    db.file = { id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female' };
    db.titles = { title: 'Adv', initials: 'NM' };
    const onSuccess = renderForm();
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Adv'));
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientUpdate.mock.calls[0][0]).toMatchObject({ title: 'Adv', initials: 'NM' });
  });

  it('shows and sends neither before the columns exist, so the save cannot fail on them', async () => {
    db.titleColumns = false;
    db.file = { id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female' };
    const onSuccess = renderForm();
    await waitFor(() => expect(screen.getByLabelText('ID Number')).toHaveValue('90051400123'));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientUpdate.mock.calls[0][0]).not.toHaveProperty('title');
    expect(db.patientUpdate.mock.calls[0][0]).not.toHaveProperty('initials');
  });
});

// Registration found the caller's temporary file and opens it to complete it: what reception typed there fills the
// form, so nothing is typed twice and the file is completed in one save.
describe('EditPatientForm: completing a temporary file with what registration typed', () => {
  it('keeps the typed ID number, birthday, gender and title instead of blanking them as placeholders', async () => {
    const onSuccess = vi.fn();
    render(
      <EditPatientForm
        patientId="patient-9"
        initialData={{ ...initialData, id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female', title: 'Mrs' }}
        onSuccess={onSuccess}
      />
    );
    await screen.findByText('This file is not complete yet');
    await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Mrs'));
    expect(screen.getByLabelText('ID Number')).toHaveValue('90051400123');
    expect(field('date_of_birth')).toHaveValue('1990-05-14');
    expect(screen.getByLabelText('Gender')).toHaveValue('female');
    fireEvent.click(screen.getByRole('button', { name: 'Update Patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientUpdate.mock.calls[0][0]).toMatchObject({ id_number: '90051400123', date_of_birth: '1990-05-14', gender: 'female', title: 'Mrs' });
  });
});
