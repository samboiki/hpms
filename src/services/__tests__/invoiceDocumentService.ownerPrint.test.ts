/**
 * Every invoice PDF of the app (the patient's Billing tab, the visit screen, Finance, emails, the visit documents) is
 * the owner's own invoice design (ownerInvoicePrint.ts; owner, 15 Oct 2026). This checks that what it prints is read
 * from the right records: the practice letterhead with its logo, the patient with the address, the medical aid's short
 * name, the lines in the order they were billed, and VAT only for a VAT-registered practice. Invented data only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Rows = Record<string, unknown>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Rows | Rows[] | null>, orders: [] as Array<[string, string, unknown]> }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let single = false;
      const result = () => {
        const value = db.tables[table] ?? null;
        if (single) return { data: Array.isArray(value) ? value[0] ?? null : value, error: null };
        return { data: Array.isArray(value) ? value : value ? [value] : [], error: null };
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        order: (column: string, options: unknown) => {
          db.orders.push([table, column, options]);
          return builder;
        },
        maybeSingle: () => {
          single = true;
          return builder;
        },
        then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject)
      };
      return builder;
    }
  }
}));
const vat = vi.hoisted(() => ({ registered: false }));
vi.mock('../vatSettingsService', () => ({
  loadItemVatRates: async () => ({
    settings: vat.registered ? { registered: true, vatNumber: '1234567-01-5' } : { registered: false, vatNumber: '' },
    rates: new Map([['stock-frame', 15]])
  })
}));

import { loadOwnerInvoicePrint, withRuleEightDetails } from '../invoiceDocumentService';
import type { InvoiceDocumentInput } from '../../components/billing/invoiceDocument';

beforeEach(() => {
  vat.registered = false;
  db.orders = [];
  db.tables = {
    invoices_enhanced: {
      id: 'invoice-1',
      invoice_number: 'INV-000123',
      practice_id: 'practice-1',
      patient_id: 'patient-1',
      visit_id: 'visit-1',
      created_at: '2026-10-07T09:30:00+02:00',
      due_date: '2026-11-06',
      total: 1670
    },
    invoice_services: [
      { id: 's1', code: '0190', description: 'Consultation', quantity: 1, unit_price: 520, medical_aid_covered: 416, total_price: 520, stock_item_id: null },
      { id: 's2', code: 'FRAME', description: 'Frame', quantity: 1, unit_price: 1150, medical_aid_covered: 0, total_price: 1150, stock_item_id: 'stock-frame' }
    ],
    practices: {
      id: 'practice-1',
      name: 'Example Practice',
      logo_url: 'https://example.test/logo.png',
      address: '12 Example Street',
      city: 'Windhoek',
      country: 'Namibia',
      postal_code: '9000',
      contact_phone: '+264 61 000 0000',
      contact_email: 'reception@example.test',
      domain: 'example.test',
      bank_name: 'Example Bank',
      account_number: '000111222333',
      branch_code: '000000'
    },
    patients: { first_name: 'Anna', last_name: 'Example', cell_number: '+264 81 000 0001', email: 'anna@example.test', home_address: '7 Sample Road' },
    medical_aid_details: [{ provider: 'Example Medical Fund', scheme: 'Example Plus', membership_number: 'EX1234567', medical_aid_provider_id: 'fund-1' }],
    medical_aid_providers: { name: 'Example Medical Fund', short_name: 'EMF' },
    visits: { practice_id: 'practice-2' }
  };
});

describe("what the owner's invoice prints", () => {
  it('reads the letterhead with its logo, the patient with the address, the fund short name and the lines in billing order', async () => {
    const print = await loadOwnerInvoicePrint('invoice-1');

    expect(print).toMatchObject({
      kind: 'invoice',
      invoiceNumber: 'INV-000123',
      createdAt: '2026-10-07T09:30:00+02:00',
      dueDate: '2026-11-06',
      total: 1670,
      vat: null,
      practice: {
        name: 'Example Practice',
        logoUrl: 'https://example.test/logo.png',
        website: 'www.example.test',
        bankName: 'Example Bank',
        accountNumber: '000111222333',
        branchCode: '000000'
      },
      patient: { name: 'Anna Example', phone: '+264 81 000 0001', email: 'anna@example.test', address: '7 Sample Road' },
      medicalAid: { providerName: 'EMF', scheme: 'Example Plus', membershipNumber: 'EX1234567' }
    });
    expect(print.services.map(service => service.code)).toEqual(['0190', 'FRAME']);
    // The order his Billing tab lists them in: as they were billed
    expect(db.orders).toContainEqual(['invoice_services', 'created_at', { ascending: true }]);
  });

  // Owner decision 13 Oct 2026: only a VAT-registered practice issues tax invoices, with VAT on VAT-able stock only
  it('prints VAT only for a VAT-registered practice, on its VAT-able stock lines', async () => {
    expect((await loadOwnerInvoicePrint('invoice-1')).services.map(service => service.vatRate)).toEqual([0, 15]);
    expect((await loadOwnerInvoicePrint('invoice-1')).vat).toBeNull();

    vat.registered = true;
    expect((await loadOwnerInvoicePrint('invoice-1')).vat).toEqual({ vatNumber: '1234567-01-5' });
  });

  it('prints a private patient without a medical aid block', async () => {
    db.tables.medical_aid_details = [];
    expect((await loadOwnerInvoicePrint('invoice-1')).medicalAid).toBeNull();
  });

  it("uses the visit's practice for an older invoice saved without one", async () => {
    db.tables.invoices_enhanced = { ...(db.tables.invoices_enhanced as Rows), practice_id: null };
    await expect(loadOwnerInvoicePrint('invoice-1')).resolves.toMatchObject({ invoiceNumber: 'INV-000123' });
  });

  it('says plainly when the invoice is gone', async () => {
    db.tables.invoices_enhanced = null;
    await expect(loadOwnerInvoicePrint('invoice-1')).rejects.toThrow('The invoice could not be found.');
  });
});

// The owner asked (15 Oct 2026) for NAMAF rule 008's details on his invoice: they come from the rule-008 input, the one
// place that reads them (each line's ICD-10 codes with their fallbacks, the staff list's HPCNA numbers)
describe("the rule-008 details on the owner's invoice", () => {
  const input = {
    invoice: { practitionerId: 'staff-1' },
    visit: { date: '2026-10-07', practitionerId: 'staff-1' },
    practice: { practiceNumber: '0123456' },
    practitioners: [
      { id: 'staff-1', fullName: 'A Example', role: 'doctor', hpcnaNumber: 'MP 00000' },
      { id: 'staff-2', fullName: 'B Example', role: 'doctor', hpcnaNumber: 'MP 11111' },
      { id: 'staff-3', fullName: 'C Example', role: 'nurse', hpcnaNumber: 'NR 22222' }
    ],
    lines: [
      { id: 's1', icd10: ['J06.9'], practitionerId: null },
      { id: 's2', icd10: ['J06.9', 'R50.9'], practitionerId: 'staff-2' }
    ]
  } as unknown as InvoiceDocumentInput;

  it('adds the practice number, the treating practitioners and each line\'s ICD-10 codes', async () => {
    const print = withRuleEightDetails(await loadOwnerInvoicePrint('invoice-1'), {
      ...input,
      lines: [
        { ...input.lines[0], id: 's1' },
        { ...input.lines[1], id: 's2' }
      ]
    } as InvoiceDocumentInput);

    expect(print.practice.practiceNumber).toBe('0123456');
    // The invoice's practitioner first, then the partner who treated a line; a colleague who treated nothing is left out
    expect(print.practitioners).toEqual([
      { name: expect.stringContaining('A Example'), hpcnaNumber: 'MP 00000' },
      { name: expect.stringContaining('B Example'), hpcnaNumber: 'MP 11111' }
    ]);
    expect(print.services.map(service => service.icd10)).toEqual([['J06.9'], ['J06.9', 'R50.9']]);
  });

  it('gives a line it cannot match no codes rather than another line\'s', async () => {
    const print = withRuleEightDetails(await loadOwnerInvoicePrint('invoice-1'), { ...input, lines: [] } as unknown as InvoiceDocumentInput);
    expect(print.services.map(service => service.icd10)).toEqual([[], []]);
  });
});
