/**
 * Invoices per fund for a day or a period (parity R18): each medical aid's invoices with their portions and where each
 * claim stands, to check a day's claims fund by fund and print them.
 *
 * An invoice's fund is the fund it was claimed from when it is in a claim batch (the batch's fund code), else the
 * medical aid recorded on the patient; patients without one are the private list. Fund codes and names are matched
 * through identifyFund (MAG1 = PSEMAS), so a fund never shows twice. Cancelled invoices bill nothing and are left out.
 */
import { PRIVATE_FUND, invoiceDateKey, isInRange, isRevenueInvoice, splitCents, type DateRange, type LedgerInvoice } from '../../../services/ledgerService';
import { identifyFund } from '../../../utils/remittance/funds';
import type { CsvCell } from '../financeExport';
import type { LinkedReport } from './reportTargets';

/** A claim batch as the report needs it */
export interface BatchInfo {
  id: string;
  number: number | null;
  sentAt: string | null;
  fundReference: string | null;
}

export type ClaimState = 'nothing_to_claim' | 'not_batched' | 'in_batch' | 'sent';

export const CLAIM_STATE_LABELS: Record<ClaimState, string> = {
  nothing_to_claim: 'Nothing for the fund',
  not_batched: 'Not in a claim batch',
  in_batch: 'In a batch, not sent',
  sent: 'Sent to the fund'
};

export interface FundInvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  dateKey: string;
  patientId: string | null;
  fundKey: string;
  fund: string;
  medicalAidCents: number;
  patientCents: number;
  claim: ClaimState;
  batchId: string | null;
  batchNumber: number | null;
}

/** The fund an invoice belongs to: its batch's fund, else the patient's medical aid, else private */
export function fundOfInvoice(
  invoice: Pick<LedgerInvoice, 'patientId' | 'batchId'>,
  schemeByPatient: Readonly<Record<string, string>>,
  batchById: ReadonlyMap<string, BatchInfo>
): { key: string; label: string } {
  const batchFund = invoice.batchId ? batchById.get(invoice.batchId)?.fundReference?.trim() : null;
  const provider = invoice.patientId ? schemeByPatient[invoice.patientId]?.trim() : null;
  const known = identifyFund(batchFund, provider);
  if (known) return { key: known.code, label: known.label };
  const named = batchFund || provider;
  return named ? { key: named.toUpperCase(), label: named } : { key: PRIVATE_FUND, label: PRIVATE_FUND };
}

export interface InvoicesPerFundInput {
  invoices: readonly LedgerInvoice[];
  range: DateRange;
  schemeByPatient: Readonly<Record<string, string>>;
  batchById: ReadonlyMap<string, BatchInfo>;
}

/** The period's uncancelled invoices with their fund and claim state, oldest first */
export function invoicesPerFund({ invoices, range, schemeByPatient, batchById }: InvoicesPerFundInput): FundInvoiceRow[] {
  const rows: FundInvoiceRow[] = [];
  for (const invoice of invoices) {
    const dateKey = invoiceDateKey(invoice);
    if (!dateKey || !isRevenueInvoice(invoice) || !isInRange(dateKey, range)) continue;
    const split = splitCents(invoice);
    const fund = fundOfInvoice(invoice, schemeByPatient, batchById);
    const batch = invoice.batchId ? batchById.get(invoice.batchId) ?? null : null;
    const claim: ClaimState = split.medicalAidCents <= 0 ? 'nothing_to_claim' : !invoice.batchId ? 'not_batched' : batch?.sentAt ? 'sent' : 'in_batch';
    rows.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      dateKey,
      patientId: invoice.patientId,
      fundKey: fund.key,
      fund: fund.label,
      medicalAidCents: split.medicalAidCents,
      patientCents: split.patientCents,
      claim,
      batchId: invoice.batchId,
      batchNumber: batch?.number ?? null
    });
  }
  return rows.sort((a, b) => a.fund.localeCompare(b.fund) || a.dateKey.localeCompare(b.dateKey) || a.invoiceNumber.localeCompare(b.invoiceNumber));
}

export interface FundSummary {
  fundKey: string;
  fund: string;
  invoices: number;
  medicalAidCents: number;
  patientCents: number;
  /** Medical aid portion not sent to the fund yet (not batched or in an unsent batch) */
  notSentCents: number;
  sentCents: number;
}

