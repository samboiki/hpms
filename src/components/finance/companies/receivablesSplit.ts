/**
 * Who owes the receivables (parity A14, A19): the medical aids, the patients themselves and the company and fund
 * accounts, from the aging report Overview totals. One rule (FinanceWorkspace.payers.byInvoice, the same map every age
 * analysis groups by): an invoice billed to an account is all the account's. The three add up to the receivables total.
 */
import { toCents, type AgingReport } from '../../../services/ledgerService';
import type { PracticePayerData } from '../../../services/payerAccountService';
import { formatNad } from '../financeFormat';

export interface ReceivablesByDebtor {
  medicalAidCents: number;
  /** What the patients owe themselves (accounts' invoices left out) */
  patientCents: number;
  /** What company and fund accounts owe: all of each invoice billed to one */
  accountsCents: number;
  totalCents: number;
}

export function receivablesByDebtor(report: Pick<AgingReport, 'items'>, payers: Pick<PracticePayerData, 'byInvoice'> | undefined): ReceivablesByDebtor {
  const byInvoice = payers?.byInvoice ?? {};
  let medicalAidCents = 0;
  let patientCents = 0;
  let accountsCents = 0;
  for (const item of report.items) {
    if (byInvoice[item.invoice.id]) {
      accountsCents += toCents(item.amount);
    } else {
      medicalAidCents += toCents(item.medicalAid);
      patientCents += toCents(item.patient);
    }
  }
  return { medicalAidCents, patientCents, accountsCents, totalCents: medicalAidCents + patientCents + accountsCents };
}

/**
 * "Medical aids owe N$X; patients owe N$Y." with "; company and fund accounts owe N$Z" before the full stop only when
 * accounts owe something (Overview and the receivables report say the same)
 */
export function whoOwesSentence(split: ReceivablesByDebtor): string {
  const parts = [`Medical aids owe ${formatNad(split.medicalAidCents / 100)}`, `patients owe ${formatNad(split.patientCents / 100)}`];
  if (split.accountsCents !== 0) parts.push(`company and fund accounts owe ${formatNad(split.accountsCents / 100)}`);
  return `${parts.join('; ')}.`;
}
