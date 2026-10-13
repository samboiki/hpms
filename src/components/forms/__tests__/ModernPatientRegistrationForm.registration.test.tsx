import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

// Real form handling; only the database, toasts and animations are stand-ins. All people are invented.
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: { div: ({ children }: React.PropsWithChildren) => <div>{children}</div> }
}));
const toastMock = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
vi.mock('react-hot-toast', () => ({ toast: toastMock, default: toastMock }));

const db = vi.hoisted(() => ({
  existingById: [] as Record<string, unknown>[],
  existingByBirthDate: [] as Record<string, unknown>[],
  dependantCodeColumn: false,
  titleColumns: true,
  townColumns: true,
  // patients.photo_path and referral_source (proposals/2026-10-13-patient-photo-and-referral-source.sql)
  extrasColumns: true,
  // Temporary files (booked with a name and cell only) the check finds by cell number
  temporaryFiles: [] as Record<string, unknown>[],
  // Files the check finds by old file number, and medical aid rows (with their file) found by membership number
  existingByOldNumber: [] as Record<string, unknown>[],
  membershipRows: [] as Record<string, unknown>[],
  lookups: [] as Array<[string, string]>,
  patientInsert: vi.fn(),
  medicalAidInsert: vi.fn(),
  patientInsertError: null as null | { code: string; message: string }
}));

// Completing a temporary file: the completion form reads and saves the file itself (tested on its own); here it only
// shows what it was opened with, and the file counts as complete once it closes
const completion = vi.hoisted(() => ({ fileComplete: true }));
vi.mock('../CompletePatientFileModal', () => ({
  default: ({ patientId, prefill, onClose }: { patientId: string; prefill?: Record<string, unknown>; onClose: () => void }) => (
    <div>
      <p>Completing {patientId} with ID {String(prefill?.id_number)} born {String(prefill?.date_of_birth)}</p>
      <button type="button" onClick={onClose}>Close the completion form</button>
    </div>
  )
}));
vi.mock('../../../services/patientFileService', () => ({
  loadPatientFileStatus: async () => ({ incomplete: !completion.fileComplete, missing: [], dateOfBirth: null, gender: null })
}));

/** A thenable query that resolves to `result` whatever filters are chained */
const query = (result: () => unknown) => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'in', 'order', 'limit', 'ilike']) chain[name] = () => chain;
  chain.single = async () => result();
  chain.then = (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
  return chain;
};

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: (table: string) => {
      if (table === 'users') return query(() => ({ data: { practice_id: 'practice-1' }, error: null }));
      if (table === 'medical_aid_providers') {
        return query(() => ({ data: [{ id: 'nmc', name: 'Namibia Medical Care', short_name: 'NMC', medical_aid_reference: 'NMC1' }], error: null }));
      }
      if (table === 'medical_aid_schemes') return query(() => ({ data: [], error: null }));
      if (table === 'medical_aid_details') {
        let columns = '';
        const chain = query(() => {
          if (columns.includes('dependant_code') && !db.dependantCodeColumn) return { data: null, error: { code: '42703', message: 'column does not exist' } };
          // The duplicate check reads medical aids with their file; the column check reads one column
          return { data: columns.includes('patients!inner') ? db.membershipRows : [], error: null };
        });
        chain.select = (selected: string) => {
          columns = selected;
          return chain;
        };
        chain.ilike = (column: string, pattern: string) => {
          db.lookups.push([column, pattern]);
          return chain;
        };
        chain.insert = (rows: unknown) => {
          db.medicalAidInsert(rows);
          return Promise.resolve({ error: null });
        };
        return chain;
      }
      if (table === 'next_of_kin') return { insert: async () => ({ error: null }) };
      if (table === 'patients') {
        let byId = false;
        let temporary = false;
        let byOldNumber = false;
        const chain = query(() => ({
          data: temporary ? db.temporaryFiles : byOldNumber ? db.existingByOldNumber : byId ? db.existingById : db.existingByBirthDate,
          error: null
        }));
        chain.in = () => {
          byId = true;
          return chain;
        };
        chain.ilike = (column: string, pattern: string) => {
          if (column === 'id_number') temporary = true;
          if (column === 'legacy_account_number') {
            byOldNumber = true;
            db.lookups.push([column, pattern]);
          }
          return chain;
        };
        // The title and initials column check (proposals/2026-10-08-patient-title-initials.sql)
        chain.select = (columns: string) =>
          (columns === 'title, initials' && !db.titleColumns) || (columns === 'town, region' && !db.townColumns) ||
          ((columns === 'photo_path' || columns === 'referral_source, referral_source_other') && !db.extrasColumns)
            ? query(() => ({ data: null, error: { code: '42703', message: `column patients.${columns.split(',')[0]} does not exist` } }))
            : chain;
        chain.insert = (rows: unknown) => {
          db.patientInsert(rows);
          return query(() =>
            db.patientInsertError ? { data: null, error: db.patientInsertError } : { data: { id: 'new-patient', first_name: 'Ndapewa', last_name: 'Shilongo' }, error: null }
          );
        };
        return chain;
      }
      throw new Error(`Unexpected table ${table}`);
    }
  }
}));

