/**
 * What both visit screens ("Create Visit" in AddVisitTabs, "Update Visit" in EditVisitTabs) need so a save can never
 * be done twice: the checks that run before anything is written, and one save at a time.
 * A save that is refused writes nothing, so pressing the button again is safe; a double click while a save runs does
 * nothing, so it can never write a second visit or bill the patient twice.
 */
import { useCallback, useRef } from 'react';

export interface MedicineDraft {
  medication_name?: string | null;
  dosage?: string | null;
  frequency?: string | null;
}

/**
 * The medicines that cannot be saved, each in a sentence: the prescription and the patient's medicine list are made
 * from these rows, so each needs a real name (3 letters or more), its dose and how often it is taken.
 */
export function medicationIssues(medications: readonly MedicineDraft[]): string[] {
  return medications.flatMap(med => {
    const name = med.medication_name ?? '';
    if (name.trim().length < 3) return [`Medication name "${name || '(empty)'}" must be at least 3 characters`];
    if (!(med.dosage ?? '').trim()) return [`Dosage is required for ${name}`];
    if (!(med.frequency ?? '').trim()) return [`Frequency is required for ${name}`];
    return [];
  });
}

/**
 * Runs a save one at a time: a call while another is still running does nothing and returns undefined. A ref, not
 * state: the button is disabled only after React renders, and a second click can land before that.
 */
export function useOneSaveAtATime(): <T>(save: () => Promise<T>) => Promise<T | undefined> {
  const running = useRef(false);
  return useCallback(async <T,>(save: () => Promise<T>): Promise<T | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    try {
      return await save();
    } finally {
      running.current = false;
    }
  }, []);
}
