/**
 * "Edit medication" in a visit's prescribed medicines, the same on both visit screens (Create Visit in AddVisitTabs,
 * Update Visit in EditVisitTabs): the medicine goes back into the "Add New Medication" form and leaves the list, so
 * staff change it and press Add again (the allergy check runs again on Add). Nothing is saved until the visit is.
 */

/** The five fields of the "Add New Medication" form */
export interface MedicineFormFields {
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

/** A prescribed medicine as the visit screens hold it (a saved row has more columns; a new one a temporary id) */
export interface PrescribedMedicine {
  id?: unknown;
  medication_name?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  instructions?: string | null;
}

/**
 * The medicine `id` as the add form's fields, and the list without it; null when the list has no such medicine
 * (then nothing changes).
 */
export function takeMedicineToEdit<T extends PrescribedMedicine>(
  medications: readonly T[],
  id: unknown
): { form: MedicineFormFields; rest: T[] } | null {
  const medicine = medications.find(med => med.id === id);
  if (!medicine) return null;
  return {
    form: {
      medication_name: medicine.medication_name || '',
      dosage: medicine.dosage || '',
      frequency: medicine.frequency || '',
      duration: medicine.duration || '',
      instructions: medicine.instructions || ''
    },
    rest: medications.filter(med => med.id !== id)
  };
}