import ModernPatientRegistrationForm from '../ModernPatientRegistrationForm';
import { resetDependantCodeColumnCache } from '../medicalAid/dependantCode';
import { resetPatientTitleColumnsCache } from '../patientTitleColumns';
import { resetPatientTownColumnsCache } from '../patientTownColumns';
import { resetPatientExtrasColumnsCache } from '../patientExtrasColumns';

const fillPersonalDetails = (idNumber = '90051400123') => {
  fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'Ndapewa' } });
  fireEvent.change(screen.getByPlaceholderText('Enter last name'), { target: { value: 'Shilongo' } });
  fireEvent.change(screen.getByLabelText('ID Number *'), { target: { value: idNumber } });
  fireEvent.change(screen.getByDisplayValue('Select gender'), { target: { value: 'female' } });
};

const next = async (stepTitle: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText(stepTitle, { selector: 'label, p, span' });
};

/** Steps 2 to 4 without medical aid, then "Complete Registration" */
const completeWithoutMedicalAid = async () => {
  await next('Cell Number');
  await next('Medical Aid Provider');
  await next('Next of Kin Name');
  fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }));
};

afterEach(() => cleanup());
beforeEach(() => {
  db.existingById = [];
  db.existingByBirthDate = [];
  db.dependantCodeColumn = false;
  db.titleColumns = true;
  db.townColumns = true;
  db.extrasColumns = true;
  db.temporaryFiles = [];
  db.existingByOldNumber = [];
  db.membershipRows = [];
  db.lookups = [];
  completion.fileComplete = true;
  db.patientInsert.mockReset();
  db.medicalAidInsert.mockReset();
  db.patientInsertError = null;
  toastMock.error.mockClear();
  resetDependantCodeColumnCache();
  resetPatientTitleColumnsCache();
  resetPatientTownColumnsCache();
  resetPatientExtrasColumnsCache();
});

