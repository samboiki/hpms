/**
 * The printed credit note (parity D24). It goes to the patient and, for a claimed line, explains the fund's reversal:
 * it must look like the invoice it corrects (the same letterhead, patient, fund and practitioner blocks), name that
 * invoice, list exactly the lines credited with their codes, say why, and never carry the invoice's "pay with
 * reference" line (nobody pays a credit note). Invented practice and people only.
 */
import { describe, expect, it } from 'vitest';
import { buildCreditNoteDocument, type CreditNoteDocumentInput } from '../creditNoteDocument';
import type { InvoiceDocumentInput } from '../invoiceDocument';
import { renderInvoicePdf } from '../invoicePdf';

const invoice: InvoiceDocumentInput = {
  invoice: { id: 'inv-1', invoiceNumber: 'INV-000123', issueDate: '2026-10-07', dueDate: '2026-11-06', paymentStatus: 'pending', practitionerId: 'doc-1' },
  practice: {
    id: 'p1',
    name: 'Example Family Practice',
    contactPhone: '061 000 000',
    contactEmail: 'desk@example.na',
    address: '1 Example Street',
    city: 'Windhoek',
    country: 'Namibia',
    postalCode: '9000',
    practiceNumber: '0540000001',
    licenseNumber: null,
    taxNumber: null,
    primaryColor: '#30b4be',
    bankName: 'Example Bank',
    accountNumber: '00000000000',
    branchCode: '280172',
    practiceType: 'general practice'
  },
  patient: { firstName: 'Test', lastName: 'Example', dateOfBirth: '1990-04-02', phone: null, email: null },
  medicalAid: { fundName: 'Namibia Medical Care', fundReference: 'NMC1', membershipNumber: '123456789', planOption: null, mainMemberName: null, relationshipToMain: 'self', dependantCode: null },
  visit: { date: '2026-10-07', practitionerId: 'doc-1' },
  practitioners: [{ id: 'doc-1', fullName: 'Anna Tester', role: 'doctor', hpcnaNumber: 'MP00001' }],
  lines: [
    { id: 'l1', serviceDate: '2026-10-07', code: '0190', description: 'Consultation', icd10: ['J06.9'], teeth: [], quantity: 1, unitPrice: 450, discount: 0, total: 450, medicalAid: 450, patient: 0, practitionerId: null },
    { id: 'l2', serviceDate: '2026-10-07', code: '0201', description: 'Material', icd10: ['J06.9'], teeth: [], quantity: 1, unitPrice: 80, discount: 0, total: 80, medicalAid: 80, patient: 0, practitionerId: null }
  ],
  offBenchmarkCodes: []
};

const input = (overrides: Partial<CreditNoteDocumentInput> = {}): CreditNoteDocumentInput => ({
  invoice,
  creditNote: { number: 'CN-000007', portion: 'medical_aid', amountCents: 8000, reason: 'Material billed by mistake', issuedOn: '2026-10-09', reversed: null },
  lines: [{ invoiceLineId: 'l2', code: '0201', description: 'Material', serviceDate: '2026-10-07', tooth: null, quantity: 1, unitPriceCents: 8000, amountCents: 8000 }],
  fundNotes: ['The fund is told with a reversal in its next credit file (not sent yet).'],
  ...overrides
});

describe('the printed credit note', () => {
  it('is titled and numbered as a credit note and names the invoice it credits', () => {
    const doc = buildCreditNoteDocument(input());
    expect(doc.title).toBe('CREDIT NOTE');
    expect(doc.number).toBe('CN-000007');
    expect(doc.meta).toEqual(['Date: 9 Oct 2026', 'For invoice INV-000123']);
    expect(doc.fileName).toBe('credit-note-CN-000007.pdf');
  });

  it("keeps the invoice's letterhead, patient, fund and practitioner blocks", () => {
    const doc = buildCreditNoteDocument(input());
    expect(doc.practiceName).toBe('Example Family Practice');
    expect(doc.blocks.map(block => block.heading)).toEqual(['Patient', 'Medical aid', 'Treating practitioner']);
  });

  it('lists only the lines credited, with their ICD-10 codes, the total, the reason and what the fund is told', () => {
    const doc = buildCreditNoteDocument(input());
    expect(doc.rows).toEqual([expect.objectContaining({ code: '0201', icd10: 'J06.9', total: 'N$ 80.00', unitPrice: 'N$ 80.00' })]);
    expect(doc.totals).toEqual([{ label: 'Credited to the medical aid', value: 'N$ 80.00', bold: true }]);
    expect(doc.statements).toEqual(expect.arrayContaining(['Reason: Material billed by mistake', 'The fund is told with a reversal in its next credit file (not sent yet).']));
  });

  it('never asks for payment', () => {
    const doc = buildCreditNoteDocument(input());
    expect(doc.footerRight).toEqual(['Credits invoice INV-000123']);
    expect(doc.footerRight.join(' ')).not.toMatch(/Pay with reference/);
  });

  it('prints one line for a credit note on a whole portion, and says when it was reversed', () => {
    const doc = buildCreditNoteDocument(input({
      lines: [],
      creditNote: { number: 'CN-000008', portion: 'patient', amountCents: 5000, reason: 'Courtesy', issuedOn: '2026-10-09', reversed: { on: '2026-10-10', reason: 'Issued on the wrong invoice' } }
    }));
    expect(doc.rows).toEqual([expect.objectContaining({ description: 'Credit on what the patient owes on invoice INV-000123', total: 'N$ 50.00' })]);
    expect(doc.statusLabel).toBe('REVERSED');
    expect(doc.statements).toContain('This credit note was reversed on 10 Oct 2026: Issued on the wrong invoice');
  });

  it('draws with the invoice PDF renderer, titled as a credit note', () => {
    const pdf = renderInvoicePdf(buildCreditNoteDocument(input()));
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
