/**
 * The printable discharge summary, in the app's printed-document style (PAGE_STYLE, as the claim report and receipts):
 * who, when, why, the diagnosis, what was done (rounds, beds), the medicines at discharge and the instructions.
 * Everything is escaped; dates day first.
 */
import { escapeHtml } from '../finance/financeExport';
import { PAGE_STYLE } from '../finance/claims/claimReport';
import type { AdmissionDetail } from '../../services/inpatientService';
import { formatServiceDate } from '../../utils/billing/dates';
import {
  ADMISSION_TYPES,
  DISCHARGE_TYPES,
  labelOf,
  ROUND_CONDITIONS,
  ROUTES,
  windhoekDay
} from '../../utils/inpatient/inpatientRules';

export interface DischargeSummaryMeta {
  practiceName: string;
  patientName: string;
  staffName: (id: string | null | undefined) => string;
  bedName: (bedId: string) => string;
}

const when = (moment: string | null | undefined): string => (moment ? formatServiceDate(windhoekDay(moment)) : '-');
const text = (value: string | null | undefined): string => escapeHtml(value?.trim() || '-');

export function dischargeSummaryHtml(detail: AdmissionDetail, meta: DischargeSummaryMeta): string {
  const { admission } = detail;
  const discharged = admission.admission_status !== 'active';
  const codes = [admission.primary_diagnosis_code, ...(admission.secondary_diagnosis_codes ?? [])].filter(Boolean).join(', ');
  const facts: Array<[string, string]> = [
    ['Patient', meta.patientName],
    ['Admission number', admission.admission_number],
    ['Admitted', `${when(admission.admission_date)} (${labelOf(ADMISSION_TYPES, admission.admission_type)})`],
    ['Discharged', discharged ? `${when(admission.actual_discharge_date)} (${labelOf(DISCHARGE_TYPES, admission.discharge_type)})` : 'Still admitted'],
    ['Attending doctor', meta.staffName(admission.attending_doctor_id) || '-'],
    ['Medical aid authorisation', admission.pre_authorization_number || '-']
  ];
  const beds = detail.allocations.map(allocation => `<tr><td>${escapeHtml(meta.bedName(allocation.bed_id))}</td><td>${when(allocation.allocated_at)}</td>`
    + `<td>${allocation.released_at ? when(allocation.released_at) : '-'}</td></tr>`).join('');
  const rounds = [...detail.rounds].reverse().map(round => `<tr><td>${when(round.round_datetime)}</td><td>${escapeHtml(meta.staffName(round.doctor_id))}</td>`
    + `<td>${escapeHtml(labelOf(ROUND_CONDITIONS, round.patient_condition))}</td><td>${text(round.doctor_notes || round.examination_findings)}</td></tr>`).join('');
  const medicines = detail.medications.map(med => `<tr><td>${escapeHtml(med.medication_name)}</td><td>${escapeHtml(`${med.dosage}${med.dosage_unit ? ` ${med.dosage_unit}` : ''}`)}</td>`
    + `<td>${escapeHtml(labelOf(ROUTES, med.route))}</td><td>${escapeHtml(med.frequency)}</td>`
    + `<td>${escapeHtml(med.status === 'discontinued' ? `Stopped: ${med.discontinuation_reason ?? ''}` : med.status === 'completed' ? 'Until discharge' : 'Active')}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(`Discharge summary ${admission.admission_number}`)}</title>
<style>${PAGE_STYLE}h2{font-size:14px;margin:20px 0 6px}</style></head><body>
<h1>${discharged ? 'Discharge summary' : 'Stay summary (still admitted)'}</h1>
<p class="muted">${escapeHtml(meta.practiceName)}</p>
<table class="facts">${facts.map(([label, value]) => `<tr><td class="muted">${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}</table>
<h2>Reason for admission</h2><p>${text(admission.chief_complaint)}</p>
<h2>Diagnosis</h2><p>${text(admission.primary_diagnosis)}${codes ? ` <span class="muted">(ICD-10 ${escapeHtml(codes)})</span>` : ''}</p>
${beds ? `<h2>Beds</h2><table class="lines"><thead><tr><th>Bed</th><th>From</th><th>Until</th></tr></thead><tbody>${beds}</tbody></table>` : ''}
${rounds ? `<h2>Ward rounds</h2><table class="lines"><thead><tr><th>Day</th><th>Doctor</th><th>Condition</th><th>Notes</th></tr></thead><tbody>${rounds}</tbody></table>` : ''}
${medicines ? `<h2>Medicines in hospital</h2><table class="lines"><thead><tr><th>Medicine</th><th>Dose</th><th>How</th><th>How often</th><th>Status</th></tr></thead><tbody>${medicines}</tbody></table>` : ''}
${discharged ? `<h2>Instructions</h2><p>${text(admission.discharge_instructions)}</p>
<p>${admission.discharge_disposition ? `Goes to: ${escapeHtml(admission.discharge_disposition)}. ` : ''}${admission.follow_up_date ? `Follow-up on ${escapeHtml(formatServiceDate(admission.follow_up_date))}.` : ''}</p>
<p class="note">Discharged by ${escapeHtml(meta.staffName(admission.discharged_by) || '-')}.</p>` : ''}
</body></html>`;
}
