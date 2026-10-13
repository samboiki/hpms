/**
 * "Edit medication" on a visit (medicineEdit.ts): a wrong dose or frequency is corrected by taking the medicine back
 * into the add form, changing it and adding it again. What matters to a practice: the prescription never holds the
 * medicine twice (the old row leaves the list) and nothing typed on the row is lost on the way to the form.
 */
import { describe, expect, it } from 'vitest';
import { takeMedicineToEdit } from '../medicineEdit';

const amoxicillin = { id: 1, medication_name: 'Amoxicillin', dosage: '500mg', frequency: 'Three times daily', duration: '5 days', instructions: 'After meals' };
const paracetamol = { id: 2, medication_name: 'Paracetamol', dosage: '1g', frequency: 'As needed', duration: '3 days', instructions: '' };

describe('takeMedicineToEdit', () => {
  it('puts every field of the medicine back in the form and takes it off the list, so it is never prescribed twice', () => {
    const edit = takeMedicineToEdit([amoxicillin, paracetamol], 1);
    expect(edit?.form).toEqual({
      medication_name: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Three times daily',
      duration: '5 days',
      instructions: 'After meals'
    });
    expect(edit?.rest).toEqual([paracetamol]);
  });

  // A medicine loaded from an earlier save may miss a field: the form shows it empty, never "null"
  it('shows a missing field as empty', () => {
    const saved = { id: 'row-1', medication_name: 'Ibuprofen', dosage: '400mg', frequency: null, duration: undefined, instructions: null };
    expect(takeMedicineToEdit([saved], 'row-1')?.form).toEqual({
      medication_name: 'Ibuprofen',
      dosage: '400mg',
      frequency: '',
      duration: '',
      instructions: ''
    });
  });

  it('changes nothing for a medicine that is no longer on the list', () => {
    expect(takeMedicineToEdit([amoxicillin], 99)).toBeNull();
  });
});
