/**
 * Injury on duty, occupational disease and motor vehicle accident cases on the patient's file (parity A19): entered once
 * (the employer, the employee number, the date, the fund's claim number) and reused by every visit of the case, whose
 * invoices go to the case's payer. The rules here are those of save_injury_case
 * (proposals/2026-10-13-company-accounts-and-injury-cases.sql), checked before anything is sent.
 *
 * Who pays a case by default: the Employees' Compensation Fund of the Social Security Commission for an injury on duty
 * or an occupational disease, the MVA Fund for a motor vehicle accident. The employer can pay instead (when it is one
 * of the practice's company accounts), another account (an insurer), or the patient (for example after the fund
 * refused the claim: the patient's medical aid is then claimed as usual).
 */
import { formatServiceDate } from '../billing/dates';
import { referenceNumberProblem } from './payerAccounts';

export type InjuryCaseType = 'injury_on_duty' | 'occupational_disease' | 'motor_vehicle_accident';

export const INJURY_CASE_TYPES: readonly InjuryCaseType[] = ['injury_on_duty', 'occupational_disease', 'motor_vehicle_accident'];

export const CASE_TYPE_LABELS: Record<InjuryCaseType, string> = {
  injury_on_duty: 'Injury on duty',
  occupational_disease: 'Occupational disease',
  motor_vehicle_accident: 'Motor vehicle accident'
};

/** Short labels for chips and lists */
export const CASE_TYPE_SHORT: Record<InjuryCaseType, string> = {
  injury_on_duty: 'IOD',
  occupational_disease: 'Occupational disease',
  motor_vehicle_accident: 'MVA'
};

/** The date asked for, by kind of case */
export const CASE_DATE_LABELS: Record<InjuryCaseType, string> = {
  injury_on_duty: 'Date of the injury',
  occupational_disease: 'Date of the diagnosis',
  motor_vehicle_accident: 'Date of the accident'
};

/** Who pays a case: the standard fund for its kind, the employer, another account or the patient */
export type CasePayerChoice = 'standard' | 'employer' | 'account' | 'patient';

/** The fund that pays a kind of case unless someone else does */
export const STANDARD_PAYER_LABELS: Record<InjuryCaseType, string> = {
  injury_on_duty: "Employees' Compensation Fund (Social Security Commission)",
  occupational_disease: "Employees' Compensation Fund (Social Security Commission)",
  motor_vehicle_accident: 'Motor Vehicle Accident Fund (MVA Fund)'
};

/** An injury on duty and an occupational disease are paid with the employer's report: the employer is needed */
export const needsEmployer = (type: InjuryCaseType): boolean => type !== 'motor_vehicle_accident';

export interface InjuryCase {
  id: string;
  patientId: string;
  type: InjuryCaseType;
  /** yyyy-MM-dd */
  injuryDate: string;
  employerAccountId: string | null;
  employerName: string | null;
  employeeNumber: string | null;
  claimNumber: string | null;
  /** null: the patient pays (and their medical aid is claimed) */
  payerAccountId: string | null;
  notes: string | null;
  closedAt: string | null;
  removedAt: string | null;
  createdAt: string | null;
}

export interface RawInjuryCaseRow {
  id: string;
  patient_id?: string | null;
  case_type?: string | null;
  injury_date?: string | null;
  employer_account_id?: string | null;
  employer_name?: string | null;
  employee_number?: string | null;
  claim_number?: string | null;
  payer_account_id?: string | null;
  notes?: string | null;
  closed_at?: string | null;
  removed_at?: string | null;
  created_at?: string | null;
}

const text = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
};

