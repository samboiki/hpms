/**
 * "Invoice and take payment" on the visit's Billing tab: the amount Receive payment starts with is
 * what the patient owes now on that invoice. Getting it wrong either asks a patient for the medical
 * aid's money at the desk or lets them leave without paying their part. Amounts are cents.
 */
import { describe, it, expect } from 'vitest';
import { normalizeInvoiceBalance, patientOwesNowCents } from '../ledgerService';
import { invoice } from './ledgerTestUtils';

describe('what the patient is asked for after "Invoice and take payment"', () => {
  it('asks a private patient for the whole invoice: nobody else pays it', () => {
    expect(patientOwesNowCents(invoice({ total: 450, medicalAidTotal: 0, patientTotal: 450 }))).toBe(45000);
  });

  it('asks a medical aid patient only for the co-payment: the fund is claimed for the rest', () => {
    expect(patientOwesNowCents(invoice({ total: 500, medicalAidTotal: 450, patientTotal: 50 }))).toBe(5000);
  });

  it('asks nothing when the medical aid pays the whole invoice, so the desk never takes the fund\'s part from the patient', () => {
    expect(patientOwesNowCents(invoice({ total: 500, medicalAidTotal: 500, patientTotal: 0 }))).toBe(0);
  });

  it('asks only what is left once part was paid: the ledger balance, not the invoice total', () => {
    const balance = normalizeInvoiceBalance({ invoice_id: 'inv-part', patient_outstanding: '120.00', medical_aid_outstanding: '0', has_entries: true });
    expect(patientOwesNowCents(invoice({ id: 'inv-part', total: 450, patientTotal: 450 }), balance)).toBe(12000);
  });

  it('asks nothing on an invoice already marked paid or cancelled', () => {
    expect(patientOwesNowCents(invoice({ total: 300, status: 'paid', rawStatus: 'paid' }))).toBe(0);
    expect(patientOwesNowCents(invoice({ total: 300, status: 'cancelled', rawStatus: 'cancelled' }))).toBe(0);
  });

  it('never asks for a negative amount when the patient overpaid: the extra is credit on the account', () => {
    const balance = normalizeInvoiceBalance({ invoice_id: 'inv-over', patient_outstanding: '-20.00', medical_aid_outstanding: '0', has_entries: true });
    expect(patientOwesNowCents(invoice({ id: 'inv-over', total: 100, patientTotal: 100 }), balance)).toBe(0);
  });
});
