/**
 * Turns one batch's batch_details rows into claim lines, filling gaps from the patient, visit,
 * doctor and invoice records. Pure: no database access, so it is tested directly.
 *
 * Where the batch row and the source records disagree, the source record wins because it is what
 * the fund checks: the date of service is the visit date (the batch rows were filled with the
 * invoice date), the HPCNA number is the treating doctor's own (the batch rows were filled with a
 * fixed default), and the patient reference is the patient's 7-digit number (the batch rows were
 * filled with the patient's database id).
 */
// Explicit .ts extensions: the auto-submit edge function (Deno) imports this file unchanged.
import { toCents } from '../../../utils/billing/money.ts';
import { toDateKey } from '../../../utils/billing/dates.ts';
import { extractIcd10Codes, MAX_SECONDARY_ICD10, normalizeIcd10 } from '../../../utils/billing/icd10.ts';
import { normalizeGender, type ClaimLine } from '../../../utils/billing/claimLine.ts';
import type { BatchDetailRow, BatchLineSources, Icd10Draft, InvoiceServiceRow, VisitRow } from './types.ts';

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value).trim());

const toNumber = (value: unknown): number => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : Number.NaN;
};

const amountCents = (value: unknown): number | null => {
  const number = toNumber(value);
  return Number.isFinite(number) ? toCents(number) : null;
};

/**
 * Pairs each batch line with the invoice line it came from (same invoice, same code, same amount;
 * each invoice line used once), so the tooth number and system transaction number can be filled in.
 */
export function matchInvoiceServices(
  details: readonly BatchDetailRow[],
  invoiceServices: readonly InvoiceServiceRow[]
): Map<string, InvoiceServiceRow> {
  const used = new Set<string>();
  const matches = new Map<string, InvoiceServiceRow>();
  const ordered = [...details].sort((a, b) => a.transaction_number_in_batch - b.transaction_number_in_batch);
  const candidatesFor = (detail: BatchDetailRow) =>
    invoiceServices
      .filter(service => service.invoice_id === detail.invoice_id && text(service.code) === text(detail.bhf_tariff_code) && !used.has(service.id))
      .sort((a, b) => (a.system_transaction_number ?? Number.MAX_SAFE_INTEGER) - (b.system_transaction_number ?? Number.MAX_SAFE_INTEGER));

  for (const detail of ordered) {
    const candidates = candidatesFor(detail);
    const detailCents = amountCents(detail.service_amount);
    const match = candidates.find(service => amountCents(service.total_price) === detailCents) ?? candidates[0];
    if (match) {
      used.add(match.id);
      matches.set(detail.id, match);
    }
  }
  return matches;
}

/** The ICD-10 codes to start from: saved on the batch line, else suggested from the visit notes. */
export function initialIcd10Draft(detail: BatchDetailRow, visit: VisitRow | undefined): Icd10Draft {
  const saved = normalizeIcd10(text(detail.diagnostic_code));
  if (saved) return { primary: saved, secondary: [], confirmed: true, source: 'saved' };
  const suggested = extractIcd10Codes(visit?.diagnosis);
  if (suggested.length > 0) {
    return {
      primary: suggested[0],
      secondary: suggested.slice(1, 1 + MAX_SECONDARY_ICD10),
      confirmed: false,
      source: 'visit-notes'
    };
  }
  return { primary: '', secondary: [], confirmed: false, source: 'none' };
}

const patientReferenceFor = (detail: BatchDetailRow, sources: BatchLineSources): string => {
  const patient = detail.patient_id ? sources.patients.get(detail.patient_id) : undefined;
  const fromPatient = text(patient?.system_patient_reference_number);
  if (/^\d+$/.test(fromPatient)) return fromPatient;
  const fromBatch = text(detail.system_patient_reference_number);
  return /^\d+$/.test(fromBatch) ? fromBatch : '';
};