export function normalizeInjuryCase(row: RawInjuryCaseRow): InjuryCase | null {
  const type = INJURY_CASE_TYPES.find(item => item === row.case_type);
  const date = (row.injury_date ?? '').slice(0, 10);
  if (!row.id || !row.patient_id || !type || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return {
    id: row.id,
    patientId: row.patient_id,
    type,
    injuryDate: date,
    employerAccountId: row.employer_account_id ?? null,
    employerName: text(row.employer_name),
    employeeNumber: text(row.employee_number),
    claimNumber: text(row.claim_number),
    payerAccountId: row.payer_account_id ?? null,
    notes: text(row.notes),
    closedAt: row.closed_at ?? null,
    removedAt: row.removed_at ?? null,
    createdAt: row.created_at ?? null
  };
}

export type CaseState = 'open' | 'closed' | 'removed';

export const caseState = (item: Pick<InjuryCase, 'closedAt' | 'removedAt'>): CaseState =>
  item.removedAt ? 'removed' : item.closedAt ? 'closed' : 'open';

/** "Injury on duty, 10 Oct 2026" */
export const caseTitle = (item: Pick<InjuryCase, 'type' | 'injuryDate'>): string =>
  `${CASE_TYPE_LABELS[item.type]}, ${formatServiceDate(item.injuryDate)}`;

/** The employer as the case names it: the account's name, else the name typed */
export function caseEmployer(item: Pick<InjuryCase, 'employerAccountId' | 'employerName'>, accountNames: Readonly<Record<string, string>>): string | null {
  if (item.employerAccountId) return accountNames[item.employerAccountId] ?? 'Company account';
  return item.employerName;
}

/** Who pays, in words: the account's name, or "The patient (and their medical aid)" */
export const casePayerName = (item: Pick<InjuryCase, 'payerAccountId'>, accountNames: Readonly<Record<string, string>>): string =>
  item.payerAccountId ? accountNames[item.payerAccountId] ?? 'Payer account' : 'The patient (and their medical aid)';

/** The details a claim, an invoice and the lists show: "Employer Kalahari Builders, employee E-1002, claim ECF/2026/1" */
export function caseDetails(item: InjuryCase, accountNames: Readonly<Record<string, string>>): string {
  const employer = caseEmployer(item, accountNames);
  return [
    employer ? `employer ${employer}` : null,
    item.employeeNumber ? `employee no ${item.employeeNumber}` : null,
    item.claimNumber ? `claim no ${item.claimNumber}` : 'no claim number yet'
  ]
    .filter(Boolean)
    .join(', ')
    .replace(/^./, first => first.toUpperCase());
}

/** The cases a visit on this date can be billed under: open ones, the most recent injury first */
export function casesForVisit(cases: readonly InjuryCase[]): InjuryCase[] {
  return cases
    .filter(item => caseState(item) === 'open')
    .sort((a, b) => b.injuryDate.localeCompare(a.injuryDate) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

// ---- Saving a case ----------------------------------------------------------------------------------------------------

export interface InjuryCaseDraft {
  type: InjuryCaseType;
  injuryDate: string;
  /** One of the practice's employer accounts; empty: the name below */
  employerAccountId: string;
  employerName: string;
  employeeNumber: string;
  claimNumber: string;
  payer: CasePayerChoice;
  /** With payer 'account' */
  payerAccountId: string;
  notes: string;
  closed: boolean;
}

export type InjuryCaseField = keyof InjuryCaseDraft;

export const emptyInjuryCaseDraft = (todayKey: string): InjuryCaseDraft => ({
  type: 'injury_on_duty',
  injuryDate: todayKey,
  employerAccountId: '',
  employerName: '',
  employeeNumber: '',
  claimNumber: '',
  payer: 'standard',
  payerAccountId: '',
  notes: '',
  closed: false
});

/**
 * The draft of a saved case. Who pays is read back as the choice that gives it: the standard fund when the case's payer
 * is that fund's account, the employer when it is the employer's account, the patient when nobody, else that account.
 */
export function draftOfInjuryCase(item: InjuryCase, standardAccountId: string | null): InjuryCaseDraft {
  let payer: CasePayerChoice = 'account';
  if (!item.payerAccountId) payer = 'patient';
  else if (item.payerAccountId === standardAccountId) payer = 'standard';
  else if (item.payerAccountId === item.employerAccountId) payer = 'employer';
  return {
    type: item.type,
    injuryDate: item.injuryDate,
    employerAccountId: item.employerAccountId ?? '',
    employerName: item.employerName ?? '',
    employeeNumber: item.employeeNumber ?? '',
    claimNumber: item.claimNumber ?? '',
    payer,
    payerAccountId: payer === 'account' ? item.payerAccountId ?? '' : '',
    notes: item.notes ?? '',
    closed: Boolean(item.closedAt)
  };
}

/** What save_injury_case receives */
export interface InjuryCasePayload {
  case_type: InjuryCaseType;
  injury_date: string;
  employer_account_id: string | null;
  employer_name: string | null;
  employee_number: string | null;
  claim_number: string | null;
  payer: CasePayerChoice;
  payer_account_id: string | null;
  notes: string | null;
  closed: boolean;
}

export type InjuryCaseCheck =
  | { ok: true; value: InjuryCasePayload }
  | { ok: false; errors: Partial<Record<InjuryCaseField, string>> };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function validateInjuryCaseDraft(draft: InjuryCaseDraft, todayKey: string): InjuryCaseCheck {
  const errors: Partial<Record<InjuryCaseField, string>> = {};
  const oneLine = (value: string): string => value.trim().replace(/\s+/g, ' ');
  if (!DATE_KEY.test(draft.injuryDate)) errors.injuryDate = 'Enter the date';
  else if (draft.injuryDate > todayKey) errors.injuryDate = 'The date cannot be in the future';
  const employerName = draft.employerAccountId ? '' : oneLine(draft.employerName);
  if (employerName.length > 120) errors.employerName = "The employer's name is too long (at most 120 characters)";
  else if (employerName.length === 1) errors.employerName = "Give the employer's full name";
  if (needsEmployer(draft.type) && !draft.employerAccountId && !employerName) {
    errors.employerName = "Name the employer: the Employees' Compensation Fund pays a case with the employer's report";
  }
  const employee = referenceNumberProblem(draft.employeeNumber, 'The employee number');
  if (employee) errors.employeeNumber = employee;
  const claim = referenceNumberProblem(draft.claimNumber, 'The claim number');
  if (claim) errors.claimNumber = claim;
  if (draft.notes.trim().length > 1000) errors.notes = 'The notes are too long (at most 1,000 characters)';
  if (draft.payer === 'employer' && !draft.employerAccountId) {
    errors.payer = "The employer pays only when it is one of the practice's company accounts: choose it as the employer";
  }
  if (draft.payer === 'account' && !draft.payerAccountId) errors.payer = 'Choose the account that pays';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      case_type: draft.type,
      injury_date: draft.injuryDate,
      employer_account_id: draft.employerAccountId || null,
      employer_name: employerName || null,
      employee_number: oneLine(draft.employeeNumber) || null,
      claim_number: oneLine(draft.claimNumber) || null,
      payer: draft.payer,
      payer_account_id: draft.payer === 'account' ? draft.payerAccountId : null,
      notes: draft.notes.trim() || null,
      closed: draft.closed
    }
  };
}