/** Per fund: invoices, portions and how much of the fund's portion has gone to the fund; private last */
export function fundSummaries(rows: readonly FundInvoiceRow[]): FundSummary[] {
  const funds = new Map<string, FundSummary>();
  for (const row of rows) {
    const fund = funds.get(row.fundKey) ?? { fundKey: row.fundKey, fund: row.fund, invoices: 0, medicalAidCents: 0, patientCents: 0, notSentCents: 0, sentCents: 0 };
    fund.invoices += 1;
    fund.medicalAidCents += row.medicalAidCents;
    fund.patientCents += row.patientCents;
    if (row.claim === 'sent') fund.sentCents += row.medicalAidCents;
    else if (row.claim !== 'nothing_to_claim') fund.notSentCents += row.medicalAidCents;
    funds.set(row.fundKey, fund);
  }
  return [...funds.values()].sort((a, b) => Number(a.fundKey === PRIVATE_FUND) - Number(b.fundKey === PRIVATE_FUND) || b.medicalAidCents - a.medicalAidCents);
}

const amount = (cents: number): number => cents / 100;

export const FUND_INVOICE_NOTES = [
  'An invoice\'s fund is the fund it was claimed from when it is in a claim batch, else the medical aid on the patient\'s file. Cancelled invoices are left out.',
  'Not sent: the fund\'s portion of invoices not in a batch yet or in a batch that has not gone to the fund.'
];

/** One row per fund; a row shows that fund's invoices */
export function fundSummaryTable(summaries: readonly FundSummary[], periodLabel: string): LinkedReport & { keys: string[] } {
  const sum = (pick: (fund: FundSummary) => number) => summaries.reduce((acc, fund) => acc + pick(fund), 0);
  return {
    table: {
      title: 'Invoices per fund',
      basis: `Invoices dated ${periodLabel}`,
      columns: [
        { header: 'Fund', type: 'text' },
        { header: 'Invoices', type: 'count' },
        { header: 'Medical aid', type: 'money' },
        { header: 'Patient', type: 'money' },
        { header: 'Not sent', type: 'money' },
        { header: 'Sent', type: 'money' }
      ],
      rows: summaries.map(fund => [fund.fund, fund.invoices, amount(fund.medicalAidCents), amount(fund.patientCents), amount(fund.notSentCents), amount(fund.sentCents)] as CsvCell[]),
      totals: ['Total', sum(f => f.invoices), amount(sum(f => f.medicalAidCents)), amount(sum(f => f.patientCents)), amount(sum(f => f.notSentCents)), amount(sum(f => f.sentCents))],
      notes: FUND_INVOICE_NOTES
    },
    targets: summaries.map(() => null),
    keys: summaries.map(fund => fund.fundKey)
  };
}

/** One row per invoice (of one fund or all); each opens its invoice */
export function fundInvoiceTable(rows: readonly FundInvoiceRow[], periodLabel: string, patientNames: Readonly<Record<string, string>>, fundLabel: string | null): LinkedReport {
  return {
    table: {
      title: fundLabel ? `Invoices per fund: ${fundLabel}` : 'Invoices per fund: every invoice',
      basis: `Invoices dated ${periodLabel}`,
      columns: [
        { header: 'Fund', type: 'text' },
        { header: 'Day', type: 'date' },
        { header: 'Invoice', type: 'text' },
        { header: 'Patient', type: 'text' },
        { header: 'Medical aid', type: 'money' },
        { header: 'Patient portion', type: 'money' },
        { header: 'Claim', type: 'text' }
      ],
      rows: rows.map(row => [
        row.fund,
        row.dateKey,
        row.invoiceNumber,
        (row.patientId && patientNames[row.patientId]) || 'Unknown patient',
        amount(row.medicalAidCents),
        amount(row.patientCents),
        row.batchNumber !== null && (row.claim === 'sent' || row.claim === 'in_batch') ? `${CLAIM_STATE_LABELS[row.claim]} (batch ${row.batchNumber})` : CLAIM_STATE_LABELS[row.claim]
      ] as CsvCell[]),
      totals: ['Total', '', `${rows.length} invoices`, '', amount(rows.reduce((s, r) => s + r.medicalAidCents, 0)), amount(rows.reduce((s, r) => s + r.patientCents, 0)), ''],
      notes: FUND_INVOICE_NOTES
    },
    targets: rows.map(row => ({ kind: 'invoice' as const, id: row.invoiceId })),
    names: rows.map(row => row.invoiceNumber)
  };
}