describe('registration: ID number', () => {
  it('fills the date of birth from a Namibian ID number, so reception types it once', async () => {
    render(<ModernPatientRegistrationForm onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('ID Number *'), { target: { value: '9005 1400 123' } });
    expect(await screen.findByText('Date of birth from the ID number: 14 May 1990')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select date')).toHaveValue('14/05/1990');
  });

  it('warns about a mistyped number but still lets a passport number through', async () => {
    render(<ModernPatientRegistrationForm onSuccess={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('ID Number *'), { target: { value: '900514001' } });
    expect(await screen.findByText(/has 11 digits; this one has 9/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('ID Number *'), { target: { value: 'P1234567' } });
    await waitFor(() => expect(screen.queryByText(/has 11 digits/)).not.toBeInTheDocument());
  });

  it('saves the ID number without spaces, so the next duplicate check finds it', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails('9005 1400 123');
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientInsert.mock.calls[0][0][0]).toMatchObject({ id_number: '90051400123', date_of_birth: '1990-05-14', home_language: 'English' });
  });

  // The ID number is unique per practice (a person may be a patient at several practices). A file saved at the same
  // moment by a colleague is the only way past the duplicate check: reception gets plain words, not a database error.
  it('explains an ID number already on another file of this practice instead of showing a database error', async () => {
    db.patientInsertError = { code: '23505', message: 'duplicate key value violates unique constraint "patients_practice_id_number_key"' };
    render(<ModernPatientRegistrationForm onSuccess={vi.fn()} />);
    fillPersonalDetails();
    await completeWithoutMedicalAid();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringMatching(/already on another file at this practice/)));
    expect(toastMock.error).not.toHaveBeenCalledWith(expect.stringMatching(/another practice/));
  });
});

// A patient with a paper file or an account in the practice's previous system is found by that number later, and a
// second file for someone the practice already knows by it is caught before it is saved.
describe('registration: old file number', () => {
  it('saves the old file number as typed (spaces tidied) so the patient is found by it', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    fireEvent.change(screen.getByLabelText('Old file number'), { target: { value: '  A 0012345 ' } });
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientInsert.mock.calls[0][0][0]).toMatchObject({ legacy_account_number: 'A 0012345' });
  });

  it('sends nothing for a blank old file number, so most patients are saved as before', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientInsert.mock.calls[0][0][0]).not.toHaveProperty('legacy_account_number');
  });

  it('offers the practice file that already has this old file number before saving a second one', async () => {
    db.existingByOldNumber = [{ id: 'p-old', first_name: 'Ndapewa', last_name: 'Nangolo', id_number: '80010100555', date_of_birth: '1980-01-01', cell_number: null, legacy_account_number: '0012345' }];
    render(<ModernPatientRegistrationForm onSuccess={vi.fn()} onUseExisting={vi.fn()} />);
    fillPersonalDetails();
    fireEvent.change(screen.getByLabelText('Old file number'), { target: { value: '12345' } });
    await completeWithoutMedicalAid();
    const warning = await screen.findByRole('alert');
    expect(within(warning).getByText('Same old file number')).toBeInTheDocument();
    expect(within(warning).getByText(/Old file no\. 0012345/)).toBeInTheDocument();
    expect(db.patientInsert).not.toHaveBeenCalled();
    // Looked up by the last digits, so "0012345" on the file is found from "12345"
    expect(db.lookups).toContainEqual(['legacy_account_number', '%2345%']);
  });
});

