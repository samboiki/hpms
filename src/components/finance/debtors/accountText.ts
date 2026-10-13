import { formatNad, fromCents } from '../../../utils/billing/money';
import type { CreditLimitStatus, EffectiveFlag } from '../../../services/ledgerService';

/** The patient file, opened on its Billing tab (links both ways between family members) */
export const patientFileLink = (patientId: string): string => `/patients?${new URLSearchParams({ patientId, tab: 'billing' }).toString()}`;

/** The words of one chip: "Credit limit N$ 2,000.00 (over by N$ 450.00)", the alert text, "Statements in Afrikaans" */
export function flagChipText(flag: EffectiveFlag, creditLimit: CreditLimitStatus | null): string {
  if (flag.kind === 'credit_limit') {
    return creditLimit?.over
      ? `Over credit limit by ${formatNad(fromCents(creditLimit.overCents))}`
      : `Credit limit ${flag.detail ?? ''}`.trim();
  }
  if (flag.kind === 'statement_language') return `Statements in ${flag.detail ?? 'English'}`;
  if (flag.kind === 'alert') return flag.detail ?? flag.label;
  return flag.label;
}
