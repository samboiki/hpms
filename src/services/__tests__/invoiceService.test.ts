import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceSelection } from '../../types/billing';

// A database stand-in that records every write: nothing reaches Supabase
type Call = { table: string; op: string; payload?: unknown };
const { state, calls } = vi.hoisted(() => ({
  state: {
    authUser: { id: 'user-reception', email: 'desk@example.na', user_metadata: {} } as { id: string; email: string; user_metadata: Record<string, unknown> } | null,
    profile: { id: 'user-reception', role: 'receptionist', full_name: 'Front Desk', email: 'desk@example.na', is_active: true, practice_id: 'practice-1' } as Record<string, unknown> | null,
    visit: { id: 'visit-1', visit_date: '2026-10-05', doctor_id: 'doctor-1', practice_id: 'practice-1' } as Record<string, unknown> | null,
    /** Errors returned by successive invoice inserts (then success) */
    insertErrors: [] as Array<{ code: string; message: string } | null>,
    /** What the database stores for the lines (null: as sent) */
    storedLines: null as Array<Record<string, unknown>> | null
  },
  calls: [] as Call[]
}));

vi.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    let op = 'select';
    let payload: unknown;
    const self: Record<string, unknown> = {};
    const result = () => {
      if (table === 'users') return { data: state.profile, error: null };
      if (table === 'visits') return { data: state.visit, error: null };
      if (table === 'invoices_enhanced' && op === 'insert') {
        const error = state.insertErrors.shift() ?? null;
        if (error) return { data: null, error };
        const row = (payload as Array<Record<string, unknown>>)[0];
        return { data: { id: 'invoice-1', issue_date: '2026-10-07', due_date: '2026-11-06', payment_status: 'pending', ...row }, error: null };
      }
      if (table === 'invoices_enhanced') return { data: { id: 'invoice-1', invoice_number: 'INV-000001', total: 500.1, medical_aid_total: 475.09, patient_total: 25.01 }, error: null };
      if (table === 'invoice_services') return { data: state.storedLines ?? payload, error: null };
      return { data: null, error: null };
    };
    Object.assign(self, {
      select: () => self,
      eq: () => self,
      limit: () => self,
      insert: (rows: unknown) => {
        op = 'insert';
        payload = rows;
        calls.push({ table, op, payload: rows });
        return self;
      },
      single: () => Promise.resolve(result()),
      maybeSingle: () => Promise.resolve(result()),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve)
    });
    return self;
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: state.authUser }, error: null }) },
      from: (table: string) => builder(table)
    }
  };
});

const fund = { reference: 'MAG1', planOptions: [] as string[], name: 'PSEMAS' };
const { setup, copay, fundKey } = vi.hoisted(() => ({
  setup: { lineDetails: false, createdBy: false, audit: false },
  copay: { rules: [] as Array<{ fundReference: string; planOption: string | null; percent: number }>, error: null as string | null },
  fundKey: { hasMedicalAid: true as boolean | null, fund: null as unknown, error: null as string | null }
}));
vi.mock('../invoicingSetup', () => ({ loadInvoicingSetup: () => Promise.resolve({ ...setup }) }));
vi.mock('../invoiceContextService', () => ({ loadCopayRules: () => Promise.resolve(copay) }));
vi.mock('../fundPricingService', () => ({ loadPatientFundKey: () => Promise.resolve(fundKey) }));

import { invoiceService } from '../invoiceService';

const line = (overrides: Partial<ServiceSelection> = {}): ServiceSelection => ({
  id: 'line-1',
  tariffId: '11111111-1111-4111-8111-111111111111',
  code: '0190',
  description: 'Consultation',
  category: 'Service',
  unitPrice: 500.1,
  quantity: 1,
  totalPrice: 500.1,
  ...overrides
});

const create = (overrides: Partial<Parameters<typeof invoiceService.createInvoice>[0]> = {}) =>
  invoiceService.createInvoice({ patientId: 'patient-1', visitId: 'visit-1', services: [line()], practiceId: 'practice-1', ...overrides });

const inserted = (table: string) => calls.filter(call => call.table === table && call.op === 'insert');

