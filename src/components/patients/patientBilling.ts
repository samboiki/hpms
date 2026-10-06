/**
 * Patient account maths for the Billing tab and the Overview balance link.
 *
 * Same rules as the Finance page (financialKpiService): invoices_enhanced has no payments table,
 * so "paid" comes from payment_status; a missing or unrecognised status counts as pending; money is
 * owed on pending and overdue invoices; cancelled invoices are void (neither billed nor owed).
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
  paymentMethod: string | null;
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
    paymentMethod: row.payment_method?.trim() || null
  };
}

export function summarizePatientInvoices(invoices: PatientInvoice[]): PatientAccountSummary {
  const counted = invoices.filter((invoice) => invoice.status !== 'cancelled');
  const outstanding = counted.filter((invoice) => isOutstandingInvoice(invoice.status));
  const sum = (rows: PatientInvoice[], pick: (invoice: PatientInvoice) => number) =>
    roundCents(rows.reduce((total, invoice) => total + pick(invoice), 0));

  return {
    invoiceCount: counted.length,
    totalBilled: sum(counted, (invoice) => invoice.total),
    totalPaid: sum(counted.filter((invoice) => invoice.status === 'paid'), (invoice) => invoice.total),
    balanceDue: sum(outstanding, (invoice) => invoice.total),
    balanceDueMedicalAid: sum(outstanding, (invoice) => invoice.medicalAidPortion),
    balanceDuePatient: sum(outstanding, (invoice) => invoice.patientPortion),
    outstandingCount: outstanding.length,
    overdueCount: outstanding.filter((invoice) => invoice.status === 'overdue').length
  };
}

/** "N$1,250.00" */
export const formatNamibianDollars = (amount: number): string =>
  `N$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
