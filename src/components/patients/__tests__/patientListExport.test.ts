/**
 * The Patients export (CSV and Excel). It wrote the internal database id as "Patient ID" and three columns the database
 * does not have (always blank): a blank "Allergies" column reads as "no allergies" to whoever opens the sheet.
 */
import { describe, expect, it } from 'vitest';
import { patientExportRow } from '../patientListExport';

const patient = {
  first_name: 'Test',
  last_name: 'Patient',
  system_patient_reference_number: 1234,
  legacy_account_number: '0000104',
  id_number: '81030300123',
  date_of_birth: '1981-03-03',
  gender: 'female',
  cell_number: '+264 81 000 0000',
  email: 'patient@example.test',
  last_visit_date: '2026-10-01',
  medical_aid_details: [{ provider: 'Example Fund', membership_number: '12345678901' }]
};

describe('patientExportRow', () => {
  it('writes the numbers the file is known by, never the internal id', () => {
    const row = patientExportRow(patient);
    expect(row).toMatchObject({ 'Reference': '1234', 'Old File Number': '0000104', 'ID Number': '81030300123' });
    expect(Object.keys(row)).not.toContain('Patient ID');
  });

  it('has no always-blank Blood Type, Allergies or Chronic Conditions columns', () => {
    const columns = Object.keys(patientExportRow(patient));
    for (const column of ['Blood Type', 'Allergies', 'Chronic Conditions']) expect(columns).not.toContain(column);
  });

  it('writes dates day first', () => {
    expect(patientExportRow(patient)).toMatchObject({ 'Date of Birth': '03/03/1981', 'Last Visit': '01/10/2026' });
  });
});
