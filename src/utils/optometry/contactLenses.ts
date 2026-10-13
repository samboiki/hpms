/**
 * Contact-lens supplies: how long a supply lasts, the day it runs out, and the steps of a supply ordered for a
 * patient. The run-out day of the patient's latest supply puts them on the "Contact lenses running out" patient list
 * in time to order more (patient_list_facts in proposals/2026-10-08-optometry.sql; the rule is in
 * src/utils/patientLists/listRules.ts). Pure; tested in __tests__/contactLenses.test.ts.
 */
import { addDaysToKey, addMonthsToKey, daysBetweenKeys, isValidDateKey } from '../billing/dates';
import { parsePlainNumber } from './prescription';

export type Replacement = 'daily' | 'two_weekly' | 'monthly' | 'three_monthly' | 'yearly';
export const REPLACEMENTS: readonly Replacement[] = ['daily', 'two_weekly', 'monthly', 'three_monthly', 'yearly'];
export const REPLACEMENT_LABELS: Readonly<Record<Replacement, string>> = {
  daily: 'Daily',
  two_weekly: 'Every two weeks',
  monthly: 'Monthly',
  three_monthly: 'Every three months',
  yearly: 'Yearly'
};

/**
 * The day a supply runs out: each eye wears one lens per replacement period, so `lensesPerEye` lenses last that
 * many periods. Monthly and longer periods are calendar months (a monthly lens is changed on the same day each
 * month), shorter ones are days.
 */
export function supplyRunsOutOn(startOn: string, replacement: Replacement, lensesPerEye: number): string {
  const lenses = Math.max(1, Math.trunc(lensesPerEye));
  switch (replacement) {
    case 'daily':
      return addDaysToKey(startOn, lenses);
    case 'two_weekly':
      return addDaysToKey(startOn, 14 * lenses);
    case 'monthly':
      return addMonthsToKey(startOn, lenses);
    case 'three_monthly':
      return addMonthsToKey(startOn, 3 * lenses);
    case 'yearly':
      return addMonthsToKey(startOn, 12 * lenses);
  }
}

export type SupplyStatus = 'ordered' | 'received' | 'collected' | 'cancelled';
export const SUPPLY_STATUS_LABELS: Readonly<Record<SupplyStatus, string>> = {
  ordered: 'Ordered from the supplier',
  received: 'In, waiting for the patient',
  collected: 'With the patient',
  cancelled: 'Cancelled'
};
export const SUPPLY_STATUS_ACTIONS: Readonly<Record<SupplyStatus, string>> = {
  ordered: 'Ordered',
  received: 'Arrived',
  collected: 'Collected',
  cancelled: 'Cancel'
};
export const NEXT_SUPPLY_STATUSES: Readonly<Record<SupplyStatus, readonly SupplyStatus[]>> = {
  ordered: ['received', 'collected', 'cancelled'],
  received: ['collected', 'cancelled'],
  collected: [],
  cancelled: []
};

export const LENSES_PER_EYE_LIMITS = { min: 1, max: 400 } as const;
/** "Running out" this many days before the day */
export const RUNNING_OUT_DAYS = 14;

export type RunOutState = 'ok' | 'soon' | 'out';

/** Whether a supply with the patient is fine, running out within two weeks, or already out. */
export function runOutState(runsOutOn: string | null, today: string): RunOutState | null {
  if (!runsOutOn || !isValidDateKey(runsOutOn) || !isValidDateKey(today)) return null;
  const days = daysBetweenKeys(today, runsOutOn);
  if (days < 0) return 'out';
  return days <= RUNNING_OUT_DAYS ? 'soon' : 'ok';
}

export interface SupplyDraft {
  prescriptionId: string;
  lensName: string;
  replacement: Replacement | '';
  lensesPerEye: string;
  supplierId: string;
  /** 'collected': handed to the patient now (from stock); 'ordered': ordered from the supplier for the patient */
  status: 'ordered' | 'collected';
  startOn: string;
  runsOutOn: string;
  notes: string;
}

export type SupplyDraftErrors = Partial<Record<keyof SupplyDraft, string>>;

export const emptySupplyDraft = (today: string, lensName = '', prescriptionId = ''): SupplyDraft => ({
  prescriptionId,
  lensName,
  replacement: '',
  lensesPerEye: '',
  supplierId: '',
  status: 'collected',
  startOn: today,
  runsOutOn: '',
  notes: ''
});

/** The run-out day the form suggests: from the day the patient starts on the supply. */
export function suggestedRunOut(draft: Pick<SupplyDraft, 'replacement' | 'lensesPerEye' | 'startOn'>): string | null {
  const lenses = parsePlainNumber(draft.lensesPerEye, 0);
  if (!draft.replacement || !lenses.ok || !lenses.value || !isValidDateKey(draft.startOn)) return null;
  return supplyRunsOutOn(draft.startOn, draft.replacement, lenses.value);
}

/** Checks the supply form and builds the optometry_cl_supply_save payload. */
export function validateSupplyDraft(
  draft: SupplyDraft,
  today: string
): { ok: true; payload: Record<string, unknown> } | { ok: false; errors: SupplyDraftErrors } {
  const errors: SupplyDraftErrors = {};
  const lensName = draft.lensName.trim();
  if (!lensName) errors.lensName = 'Name the lenses, e.g. the brand and product.';
  else if (lensName.length > 80) errors.lensName = 'Keep the lens name to 80 characters.';
  if (!draft.replacement) errors.replacement = 'Choose how often the lenses are replaced.';
  const lenses = parsePlainNumber(draft.lensesPerEye, 0);
  if (!lenses.ok || lenses.value === null || lenses.value < LENSES_PER_EYE_LIMITS.min || lenses.value > LENSES_PER_EYE_LIMITS.max) {
    errors.lensesPerEye = `Lenses for each eye: ${LENSES_PER_EYE_LIMITS.min} to ${LENSES_PER_EYE_LIMITS.max}.`;
  }
  let startOn: string | null = null;
  let runsOutOn: string | null = null;
  if (draft.status === 'collected') {
    if (!isValidDateKey(draft.startOn)) errors.startOn = 'Choose the day the patient got the lenses.';
    else if (draft.startOn > today) errors.startOn = 'That day is still to come: record the supply when the patient collects it.';
    else startOn = draft.startOn;
    if (!isValidDateKey(draft.runsOutOn)) errors.runsOutOn = 'Choose the day the lenses run out.';
    else if (startOn && draft.runsOutOn <= startOn) errors.runsOutOn = 'The lenses run out after the day they were collected.';
    else runsOutOn = draft.runsOutOn;
  }
  if (draft.notes.trim().length > 300) errors.notes = 'Keep the notes to 300 characters.';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      prescription_id: draft.prescriptionId || null,
      lens_name: lensName,
      replacement: draft.replacement,
      lenses_per_eye: lenses.ok ? lenses.value : null,
      supplier_id: draft.supplierId || null,
      status: draft.status,
      collected_on: startOn,
      runs_out_on: runsOutOn,
      notes: draft.notes.trim() || null
    }
  };
}
