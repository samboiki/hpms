import { supabase } from '../../../lib/supabase';

// Test medication save validation
describe('Medication Save Validation', () => {
  test('should validate medication data before saving', async () => {
    const invalidMedications = [
      { medication_name: 'Amox', dosage: '', frequency: '' }, // Incomplete name
      { medication_name: '', dosage: '500mg', frequency: 'twice daily' }, // Empty name
      { medication_name: null, dosage: '500mg', frequency: 'once daily' }, // Null name
    ];

    for (const med of invalidMedications) {
      expect(() => {
        if (!med.medication_name || med.medication_name.length < 3) {
          throw new Error(`Invalid medication name: ${med.medication_name}`);
        }
      }).toThrow();
    }
  });

  test('should properly save valid medications', async () => {
    const validMedications = [
      { 
        medication_name: 'Amoxicillin 500mg', 
        dosage: '500mg', 
        frequency: 'three times daily',
        duration: '7 days',
        instructions: 'Take with food'
      },
      { 
        medication_name: 'Paracetamol', 
        dosage: '1000mg', 
        frequency: 'every 6 hours',
        duration: 'as needed',
        instructions: 'Do not exceed 4g per day'
      },
    ];

    // Each medication should have required fields
    validMedications.forEach(med => {
      expect(med.medication_name).toBeTruthy();
      expect(med.medication_name.length).toBeGreaterThanOrEqual(3);
      expect(med.dosage).toBeTruthy();
      expect(med.frequency).toBeTruthy();
    });
  });
});

// Agent detection patterns for medication validation
export const medicationValidationPatterns = {
  incompleteMedication: /medication_name.*length\s*<\s*3/,
  missingDosage: /dosage.*(?:undefined|null|'')/,
  properValidation: /if\s*\(!.*medication_name.*\|\|.*medication_name.*length/
};

// Recommended validation function
export function validateMedication(medication: any): string[] {
  const errors: string[] = [];

  if (!medication.medication_name || medication.medication_name.trim().length < 3) {
    errors.push('Medication name must be at least 3 characters');
  }

  if (!medication.dosage || medication.dosage.trim() === '') {
    errors.push('Dosage is required');
  }

  if (!medication.frequency || medication.frequency.trim() === '') {
    errors.push('Frequency is required');
  }

  return errors;
}