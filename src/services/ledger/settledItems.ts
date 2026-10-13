import type { ArInvoiceBalance, ArReceipt } from './arModel';
import type { StatementInput, StatementInvoice } from './arStatement';

// ---------------------------------------------------------------------------------------------
// Leaving settled items off a statement (parity D26; Eminance hides fully allocated debits and
// credits of equal value). An invoice nothing is owed on goes, with everything that settled it:
// its payments, credit notes, discounts, write-offs and corrections. A payment from the account's
// own patients goes only when all of it went to such invoices of this account and nothing of it is
// left as credit; a payment that also paid an open invoice (or another account's) keeps every
// invoice it touched on the statement. So what is left off always adds up to nothing: the running
// balance and the closing balance are what they would have been. Nothing is deleted; the statement
// just leaves it out.
// ---------------------------------------------------------------------------------------------

type Balance = Pick<ArInvoiceBalance, 'outstanding' | 'hasEntries' | 'hasActivity'>;

/**
 * The invoices that are settled: nothing owed on either portion after entries (an invoice that only
 * follows its status, marked paid before receipts, is not: its statement line has nothing against
 * it). A cancelled invoice bills nothing and is settled when nothing on it still stands.
 */
export function settledInvoiceIds(invoices: readonly Pick<StatementInvoice, 'id' | 'cancelled'>[], balances: Readonly<Record<string, Balance | undefined>>): Set<string> {
  const settled = new Set<string>();
  for (const invoice of invoices) {
    const balance = balances[invoice.id];
    if (!balance) continue;
    if (invoice.cancelled ? !balance.hasActivity : balance.hasEntries && balance.outstanding.medical_aid === 0 && balance.outstanding.patient === 0) {
      settled.add(invoice.id);
    }
  }
  return settled;
}

export interface SettledResult {
  /** The statement's entries without the settled ones */
  input: StatementInput;
  /** How many invoices were left off */
  invoicesLeftOff: number;
}

/** The statement's entries with settled invoices (settledInvoiceIds) and what settled them left out */
export function leaveSettledOff(input: StatementInput, settled: ReadonlySet<string>, receiptCredit: (receipt: ArReceipt) => number = receipt => receipt.unallocatedCents): SettledResult {
  const accountPatients = new Set([input.patientId, ...(input.memberIds ?? [])]);
  const invoiceIds = new Set(input.invoices.map(invoice => invoice.id));
  const own = new Map(input.receipts.filter(receipt => !!receipt.patientId && accountPatients.has(receipt.patientId)).map(receipt => [receipt.id, receipt]));

  // Invoices and the account's own payments that share an allocation belong together
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let root = key;
    while (parent.has(root) && parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(key, root);
    return root;
  };
  const join = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };
  input.invoices.forEach(invoice => find(`i:${invoice.id}`));
  own.forEach((_receipt, id) => find(`r:${id}`));

  // A group stays when anything in it is still open
  const open = new Set<string>();
  for (const invoice of input.invoices) if (!settled.has(invoice.id)) open.add(`i:${invoice.id}`);
  for (const [id, receipt] of own) if (receiptCredit(receipt) !== 0) open.add(`r:${id}`);
  for (const allocation of input.allocations) {
    if (!own.has(allocation.receiptId)) continue;
    if (invoiceIds.has(allocation.invoiceId)) join(`i:${allocation.invoiceId}`, `r:${allocation.receiptId}`);
    else open.add(`r:${allocation.receiptId}`);
  }
  const openRoots = new Set([...open].map(find));
  const leftOff = (key: string): boolean => !openRoots.has(find(key));

  const invoices = input.invoices.filter(invoice => !leftOff(`i:${invoice.id}`));
  const keptInvoiceIds = new Set(invoices.map(invoice => invoice.id));
  const goneReceipts = new Set([...own.keys()].filter(id => leftOff(`r:${id}`)));
  return {
    input: {
      ...input,
      invoices,
      receipts: input.receipts.filter(receipt => !goneReceipts.has(receipt.id)),
      allocations: input.allocations.filter(allocation => !goneReceipts.has(allocation.receiptId) && (keptInvoiceIds.has(allocation.invoiceId) || !invoiceIds.has(allocation.invoiceId))),
      adjustments: input.adjustments.filter(adjustment => (adjustment.invoiceId ? keptInvoiceIds.has(adjustment.invoiceId) || !invoiceIds.has(adjustment.invoiceId) : !(adjustment.receiptId && goneReceipts.has(adjustment.receiptId))))
    },
    invoicesLeftOff: input.invoices.length - invoices.length
  };
}
