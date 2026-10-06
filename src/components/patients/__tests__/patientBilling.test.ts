import { describe, it, expect } from 'vitest';
import {
  formatNamibianDollars,
  normalizeInvoiceStatus,
  summarizePatientInvoices,
  toPatientInvoice,
  type PatientInvoiceRecord
} from '../patientBilling';

const row = (overrides: Partial<PatientInvoiceRecord>): PatientInvoiceRecord => ({
  id: overrides.id ?? 'inv',
  invoice_number: 'INV-1',
  total: 0,
  medical_aid_total: 0,
  patient_total: 0,
  payment_status: 'pending',
  ...overrides
});

// The balance shown on the patient file is what reception asks the patient (or the medical aid)
// to pay. It must agree with the Finance page: only pending and overdue invoices are owed,
// paid ones are settled and cancelled ones never counted.
describe('summarizePatientInvoices', () => {
  const invoices = [
    row({ id: 'a', total: 1000, medical_aid_total: 800, patient_total: 200, payment_status: 'pending' }),
    row({ id: 'b', total: 500, medical_aid_total: 0, patient_total: 500, payment_status: 'overdue' }),
    row({ id: 'c', total: 300, medical_aid_total: 300, patient_total: 0, payment_status: 'paid' }),
    row({ id: 'd', total: 9999, medical_aid_total: 0, patient_total: 9999, payment_status: 'cancelled' })
  ].map(toPatientInvoice);

  it('owes only pending and overdue invoices', () => {
    const summary = summarizePatientInvoices(invoices);
    expect(summary.balanceDue).toBe(1500);
    expect(summary.outstandingCount).toBe(2);
    expect(summary.overdueCount).toBe(1);
  });

  it('splits the balance between the medical aid and the patient', () => {
    const summary = summarizePatientInvoices(invoices);
    expect(summary.balanceDueMedicalAid).toBe(800);
    expect(summary.balanceDuePatient).toBe(700);
    expect(summary.balanceDueMedicalAid + summary.balanceDuePatient).toBe(summary.balanceDue);
  });

  it('leaves cancelled invoices out of billed totals', () => {
    const summary = summarizePatientInvoices(invoices);
    expect(summary.invoiceCount).toBe(3);
    expect(summary.totalBilled).toBe(1800);
    expect(summary.totalPaid).toBe(300);
  });

  it('reports a zero balance when everything is paid', () => {
    const summary = summarizePatientInvoices([toPatientInvoice(row({ total: 250, payment_status: 'paid' }))]);
    expect(summary.balanceDue).toBe(0);
    expect(summary.outstandingCount).toBe(0);
  });

  it('adds money without floating point drift', () => {
    const cents = [0.1, 0.2, 0.7].map((total, index) =>
      toPatientInvoice(row({ id: `x${index}`, total, patient_total: total }))
    );
    expect(summarizePatientInvoices(cents).balanceDue).toBe(1);
  });
});

describe('toPatientInvoice', () => {
  it('treats a missing or unknown status as still owed (pending), like the Finance page', () => {
    expect(toPatientInvoice(row({ payment_status: null })).status).toBe('pending');
    expect(toPatientInvoice(row({ payment_status: 'sent' })).status).toBe('pending');
    expect(normalizeInvoiceStatus(' Paid ')).toBe('paid');
  });

  it('reads amounts stored as numeric strings', () => {
    const invoice = toPatientInvoice(row({ total: '1250.50', medical_aid_total: '1000', patient_total: '250.5' }));
    expect(invoice.total).toBe(1250.5);
    expect(invoice.medicalAidPortion).toBe(1000);
    expect(invoice.patientPortion).toBe(250.5);
  });

  it('infers the patient share from the total when it was not stored', () => {
    const invoice = toPatientInvoice(row({ total: 900, medical_aid_total: 600, patient_total: null }));
    expect(invoice.patientPortion).toBe(300);
    // No medical aid recorded: the patient owes everything
    expect(toPatientInvoice(row({ total: 450, medical_aid_total: null, patient_total: null })).patientPortion).toBe(450);
  });

  it('dates the invoice by issue date, falling back to when it was created', () => {
    expect(toPatientInvoice(row({ issue_date: '2026-09-01', created_at: '2026-09-02T08:00:00Z' })).date).toBe('2026-09-01');
    expect(toPatientInvoice(row({ issue_date: null, created_at: '2026-09-02T08:00:00Z' })).date).toBe('2026-09-02T08:00:00Z');
  });
});

describe('formatNamibianDollars', () => {
  it('formats amounts as N$ with two decimals and thousands separators', () => {
    expect(formatNamibianDollars(1250)).toBe('N$1,250.00');
    expect(formatNamibianDollars(0)).toBe('N$0.00');
  });
});
