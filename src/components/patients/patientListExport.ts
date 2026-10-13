import { format } from 'date-fns';
import { patientReferenceLabel } from '../../utils/patients/patientNumbers';

/** What the Patients list knows of a patient that its export writes */
export interface ExportablePatient {
  first_name: string;
  last_name: string;
  system_patient_reference_number?: number | null;
  legacy_account_number?: string | null;
  id_number?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  cell_number?: string | null;
  email?: string | null;
  last_visit_date?: string | null;
  medical_aid_details?: ReadonlyArray<{ provider?: string | null; membership_number?: string | null }> | null;
}

/**
 * One patient in the Patients export (CSV and Excel): the numbers the file is known by (never the internal database id)
 * and only columns the database has. "Blood Type", "Allergies" and "Chronic Conditions" were always blank, and a blank
 * Allergies column reads as "no allergies".
 */
export function patientExportRow(patient: ExportablePatient): Record<string, string> {
  return {
    'Reference': patientReferenceLabel(patient.system_patient_reference_number) ?? '',
    'Old File Number': patient.legacy_account_number || '',
    'Name': `${patient.first_name} ${patient.last_name}`,
    'ID Number': patient.id_number || '',
    'Date of Birth': patient.date_of_birth ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy') : '',
    'Gender': patient.gender || '',
    'Phone': patient.cell_number || '',
    'Email': patient.email || '',
    'Medical Aid': patient.medical_aid_details?.[0]?.provider || 'None',
    'Medical Aid Number': patient.medical_aid_details?.[0]?.membership_number || '',
    'Last Visit': patient.last_visit_date ? format(new Date(patient.last_visit_date), 'dd/MM/yyyy') : 'Never'
  };
}
