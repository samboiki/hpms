import { formatNad, fromCents } from '../../../utils/billing/money';
import type { CreditLimitStatus, EffectiveFlag } from '../../../services/ledgerService';
import { patientAccountLink } from '../../billing/invoiceLinks';

/**
 * The patient file, opened on its Account tab, where the account lives (links both ways between family members). The
 * Billing tab next to it is the owner's invoice table only (owner, 15 Oct 2026). The one Account tab link of the app.
 */
export const patientFileLink = (patientId: string): string => patientAccountLink(patientId);

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
