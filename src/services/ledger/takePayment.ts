import { owedPortions } from './arBalances';
import type { ArInvoiceBalance } from './arModel';
import type { LedgerInvoice } from './invoices';

// ---------------------------------------------------------------------------------------------
// "Invoice and take payment" on the visit's Billing tab: what the patient is asked for at the desk
// straight after the invoice is saved. The rule is the one every screen uses (owedPortions): an
// invoice with entries owes its ledger balance, one without follows its status. Only the patient
// portion: the medical aid's part is claimed from the fund, never asked of the patient.
// ---------------------------------------------------------------------------------------------

/** What the patient owes now on one invoice, in cents: 0 for a fund-only, paid or cancelled invoice */
export const patientOwesNowCents = (
  invoice: LedgerInvoice,
  balance?: Pick<ArInvoiceBalance, 'outstanding' | 'hasEntries'>
): number => owedPortions(invoice, balance).patient;
