// Row shapes the claims module reads. src/types/database.types.ts is out of date, so these list
// only the columns this module selects, and every value that may be missing is nullable.

export interface PracticeInfo {
  id: string;
  name: string;
  practice_number: string | null;
  practice_type: string | null;
  contact_email: string | null;
}

export interface FundProvider {
  id: string;
  name: string;
  short_name: string | null;
  email: string | null;
  medical_aid_reference: string | null;
  logo_url: string | null;
  theme_color: string | null;
}

export interface BatchHeaderRow {
  id: string;
  practice_id: string | null;
  practice_number: string;
  batch_number: number;
  batch_date: string;
  medical_aid_reference: string;
  status: string | null;
  total_amount: number | null;
  total_invoices: number | null;
  generated_file_content: string | null;
  recipient_email: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  created_at: string | null;
  transaction_type: string | null;
  source_software: string | null;
  source_software_version: string | null;
  system_identification: number | null;
}

export interface BatchDetailRow {
  id: string;
  batch_header_id: string | null;
  invoice_id: string | null;
  visit_id: string | null;
  patient_id: string | null;
  transaction_number_in_batch: number;
  system_transaction_number: number | null;
  system_patient_reference_number: string | null;
  type_of_service: string | null;
  medical_aid_reference: string;
  medical_aid_membership_number: string | null;
  member_surname: string | null;
  member_initials: string | null;
  patient_name: string | null;
  patient_date_of_birth: string | null;
  bhf_tariff_code: string;
  service_amount: number | string;
  diagnosis: string | null;
  discount_amount: number | string | null;
  service_date: string;
  number_of_services: number | string | null;
  service_fee: number | string | null;
  modifier_1: string | null;
  modifier_2: string | null;
  modifier_3: string | null;
  modifier_4: string | null;
  invoice_number: string;
  referring_doctor: string | null;
  nappi_code: string | null;
  referred_to_practice_number: string | null;
  practice_number: string;
  hospital_indicator: string | null;
  authorisation_number: string | null;
  resubmission_flag: string | null;
  diagnostic_code: string | null;
  diagnostic_code_type: string | null;
  dosage_description: string | null;
  treating_doctor_hpcsa_number: string | null;
  tooth_numbers: string | null;
  gender: string | null;
  tariff_code_type: string | null;
  cpt_cdt_code: string | null;
  free_text: string | null;
  place_of_service: string | null;
  referring_doctor_2: string | null;
  tracking_number: string | null;
  reading_additions: string | null;
  lens_prescription: string | null;
  density_of_tint: string | null;
  patient_id_number: string | null;
  service_time: string | null;
  employer_name: string | null;
  employee_number: string | null;
  date_of_injury: string | null;
  iod_reference_number: string | null;
}

export interface BatchSubmissionRow {
  id: string;
  batch_header_id: string;
  status: string;
  recipient_email: string;
  file_name: string;
  submitted_at: string;
  sent_at: string | null;
  email_id: string | null;
  error_details: unknown;
  total_amount: number | null;
  total_claims: number | null;
}

export interface PatientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  id_number: string | null;
  gender: string | null;
  system_patient_reference_number: number | string | null;
}

export interface VisitRow {
  id: string;
  visit_date: string | null;
  doctor_id: string | null;
  diagnosis: string | null;
}

export interface DoctorRow {
  id: string;
  full_name: string | null;
  hpcsa_number: string | null;
}

export interface InvoiceServiceRow {
  id: string;
  invoice_id: string;
  code: string;
  unit_price: number | string | null;
  quantity: number | string | null;
  total_price: number | string | null;
  tooth_number: string | null;
  system_transaction_number: number | null;
}

/** Everything needed to turn one batch's detail rows into claim lines. */
export interface BatchLineSources {
  details: BatchDetailRow[];
  patients: Map<string, PatientRow>;
  visits: Map<string, VisitRow>;
  doctors: Map<string, DoctorRow>;
  invoiceServices: InvoiceServiceRow[];
  /** requires_tooth_number per tariff code (empty when the tariff list could not be read). */
  requiresToothByCode: Map<string, boolean>;
  /** Things that could not be loaded; shown so staff know which checks were skipped. */
  warnings: string[];
}

/** ICD-10 codes for one claim line while the doctor confirms them. */
export interface Icd10Draft {
  primary: string;
  secondary: string[];
  /** False while the codes are only a suggestion read from the visit notes. */
  confirmed: boolean;
  source: 'saved' | 'visit-notes' | 'entered' | 'none';
}

/** A billed medical aid invoice that is not in any batch yet. */
export interface UnbatchedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string | null;
  serviceDate: string | null;
  patientName: string;
  fundReference: string | null;
  fundName: string;
  total: number;
  lineCount: number;
}

export interface RemoveInvoiceResult {
  /** removed: lines deleted and invoice unlinked; partial: lines deleted but the invoice still points to the batch. */
  status: 'removed' | 'blocked' | 'partial';
  message: string;
  linesRemoved: number;
  /** database: the trigger updated the totals; recomputed: written here; not_recomputed: basis unknown or unreadable. */
  totals: 'database' | 'recomputed' | 'not_recomputed';
}

export type SubmitBatchStatus = 'sent' | 'failed' | 'sent_not_recorded' | 'blocked';

export interface SubmitBatchResult {
  status: SubmitBatchStatus;
  message: string;
}
