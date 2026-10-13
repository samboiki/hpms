// Row shapes the claims module reads. src/types/database.types.ts is out of date, so these list
// only the columns this module selects, and every value that may be missing is nullable.
import type { DoNotClaimFlag } from '../../../utils/billing/claimLine';
import type { PractitionerBillingMap } from '../../../utils/billing/practitionerBilling';
import type { TariffRow } from '../../../utils/billing/pricing';

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
  /** The invoice line's surfaces and quadrant, once proposals/2026-10-12-line-teeth-and-billing-practitioners.sql is applied */
  tooth_surfaces?: string | null;
  tooth_quadrant?: number | null;
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

/** A patient's medical aid record (medical_aid_details). dependant_code exists once proposals/2026-10-07-dependant-code.sql is applied. */
export interface MedicalAidRow {
  patient_id: string | null;
  membership_number: string | null;
  main_member_name: string | null;
  relationship_to_main: string | null;
  dependant_code?: string | null;
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
  /** The line's own service date and treating practitioner, once proposals/2026-10-07-invoicing.sql is applied */
  service_date?: string | null;
  practitioner_id?: string | null;
  /** The line's ICD-10 codes, once proposals/2026-10-08-invoice-line-codes.sql is applied */
  icd10_primary?: string | null;
  icd10_secondary?: string[] | null;
  /** The line's tooth surfaces and quadrant, once proposals/2026-10-12-line-teeth-and-billing-practitioners.sql is applied */
  tooth_surfaces?: string | null;
  tooth_quadrant?: number | null;
  /** The line's note (printed on the invoice): a line charged by time says there how long it took */
  notes?: string | null;
}

/** Everything needed to turn one batch's detail rows into claim lines. */
export interface BatchLineSources {
  details: BatchDetailRow[];
  patients: Map<string, PatientRow>;
  /** Medical aid records per patient, newest first: the main member's name and the patient's relationship to them. */
  medicalAid: Map<string, MedicalAidRow[]>;
  visits: Map<string, VisitRow>;
  doctors: Map<string, DoctorRow>;
  invoiceServices: InvoiceServiceRow[];
  /** True when invoice lines hold ICD-10 codes (proposals/2026-10-08-invoice-line-codes.sql), so codes confirmed at claim review can go back to them. */
  lineCodes?: boolean;
  /**
   * The practice's tariff rows, its own codes merged over the shared list (mergeOwnTariffs): whether a line needs a
   * tooth number comes from them (toothRuleFor, the visit billing's rule). Empty when they could not be read or the
   * practice does not number teeth; no tooth is then required.
   */
  tariffRows: readonly TariffRow[];
  /** practices.practice_type: dental suggestions and NAMAF dental rules apply to dental practices only. */
  practiceType?: string | null;
  /** Patients whose file is marked "Do not claim", by patient id: their lines cannot be sent. */
  doNotClaim?: Map<string, DoNotClaimFlag>;
  /** Each practitioner's own practice number and rate (practitioner_billing): a partner's lines bill under their own number. */
  practitionerBilling?: PractitionerBillingMap;
  /**
   * Each invoice's treating practitioner, by invoice id: a line without its own practitioner is claimed under it, in the
   * claim file and in "Correct and send again" (claimedPractitionerOf), as the database builds the line.
   */
  invoicePractitioners?: ReadonlyMap<string, string>;
  /**
   * The codes the practice charges by time (its code rules, upper case): their lines give the fund the minutes noted
   * on them (claim field 18). Absent or empty: every line sends its quantity, as before.
   */
  timeBasedCodes?: ReadonlySet<string>;
  /** Things that could not be loaded; shown so staff know which checks were skipped. */
  warnings: string[];
}

/** ICD-10 codes for one claim line while the doctor confirms them. */
export interface Icd10Draft {
  primary: string;
  secondary: string[];
  /** False while the codes are only a suggestion read from the visit notes. */
  confirmed: boolean;
  source: 'saved' | 'usual-for-code' | 'visit-notes' | 'code-default' | 'entered' | 'none';
}

/** A billed medical aid invoice that is not in any batch yet. */
export interface UnbatchedInvoice {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string | null;
  serviceDate: string | null;
  patientId: string;
  patientName: string;
  fundReference: string | null;
  fundName: string;
  total: number;
  lineCount: number;
  /** Why no batch can take it until the patient's file is put right (no medical aid, or no fund with a claim code); null when it can be added */
  notClaimableReason: string | null;
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