/** Builds the claim lines for one batch, using the doctor's ICD-10 drafts where given. */
export function buildClaimLines(sources: BatchLineSources, drafts: Record<string, Icd10Draft>): ClaimLine[] {
  const matches = matchInvoiceServices(sources.details, sources.invoiceServices);
  return sources.details.map(detail => {
    const patient = detail.patient_id ? sources.patients.get(detail.patient_id) : undefined;
    const visit = detail.visit_id ? sources.visits.get(detail.visit_id) : undefined;
    const doctor = visit?.doctor_id ? sources.doctors.get(visit.doctor_id) : undefined;
    const invoiceLine = matches.get(detail.id);
    const draft = drafts[detail.id] ?? initialIcd10Draft(detail, visit);
    const code = text(detail.bhf_tariff_code);
    const unitPrice = invoiceLine ? toNumber(invoiceLine.unit_price) : Number.NaN;
    const doctorNumber = text(doctor?.hpcsa_number);
    const patientName = text(detail.patient_name) || [text(patient?.first_name), text(patient?.last_name)].filter(Boolean).join(' ');

    return {
      key: detail.id,
      transactionNumber: Number(detail.transaction_number_in_batch),
      systemTransactionNumber: detail.system_transaction_number ?? invoiceLine?.system_transaction_number ?? null,
      invoiceId: detail.invoice_id,
      invoiceNumber: text(detail.invoice_number),
      visitId: detail.visit_id,
      fundReference: text(detail.medical_aid_reference),
      membershipNumber: text(detail.medical_aid_membership_number),
      memberSurname: text(detail.member_surname),
      memberInitials: text(detail.member_initials),
      patientName,
      patientDateOfBirth: toDateKey(text(detail.patient_date_of_birth) || null) ?? toDateKey(patient?.date_of_birth ?? null),
      patientIdNumber: text(detail.patient_id_number) || text(patient?.id_number),
      patientReference: patientReferenceFor(detail, sources),
      gender: normalizeGender(text(detail.gender) || text(patient?.gender)),
      tariffCode: code,
      description: text(detail.diagnosis),
      serviceDate: toDateKey(visit?.visit_date ?? null) ?? toDateKey(text(detail.service_date) || null),
      quantity: toNumber(detail.number_of_services ?? 1),
      amount: toNumber(detail.service_amount),
      unitPrice: Number.isFinite(unitPrice) ? unitPrice : null,
      practiceNumber: text(detail.practice_number),
      treatingDoctorHpcnaNumber: doctorNumber || text(detail.treating_doctor_hpcsa_number),
      doctorHpcnaNumber: doctorNumber || null,
      icd10Primary: draft.primary,
      icd10Secondary: draft.secondary,
      icd10Confirmed: draft.confirmed,
      toothNumbers: text(detail.tooth_numbers) || text(invoiceLine?.tooth_number),
      requiresTooth: sources.requiresToothByCode.has(code) ? sources.requiresToothByCode.get(code) ?? null : null,
      authorisationNumber: text(detail.authorisation_number),
      resubmissionFlag: text(detail.resubmission_flag),
      extra: {
        typeOfService: detail.type_of_service,
        discountAmount: Number.isFinite(toNumber(detail.discount_amount)) ? toNumber(detail.discount_amount) : 0,
        serviceFee: detail.service_fee,
        modifier1: detail.modifier_1,
        modifier2: detail.modifier_2,
        modifier3: detail.modifier_3,
        modifier4: detail.modifier_4,
        referringDoctor: detail.referring_doctor,
        nappiCode: detail.nappi_code,
        referredToPracticeNumber: detail.referred_to_practice_number,
        hospitalIndicator: detail.hospital_indicator,
        diagnosticCodeType: detail.diagnostic_code_type,
        dosageDescription: detail.dosage_description,
        tariffCodeType: detail.tariff_code_type,
        cptCdtCode: detail.cpt_cdt_code,
        freeText: detail.free_text,
        placeOfService: detail.place_of_service,
        referringDoctor2: detail.referring_doctor_2,
        trackingNumber: detail.tracking_number,
        readingAdditions: detail.reading_additions,
        lensPrescription: detail.lens_prescription,
        densityOfTint: detail.density_of_tint,
        serviceTime: detail.service_time,
        employerName: detail.employer_name,
        employeeNumber: detail.employee_number,
        dateOfInjury: detail.date_of_injury,
        iodReferenceNumber: detail.iod_reference_number
      }
    };
  });
}

/** Which invoice each line belongs to, for "use these codes for the whole invoice". */
export function linesOfInvoice(lines: readonly ClaimLine[], invoiceId: string | null): string[] {
  return lines.filter(line => line.invoiceId === invoiceId).map(line => line.key);
}
