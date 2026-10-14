/**
 * The discharge summary goes home with the patient and to the next practitioner: it must say plainly when the patient
 * came and left, why, the diagnosis and the instructions, and never run text typed by staff as HTML in the print
 * window. Invented data only.
 */
import { describe, expect, it } from 'vitest';
import { dischargeSummaryHtml } from '../dischargeSummary';
import type { AdmissionDetail } from '../../../services/inpatientService';

const detail = (overrides: Partial<AdmissionDetail['admission']> = {}): AdmissionDetail => ({
  admission: {
    id: 'a1', admission_number: 'ADM-2026-000007', patient_id: 'p1', visit_id: null, admission_date: '2026-10-10T08:00:00Z',
    expected_discharge_date: null, actual_discharge_date: '2026-10-13T09:00:00Z', admission_type: 'emergency', admission_source: null,
    attending_doctor_id: 'd1', admitting_doctor_id: 'd1', referring_doctor_name: null, referring_hospital: null,
    chief_complaint: 'Fever <script>alert(1)</script>', primary_diagnosis: 'Pneumonia', primary_diagnosis_code: 'J18.9',
    secondary_diagnoses: [], secondary_diagnosis_codes: ['E11.9'], admission_status: 'discharged', patient_condition: 'stable',
    pre_authorization_number: 'AUTH-1', discharge_type: 'home', discharge_disposition: null, discharge_instructions: 'Rest & fluids',
    follow_up_date: '2026-10-20', special_requirements: [], isolation_required: false, isolation_type: null, fall_risk: false,
    allergy_alert: false, discharged_by: 'd1', billed_invoice_id: null, billed_at: null, patients: { first_name: 'Test', last_name: 'Patient' },
    ...overrides
  },
  allocations: [{ id: 'x', admission_id: 'a1', bed_id: 'b1', ward_id: 'w1', allocated_at: '2026-10-10T08:00:00Z', released_at: '2026-10-13T09:00:00Z', is_current: false }],
  transfers: [],
  rounds: [],
  nursing: [],
  medications: [],
  visitors: []
});

const meta = { practiceName: 'Example Practice', patientName: 'Test Patient', staffName: () => 'Dr Example', bedName: () => 'Bed 4, Ward B' };

describe('the discharge summary', () => {
  it('escapes what staff typed, so a reason or instruction can never run as a script in the print window', () => {
    const html = dischargeSummaryHtml(detail(), meta);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Rest &amp; fluids');
  });

  it('gives the dates day first in Windhoek time, the diagnosis codes, the authorisation and the follow-up', () => {
    const html = dischargeSummaryHtml(detail(), meta);
    expect(html).toContain('10 Oct 2026');
    expect(html).toContain('13 Oct 2026 (Home)');
    expect(html).toContain('ICD-10 J18.9, E11.9');
    expect(html).toContain('AUTH-1');
    expect(html).toContain('Follow-up on 20 Oct 2026');
    expect(html).toContain('Bed 4, Ward B');
  });

  it('says "still admitted" for a stay that has not ended, so it is never mistaken for a discharge letter', () => {
    const html = dischargeSummaryHtml(detail({ admission_status: 'active', actual_discharge_date: null }), meta);
    expect(html).toContain('Stay summary (still admitted)');
    expect(html).not.toContain('<h2>Instructions</h2>');
  });
});
