/**
 * Who pays for a visit (parity A14, A19): the patient (and their medical aid, as always), one of the employer accounts
 * the patient is on, or one of the patient's open injury or accident cases (billed to whoever pays for the case). The
 * visit's Billing tab offers only these, and only when there is more than the patient to choose from.
 */
import { caseTitle, casePayerName, casesForVisit, type InjuryCase } from './injuryCases';
import type { PayerAccount, PayerMember, VisitPayer } from './payerAccounts';

export type VisitPayerChoice = { mode: 'patient' } | { mode: 'account'; accountId: string } | { mode: 'case'; caseId: string };

export interface VisitPayerOption {
  /** The select's value: "patient", "account:<id>" or "case:<id>" */
  value: string;
  choice: VisitPayerChoice;
  label: string;
  /** What it means for the invoice, in a sentence */
  detail: string;
}

export const choiceValue = (choice: VisitPayerChoice): string =>
  choice.mode === 'patient' ? 'patient' : choice.mode === 'account' ? `account:${choice.accountId}` : `case:${choice.caseId}`;

export function parseChoice(value: string): VisitPayerChoice {
  if (value.startsWith('account:') && value.length > 8) return { mode: 'account', accountId: value.slice(8) };
  if (value.startsWith('case:') && value.length > 5) return { mode: 'case', caseId: value.slice(5) };
  return { mode: 'patient' };
}

/** The visit's payer as stored, as a choice (a case wins: its payer follows the case) */
export function choiceOfVisit(row: VisitPayer | null): VisitPayerChoice {
  if (!row) return { mode: 'patient' };
  if (row.caseId) return { mode: 'case', caseId: row.caseId };
  if (row.accountId) return { mode: 'account', accountId: row.accountId };
  return { mode: 'patient' };
}

export const sameChoice = (a: VisitPayerChoice, b: VisitPayerChoice): boolean => choiceValue(a) === choiceValue(b);

/**
 * The choices for a visit: the patient, the open employer accounts the patient is on, the patient's open cases. The
 * current choice is always offered (even a closed case or account, so the screen shows what is saved).
 */
export function visitPayerOptions(input: {
  accounts: readonly PayerAccount[];
  members: readonly PayerMember[];
  cases: readonly InjuryCase[];
  current: VisitPayerChoice;
}): VisitPayerOption[] {
  const names = Object.fromEntries(input.accounts.map(account => [account.id, account.name]));
  const options: VisitPayerOption[] = [
    { value: 'patient', choice: { mode: 'patient' }, label: 'The patient', detail: 'Billed to the patient and claimed from their medical aid as usual.' }
  ];
  const memberOf = new Set(input.members.filter(member => !member.unlinkedAt).map(member => member.accountId));
  for (const account of input.accounts) {
    const isCurrent = input.current.mode === 'account' && input.current.accountId === account.id;
    if (!isCurrent && (account.closedAt || !memberOf.has(account.id))) continue;
    if (account.kind !== 'employer' && account.kind !== 'other') continue;
    options.push({
      value: `account:${account.id}`,
      choice: { mode: 'account', accountId: account.id },
      label: account.name,
      detail: `Billed to ${account.name}. The medical aid is not claimed.`
    });
  }
  const open = casesForVisit(input.cases);
  const current = input.current.mode === 'case' ? input.cases.find(item => item.id === (input.current as { caseId: string }).caseId) : undefined;
  for (const item of current && !open.includes(current) ? [current, ...open] : open) {
    const payer = casePayerName(item, names);
    options.push({
      value: `case:${item.id}`,
      choice: { mode: 'case', caseId: item.id },
      label: caseTitle(item),
      detail: item.payerAccountId ? `Billed to ${payer} under the case. The medical aid is not claimed.` : 'The patient pays this case: billed to the patient and their medical aid.'
    });
  }
  return options;
}

/** Whether a choice bills an account (so the invoice is private: nothing claimed from the medical aid) */
export function billsAccount(choice: VisitPayerChoice, cases: readonly InjuryCase[]): boolean {
  if (choice.mode === 'account') return true;
  if (choice.mode === 'case') return Boolean(cases.find(item => item.id === choice.caseId)?.payerAccountId);
  return false;
}

/** What set_visit_payer receives */
export function visitPayerPayload(choice: VisitPayerChoice, reason?: string): Record<string, string> {
  const base: Record<string, string> = choice.mode === 'patient' ? { mode: 'patient' } : choice.mode === 'account' ? { mode: 'account', account_id: choice.accountId } : { mode: 'case', case_id: choice.caseId };
  const why = reason?.trim();
  return why ? { ...base, reason: why } : base;
}
