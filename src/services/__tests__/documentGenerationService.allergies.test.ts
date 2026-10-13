import { describe, expect, it } from 'vitest';
import { DocumentGenerationService } from '../documentGenerationService';

// Invented visit, practice and patient
const visit = {
  id: 'visit-1234-5678',
  visit_date: '2026-10-07',
  patients: { first_name: 'Ndapewa', last_name: 'Shilongo' },
  users: { full_name: 'Dr A Example' }
};
const practice = { name: 'Example Family Practice', primary_color: '#123456' };
const medications = [{ medication_name: 'Paracetamol 500mg', dosage: '2 tablets', frequency: 'Every 6 hours', duration: '3 days' }];

const prescriptionHtml = (allergyLine: string | null): string =>
  (new DocumentGenerationService() as unknown as {
    createPrescriptionHTML: (visit: unknown, practice: unknown, medications: unknown[], medicalAid: unknown, allergyLine: string | null) => string;
  }).createPrescriptionHTML(visit, practice, medications, null, allergyLine);

describe('printed prescription: allergies', () => {
  it('shows the recorded allergies to the pharmacist who dispenses from the script', () => {
    expect(prescriptionHtml('Allergies: Penicillin (severe), Latex')).toContain('Allergies: Penicillin (severe), Latex');
  });

  it('prints allergy text as text, never as markup', () => {
    const html = prescriptionHtml('Allergies: <img src=x onerror=alert(1)>');
    expect(html).toContain('Allergies: &lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
  });

  it('prints no allergy line when allergies were never recorded', () => {
    expect(prescriptionHtml(null)).not.toContain('Allergies:');
  });
});
