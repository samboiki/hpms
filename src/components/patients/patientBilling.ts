/**
 * Patient account maths for the Billing tab and the Overview balance link.
 *
 * Same rules as the Finance page (financialKpiService): "paid" comes from payment_status; a missing
 * or unrecognised status counts as pending; money is owed on pending and overdue invoices;
 * cancelled invoices are void (neither billed nor owed). Once receipts are in use
 * (proposals/2026-10-07-receipts-and-allocations.sql), an invoice with entries owes its ledger
 * balance instead (part payments, credit notes, write-offs).
 */

export type PatientInvoiceStatus = 'paid' | 'pending' | 'overdue' | 'cancelled';

/** The invoices_enhanced columns the patient Billing tab reads */
export interface PatientInvoiceRecord {
  id: string;
  invoice_number?: string | null;
  visit_id?: string | null;
  practice_id?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  created_at?: string | null;
  total?: number | string | null;
  medical_aid_total?: number | string | null;
  patient_total?: number | string | null;
  payment_status?: string | null;
  payment_method?: string | null;
}

export interface PatientInvoice {
  id: string;
  invoiceNumber: string | null;
  visitId: string | null;
  /** Issue date, falling back to when the invoice row was created */
  date: string | null;
  dueDate: string | null;
  createdAt: string | null;
  total: number;
  medicalAidPortion: number;
  patientPortion: number;
  status: PatientInvoiceStatus;
  /** Receipts set payment_status 'partial': money received, something still owed (status stays 'pending') */
  partPaid: boolean;
  paymentMethod: string | null;
}

/**
 * An invoice's ledger balance once receipts are in use (ar_invoice_balances), in N$. With entries,
 * it, not the status, says what is owed: part payments, credit notes and write-offs count.
 */
export interface PatientLedgerBalance {
  outstandingMedicalAid: number;
  outstandingPatient: number;
  /** Money received against the invoice */
  paid: number;
  hasEntries: boolean;
}

export interface PatientAccountSummary {
  /** Invoices that count (cancelled excluded) */
  invoiceCount: number;
  totalBilled: number;
  totalPaid: number;
  /** Still owed: pending + overdue */
  balanceDue: number;
  balanceDueMedicalAid: number;
  balanceDuePatient: number;
  outstandingCount: number;
  overdueCount: number;
}

/** Numeric columns can arrive as numbers or numeric strings; anything unreadable counts as 0. */
export const toAmount = (value: number | string | null | undefined): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCents = (value: number): number => Math.round(value * 100) / 100;

export const normalizeInvoiceStatus = (status: string | null | undefined): PatientInvoiceStatus => {
  const normalized = status?.trim().toLowerCase();
  return normalized === 'paid' || normalized === 'overdue' || normalized === 'cancelled' ? normalized : 'pending';
};

export const isOutstandingInvoice = (status: PatientInvoiceStatus): boolean =>
  status === 'pending' || status === 'overdue';

export function toPatientInvoice(row: PatientInvoiceRecord): PatientInvoice {
  const total = toAmount(row.total);
  const medicalAidPortion = toAmount(row.medical_aid_total);
  // When the patient share was not stored, the patient owes whatever medical aid does not cover
  // (the same rule the invoice PDF uses).
  const hasPatientTotal = row.patient_total !== null && row.patient_total !== undefined && row.patient_total !== '';
  const patientPortion = hasPatientTotal ? toAmount(row.patient_total) : Math.max(total - medicalAidPortion, 0);
  return {
    id: row.id,
    invoiceNumber: row.invoice_number?.trim() || null,
    visitId: row.visit_id || null,
    date: row.issue_date || row.created_at || null,
    dueDate: row.due_date || null,
    createdAt: row.created_at || null,
    total: roundCents(total),
    medicalAidPortion: roundCents(medicalAidPortion),
    patientPortion: roundCents(patientPortion),
    status: normalizeInvoiceStatus(row.payment_status),
    partPaid: row.payment_status?.trim().toLowerCase() === 'partial',
    paymentMethod: row.payment_method?.trim() || null
  };
}

/**
 * Account totals. Without `balances` (receipts not in use) an invoice is owed in full until it is
 * marked paid. With them, an invoice that has entries owes what its ledger balance says, so a part
 * payment lowers the balance due straight away.
 */
export function summarizePatientInvoices(invoices: PatientInvoice[], balances?: Readonly<Record<string, PatientLedgerBalance>>): PatientAccountSummary {
  const counted = invoices.filter((invoice) => invoice.status !== 'cancelled');
  const sum = (rows: PatientInvoice[], pick: (invoice: PatientInvoice) => number) =>
    roundCents(rows.reduce((total, invoice) => total + pick(invoice), 0));
  const ledger = (invoice: PatientInvoice) => (balances?.[invoice.id]?.hasEntries ? balances[invoice.id] : undefined);
  const owedMedicalAid = (invoice: PatientInvoice) => {
    const balance = ledger(invoice);
    if (balance) return Math.max(balance.outstandingMedicalAid, 0);
    return isOutstandingInvoice(invoice.status) ? invoice.medicalAidPortion : 0;
  };
  const owedPatient = (invoice: PatientInvoice) => {
    const balance = ledger(invoice);
    if (balance) return Math.max(balance.outstandingPatient, 0);
    return isOutstandingInvoice(invoice.status) ? invoice.patientPortion : 0;
  };
  const owed = (invoice: PatientInvoice) => owedMedicalAid(invoice) + owedPatient(invoice);
  const paid = (invoice: PatientInvoice) => ledger(invoice)?.paid ?? (invoice.status === 'paid' ? invoice.total : 0);
  const outstanding = balances
    ? counted.filter((invoice) => owed(invoice) > 0)
    : counted.filter((invoice) => isOutstandingInvoice(invoice.status));

  return {
    invoiceCount: counted.length,
    totalBilled: sum(counted, (invoice) => invoice.total),
    totalPaid: sum(counted, paid),
    balanceDue: balances ? sum(outstanding, owed) : sum(outstanding, (invoice) => invoice.total),
    balanceDueMedicalAid: balances ? sum(outstanding, owedMedicalAid) : sum(outstanding, (invoice) => invoice.medicalAidPortion),
    balanceDuePatient: balances ? sum(outstanding, owedPatient) : sum(outstanding, (invoice) => invoice.patientPortion),
    outstandingCount: outstanding.length,
    overdueCount: outstanding.filter((invoice) => invoice.status === 'overdue').length
  };
}

/** "N$1,250.00" */
export const formatNamibianDollars = (amount: number): string =>
  `N$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