describe('registration: duplicate check', () => {
  const sameNameAndBirthday = { id: 'p-old', first_name: 'Ndapewa', last_name: 'Shilongo', id_number: '90051499999', date_of_birth: '1990-05-14', cell_number: null };

  it('stops before saving when the practice already has someone with the same name and birthday, and opens that file', async () => {
    db.existingByBirthDate = [sameNameAndBirthday];
    const onUseExisting = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={vi.fn()} onUseExisting={onUseExisting} />);
    fillPersonalDetails();
    await completeWithoutMedicalAid();
    const panel = await screen.findByRole('alert');
    expect(within(panel).getByText('This patient may already have a file')).toBeInTheDocument();
    expect(within(panel).getByText('Same name and date of birth')).toBeInTheDocument();
    expect(db.patientInsert).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole('button', { name: /Use this patient/ }));
    expect(onUseExisting).toHaveBeenCalledWith({ id: 'p-old', first_name: 'Ndapewa', last_name: 'Shilongo' });
  });

  it('saves a new file when reception says it is someone else (twins share a birthday)', async () => {
    db.existingByBirthDate = [sameNameAndBirthday];
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await completeWithoutMedicalAid();
    fireEvent.click(await screen.findByRole('button', { name: 'Save as a new patient' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientInsert).toHaveBeenCalledTimes(1);
  });

  it('never offers to save a second file with the same ID number', async () => {
    db.existingById = [{ ...sameNameAndBirthday, id_number: '90051400123' }];
    render(<ModernPatientRegistrationForm onSuccess={vi.fn()} />);
    fillPersonalDetails();
    await completeWithoutMedicalAid();
    await screen.findByText('This patient may already have a file');
    expect(screen.getByText('Same ID number', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as a new patient' })).not.toBeInTheDocument();
  });
});

// A family shares one membership number. A second file for the same member (a surname spelt differently, a birthday
// mistyped) is still one person to the fund, so reception sees that file before a second one is opened; a child on the
// parent's number is not that person.
describe('registration: medical aid membership check', () => {
  const memberOnFile = (patient: Record<string, unknown>) => ({
    medical_aid_provider_id: 'nmc',
    provider: 'Namibia Medical Care',
    membership_number: '012345678',
    dependant_code: null,
    patient: { id: 'p-member', id_number: '90051499999', cell_number: null, legacy_account_number: null, ...patient }
  });
  const registerOnMembership = async () => {
    fillPersonalDetails();
    await next('Cell Number');
    await next('Medical Aid Provider');
    fireEvent.change(screen.getByDisplayValue('None (private patient)'), { target: { value: 'nmc' } });
    fireEvent.change(await screen.findByPlaceholderText('As on the card'), { target: { value: '12345678' } });
    await next('Next of Kin Name');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }));
  };

  it('offers the file on the same fund and membership number with the same first name before saving', async () => {
    db.membershipRows = [memberOnFile({ first_name: 'Ndapewa', last_name: 'Shilongo-Nghifikwa', date_of_birth: '1990-05-15' })];
    render(<ModernPatientRegistrationForm onSuccess={vi.fn()} onUseExisting={vi.fn()} />);
    await registerOnMembership();
    const warning = await screen.findByRole('alert');
    expect(within(warning).getByText('Same medical aid and membership number')).toBeInTheDocument();
    expect(db.patientInsert).not.toHaveBeenCalled();
    // Looked up by the last digits: "012345678" on the file is found from "12345678"
    expect(db.lookups).toContainEqual(['membership_number', '%5678%']);
  });

  it("saves a child on the parent's membership number (another first name and birthday) without a warning", async () => {
    db.membershipRows = [memberOnFile({ first_name: 'Johannes', last_name: 'Shilongo', date_of_birth: '1965-02-02' })];
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    await registerOnMembership();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('registration: medical aid', () => {
  const chooseFundAsChild = async () => {
    await next('Cell Number');
    await next('Medical Aid Provider');
    fireEvent.change(screen.getByDisplayValue('None (private patient)'), { target: { value: 'nmc' } });
    fireEvent.change(await screen.findByPlaceholderText('As on the card'), { target: { value: '12345678' } });
    fireEvent.change(screen.getByDisplayValue('Self (main member)'), { target: { value: 'child' } });
  };

  it('asks for the main member of a dependant and saves the name the way claims read it', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await chooseFundAsChild();
    expect(screen.getByText('NMC membership numbers have 9 digits; this one has 8. Check it against the card.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Main member surname'), { target: { value: 'Shilongo' } });
    fireEvent.change(screen.getByLabelText('Initials'), { target: { value: 'j n' } });
    fireEvent.change(screen.getByLabelText('Main member ID number'), { target: { value: '70010100111' } });
    expect(screen.getByText('SHILONGO JN')).toBeInTheDocument();
    await next('Next of Kin Name');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const saved = db.medicalAidInsert.mock.calls[0][0][0];
    expect(saved).toMatchObject({ relationship_to_main: 'child', main_member_name: 'Shilongo, J N', main_member_id_number: '70010100111', membership_number: '12345678' });
    // The column does not exist yet: the code is not sent, so the save cannot fail on it
    expect(saved).not.toHaveProperty('dependant_code');
    expect(screen.queryByLabelText(/Dependant code/)).not.toBeInTheDocument();
  });

  it('shows and saves the dependant code once the database has the column', async () => {
    db.dependantCodeColumn = true;
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await chooseFundAsChild();
    fireEvent.change(await screen.findByLabelText(/Dependant code/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Main member surname'), { target: { value: 'Shilongo' } });
    await next('Next of Kin Name');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.medicalAidInsert.mock.calls[0][0][0]).toMatchObject({ dependant_code: '02' });
  });

  it('fills the main member from the patient when they hold the membership themselves', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await next('Cell Number');
    await next('Medical Aid Provider');
    fireEvent.change(screen.getByDisplayValue('None (private patient)'), { target: { value: 'nmc' } });
    fireEvent.change(await screen.findByPlaceholderText('As on the card'), { target: { value: '123456789' } });
    expect(screen.queryByLabelText('Main member surname')).not.toBeInTheDocument();
    await next('Next of Kin Name');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.medicalAidInsert.mock.calls[0][0][0]).toMatchObject({
      relationship_to_main: 'self',
      main_member_name: 'Shilongo, N',
      main_member_id_number: '90051400123'
    });
  });
});

// A1: Eminance registers a title and initials, and the practice addresses the patient formally ("Mrs N M Shilongo");
// the employer is asked at registration too, not only when the file is edited later.
describe('registration: title, initials and employer', () => {
  it('fills the initials from the first names and saves the title, initials and employer', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    const initials = await screen.findByLabelText('Initials');
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Mrs' } });
    fillPersonalDetails();
    fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'Ndapewa Maria' } });
    expect(initials).toHaveValue('NM');
    fireEvent.change(screen.getByLabelText('Employer'), { target: { value: 'Namib Mills' } });
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientInsert.mock.calls[0][0][0]).toMatchObject({ title: 'Mrs', initials: 'NM', employer: 'Namib Mills' });
  });

  it('keeps initials reception typed themselves when the first names change', async () => {
    render(<ModernPatientRegistrationForm onSuccess={vi.fn()} />);
    const initials = await screen.findByLabelText('Initials');
    fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'Ndapewa' } });
    fireEvent.change(initials, { target: { value: 'D' } });
    fireEvent.change(screen.getByPlaceholderText('Enter first name'), { target: { value: 'Ndapewa Maria' } });
    expect(initials).toHaveValue('D');
  });

  it('asks for neither and sends neither before the columns exist, so registering never fails on them', async () => {
    db.titleColumns = false;
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    const saved = db.patientInsert.mock.calls[0][0][0];
    expect(saved).not.toHaveProperty('title');
    expect(saved).not.toHaveProperty('initials');
  });
});