beforeEach(() => {
  calls.length = 0;
  state.authUser = { id: 'user-reception', email: 'desk@example.na', user_metadata: {} };
  state.profile = { id: 'user-reception', role: 'receptionist', full_name: 'Front Desk', email: 'desk@example.na', is_active: true, practice_id: 'practice-1' };
  state.visit = { id: 'visit-1', visit_date: '2026-10-05', doctor_id: 'doctor-1', practice_id: 'practice-1' };
  state.insertErrors = [];
  state.storedLines = null;
  Object.assign(setup, { lineDetails: false, createdBy: false, audit: false });
  Object.assign(copay, { rules: [], error: null });
  Object.assign(fundKey, { hasMedicalAid: true, fund, error: null });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('who may create an invoice (D1)', () => {
  // Reception bills at the front desk; before this only doctors could
  it('lets a receptionist create the invoice', async () => {
    const invoice = await create();
    expect(invoice.id).toBe('invoice-1');
    expect(inserted('invoices_enhanced')).toHaveLength(1);
  });

  // The fund pays the practitioner who treated: reception raising the invoice must not end up on the claim
  it('records the visit practitioner as the treating practitioner, not whoever raised the invoice', async () => {
    await create();
    expect((inserted('invoices_enhanced')[0].payload as Array<Record<string, unknown>>)[0]).toMatchObject({ practitioner_id: 'doctor-1' });
  });

  it('records a chosen treating practitioner', async () => {
    await create({ practitionerId: 'nurse-7' });
    expect((inserted('invoices_enhanced')[0].payload as Array<Record<string, unknown>>)[0]).toMatchObject({ practitioner_id: 'nurse-7' });
  });

  it('records who raised the invoice once the database has the column', async () => {
    setup.createdBy = true;
    await create();
    expect((inserted('invoices_enhanced')[0].payload as Array<Record<string, unknown>>)[0]).toMatchObject({ created_by: 'user-reception' });
  });

  it('refuses a switched-off account and roles without billing rights, before anything is written', async () => {
    state.profile = { ...state.profile, is_active: false };
    await expect(create()).rejects.toThrow(/switched off/);
    state.profile = { ...state.profile, is_active: true, role: 'patient' };
    await expect(create()).rejects.toThrow(/cannot create invoices/);
    expect(calls).toHaveLength(0);
  });
});

describe('invoice numbers (D11)', () => {
  // A clash used to fail the save; another provisional number is tried instead
  it('tries another number when the first one is already taken', async () => {
    state.insertErrors = [{ code: '23505', message: 'duplicate key value violates unique constraint "invoices_enhanced_invoice_number_key"' }];
    await create();
    const numbers = inserted('invoices_enhanced').map(call => (call.payload as Array<Record<string, unknown>>)[0].invoice_number as string);
    expect(numbers).toHaveLength(2);
    expect(numbers.every(number => /^INV\d{4}\d{5}$/.test(number))).toBe(true);
    expect(inserted('invoice_services')).toHaveLength(1);
  });

  it('reports any other refusal instead of retrying', async () => {
    state.insertErrors = [{ code: '42501', message: 'permission denied for table invoices_enhanced' }];
    await expect(create()).rejects.toThrow(/permission denied/);
    expect(inserted('invoices_enhanced')).toHaveLength(1);
    expect(inserted('invoice_services')).toHaveLength(0);
  });
});

describe('the stored lines', () => {
  // Pricing is money: a line that cannot be priced is refused before the invoice exists
  it('refuses a wrong line before any invoice is written', async () => {
    await expect(create({ services: [line({ totalPrice: 400 })] })).rejects.toThrow(/Invoice not created/);
    expect(calls).toHaveLength(0);
  });

  it('bills a medical aid line to the fund in full without a co-payment, as before', async () => {
    await create();
    expect((inserted('invoice_services')[0].payload as Array<Record<string, unknown>>)[0]).toMatchObject({
      total_price: 500.1,
      medical_aid_covered: 500.1,
      patient_portion: 0
    });
  });

  // D8: the practice's co-payment for the patient's fund splits the line
  it("splits each line by the fund's co-payment", async () => {
    copay.rules = [{ fundReference: 'MAG1', planOption: null, percent: 5 }];
    await create();
    expect((inserted('invoice_services')[0].payload as Array<Record<string, unknown>>)[0]).toMatchObject({
      total_price: 500.1,
      medical_aid_covered: 475.09,
      patient_portion: 25.01
    });
  });

  // Until the invoicing update is applied the database may force the old split: staff must be told, not misled
  it('warns when the database did not keep the co-payment', async () => {
    copay.rules = [{ fundReference: 'MAG1', planOption: null, percent: 5 }];
    state.storedLines = [{ code: '0190', medical_aid_covered: 500.1, patient_portion: 0 }];
    const invoice = await create();
    expect(invoice.warnings).toEqual([expect.stringMatching(/co-payment on 0190 was not kept/)]);
  });

  it("lets a private patient pay the whole line", async () => {
    fundKey.hasMedicalAid = false;
    fundKey.fund = null;
    await create();
    expect((inserted('invoice_services')[0].payload as Array<Record<string, unknown>>)[0]).toMatchObject({ medical_aid_covered: 0, patient_portion: 500.1 });
  });

  // D1: a line done on another day or by another practitioner carries its own; the others follow the visit
  it("writes a line's own date and practitioner once the database has the columns", async () => {
    setup.lineDetails = true;
    await create({ services: [line(), line({ id: 'line-2', code: '0191', serviceDate: '2026-10-04', practitionerId: 'nurse-7' })] });
    const rows = inserted('invoice_services')[0].payload as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({ service_date: null, practitioner_id: null, discount_amount: 0 });
    expect(rows[1]).toMatchObject({ service_date: '2026-10-04', practitioner_id: 'nurse-7' });
  });

  it('leaves the new columns out before the database has them', async () => {
    await create();
    expect((inserted('invoice_services')[0].payload as Array<Record<string, unknown>>)[0]).not.toHaveProperty('service_date');
  });
});
