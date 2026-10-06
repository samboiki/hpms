import { checkClaimDeadline, describeDeadline, getFundRule } from '../../utils/billing/fundRules';
import { fromCents, invoiceDateKey, toCents, UNKNOWN_SCHEME, type AgingReport } from '../../services/ledgerService';
import { isOpenBatch } from './claims/status';

/**
 * Medical aid debtors per fund, split by where each claim stands. Pure: the claim batch states and
 * visit dates are loaded by financeData; batch status and fund deadlines use the claims module's
 * rules (claims/status.ts, utils/billing/fundRules.ts).
 */

/** batch_headers columns read for the batches unpaid invoices belong to */
export interface RawClaimBatchRow {
  id: string;
  status?: string | null;
  sent_at?: string | null;
  medical_aid_reference?: string | null;
}

export interface ClaimBatchState {
  id: string;
  status: string | null;
  sentAt: string | null;
  /** The fund's medical_aid_reference on the batch (e.g. NHPM) */
  fundReference: string | null;
}

export const normalizeClaimBatch = (row: RawClaimBatchRow): ClaimBatchState => ({
  id: row.id,
  status: row.status ?? null,
  sentAt: row.sent_at ?? null,
  fundReference: row.medical_aid_reference?.trim() || null
});

export interface FundDebtorAmounts {
  invoiceCount: number;
  /** In no claim batch yet, still within the fund's deadline (or the deadline is not known) */
  notBatched: number;
  /** In a batch that has not been sent, still within the deadline (or not known) */
  inUnsentBatch: number;
  /** Not sent and past the fund's claim deadline: the fund will refuse it */
  pastDeadline: number;
  /** In a batch sent to the fund, awaiting payment */
  sent: number;
  total: number;
}

export interface FundDebtorRow extends FundDebtorAmounts {
  fund: string;
  /** The fund's claim deadline in words ("4 months"); null when it is not configured */
  deadline: string | null;
}

export interface FundDebtors {
  /** Largest amount owed first */
  rows: FundDebtorRow[];
  totals: FundDebtorAmounts;
  /** Not sent, within the warning window before the deadline */
  expiringSoon: { count: number; amount: number };
  /** Invoices pointing to a batch that could not be read; shown as sent */
  unreadableBatches: { count: number; amount: number };
}

export interface FundDebtorsInput {
  aging: AgingReport;
  /** Medical aid name per patient (medical_aid_details.provider) */
  schemeByPatient: Record<string, string>;
  batches: ClaimBatchState[];
  /** Visit (service) date per visit id */
  serviceDateByVisit: Record<string, string>;
  todayKey: string;
}

type ClaimState = 'notBatched' | 'inUnsentBatch' | 'pastDeadline' | 'sent';

/** Running totals in cents while summing */
interface Group extends FundDebtorAmounts {
  deadline: string | null;
}

const emptyGroup = (): Group => ({ invoiceCount: 0, notBatched: 0, inUnsentBatch: 0, pastDeadline: 0, sent: 0, total: 0, deadline: null });

const toAmounts = (group: Group): FundDebtorAmounts => ({
  invoiceCount: group.invoiceCount,
  notBatched: fromCents(group.notBatched),
  inUnsentBatch: fromCents(group.inUnsentBatch),
  pastDeadline: fromCents(group.pastDeadline),
  sent: fromCents(group.sent),
  total: fromCents(group.total)
});

/**
 * The medical aid portion of every unpaid invoice (from the aging report, so it always adds up to
 * the receivables owed by medical aids), per fund and claim state. A claim that has not been sent
 * is past its deadline only where the fund's deadline is configured; the deadline runs from the
 * visit date, else the invoice date, as on the claims screen.
 */
export function debtorsByFund(input: FundDebtorsInput): FundDebtors {
  const batchById = new Map(input.batches.map(batch => [batch.id, batch]));
  const groups = new Map<string, Group>();
  const totals = emptyGroup();
  const expiringSoon = { count: 0, cents: 0 };
  const unreadable = { count: 0, cents: 0 };

  for (const item of input.aging.items) {
    const cents = toCents(item.medicalAid);
    if (cents <= 0) continue;
    const invoice = item.invoice;
    const fund = (invoice.patientId && input.schemeByPatient[invoice.patientId]) || UNKNOWN_SCHEME;
    const batch = invoice.batchId ? batchById.get(invoice.batchId) : undefined;
    const rule = getFundRule(batch?.fundReference ?? null, fund === UNKNOWN_SCHEME ? null : fund);
    const group = groups.get(fund) ?? emptyGroup();
    groups.set(fund, group);
    if (rule.configured && group.deadline === null) group.deadline = describeDeadline(rule);

    let state: ClaimState;
    if (invoice.batchId && !batch) {
      state = 'sent';
      unreadable.count += 1;
      unreadable.cents += cents;
    } else if (batch && !isOpenBatch({ status: batch.status, sent_at: batch.sentAt })) {
      state = 'sent';
    } else {
      const serviceDate = (invoice.visitId && input.serviceDateByVisit[invoice.visitId]) || invoiceDateKey(invoice);
      const deadline = rule.configured ? checkClaimDeadline(serviceDate, input.todayKey, rule).status : null;
      state = deadline === 'expired' ? 'pastDeadline' : batch ? 'inUnsentBatch' : 'notBatched';
      if (deadline === 'expiring') {
        expiringSoon.count += 1;
        expiringSoon.cents += cents;
      }
    }
    for (const target of [group, totals]) {
      target.invoiceCount += 1;
      target[state] += cents;
      target.total += cents;
    }
  }

  return {
    rows: [...groups.entries()]
      .map(([fund, group]) => ({ fund, deadline: group.deadline, ...toAmounts(group) }))
      .sort((a, b) => b.total - a.total || a.fund.localeCompare(b.fund)),
    totals: toAmounts(totals),
    expiringSoon: { count: expiringSoon.count, amount: fromCents(expiringSoon.cents) },
    unreadableBatches: { count: unreadable.count, amount: fromCents(unreadable.cents) }
  };
}