// A16: patients are reported by town and region (Eminance's town list); reception picks the town and the region is
// filled from it, so the region is never mistyped and a common spelling (Luderitz) is saved as the town's name.
describe('registration: town and region', () => {
  it('fills the region from the town picked and saves both', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await next('Cell Number');
    fireEvent.change(await screen.findByLabelText('Town'), { target: { value: 'Luder' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Lüderitz/ }));
    expect(screen.getByLabelText('Region')).toHaveValue('//Kharas');
    await next('Medical Aid Provider');
    await next('Next of Kin Name');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientInsert.mock.calls[0][0][0]).toMatchObject({ town: 'Lüderitz', region: '//Kharas' });
  });

  it('asks for neither and sends neither before the columns exist, so registering never fails on them', async () => {
    db.townColumns = false;
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.queryByLabelText('Town')).not.toBeInTheDocument();
    const saved = db.patientInsert.mock.calls[0][0][0];
    expect(saved).not.toHaveProperty('town');
    expect(saved).not.toHaveProperty('region');
  });
});

// A caller booked by phone has a temporary file with a placeholder birthday. Registering the same person in full must
// find that file by the cell number and complete it: otherwise the person has two files and the booking stays on the
// incomplete one (and its claims are refused).
describe('registration: a caller booked earlier with a name and cell only', () => {
  const temporaryFile = { id: 'temp-1', first_name: 'Ndapewa', last_name: 'Shilongo', id_number: 'TEMP-1728000000000-abc123xyz', date_of_birth: '1990-01-01', cell_number: '+264 81 123 4567' };

  const registerWithCell = async () => {
    fillPersonalDetails();
    await next('Cell Number');
    fireEvent.change(screen.getByPlaceholderText('Enter cell number'), { target: { value: '081 123 4567' } });
    await next('Medical Aid Provider');
    await next('Next of Kin Name');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Registration' }));
  };

  it('completes the temporary file found by cell number with what was typed, instead of opening a second file', async () => {
    db.temporaryFiles = [temporaryFile];
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    await registerWithCell();
    const panel = await screen.findByRole('alert');
    expect(within(panel).getByText(/Booked earlier with this cell number/)).toBeInTheDocument();
    expect(within(panel).getByText(/File not complete/)).toBeInTheDocument();
    // A family can share a number, so a new file stays possible
    expect(within(panel).getByRole('button', { name: 'Save as a new patient' })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: /Complete this file/ }));
    expect(screen.getByText('Completing temp-1 with ID 90051400123 born 1990-05-14')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close the completion form' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'temp-1', first_name: 'Ndapewa', last_name: 'Shilongo' }));
    expect(db.patientInsert).not.toHaveBeenCalled();
  });

  it('keeps the choice open when the completion form is closed without completing the file', async () => {
    db.temporaryFiles = [temporaryFile];
    completion.fileComplete = false;
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    await registerWithCell();
    fireEvent.click(await screen.findByRole('button', { name: /Complete this file/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close the completion form' }));
    expect(await screen.findByRole('button', { name: 'Save as a new patient' })).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(db.patientInsert).not.toHaveBeenCalled();
  });
});

// Owner's decision (13 Oct 2026): an optional "How did you hear about us?" at registration, counted per month in
// Reports > Demographics, and an optional photo. Before the database has the columns, nothing is asked or sent, so
// registration keeps working exactly as before.
describe('registration: how the patient heard about us, and the photo', () => {
  it('saves the answer with the new file, with the words typed for Other', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    fireEvent.change(await screen.findByLabelText('How did you hear about us?'), { target: { value: 'other' } });
    fireEvent.change(screen.getByLabelText('Where they heard about us'), { target: { value: ' Church notice board ' } });
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientInsert.mock.calls[0][0][0]).toMatchObject({ referral_source: 'other', referral_source_other: 'Church notice board' });
  });

  it('saves no answer when the question is skipped, so the report counts it as not answered', async () => {
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await screen.findByLabelText('How did you hear about us?');
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(db.patientInsert.mock.calls[0][0][0]).toMatchObject({ referral_source: null, referral_source_other: null });
  });

  it('offers taking or uploading a photo once photos are set up', async () => {
    render(<ModernPatientRegistrationForm />);
    expect(await screen.findByRole('button', { name: 'Take photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload photo' })).toBeInTheDocument();
  });

  it('asks nothing and sends neither column before the database has them', async () => {
    db.extrasColumns = false;
    const onSuccess = vi.fn();
    render(<ModernPatientRegistrationForm onSuccess={onSuccess} />);
    fillPersonalDetails();
    await completeWithoutMedicalAid();
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(screen.queryByLabelText('How did you hear about us?')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take photo' })).not.toBeInTheDocument();
    expect(db.patientInsert.mock.calls[0][0][0]).not.toHaveProperty('referral_source');
  });
});
