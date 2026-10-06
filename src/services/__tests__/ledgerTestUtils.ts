/** Shared builders and a seeded RNG for the ledgerService tests */
import { addDays } from 'date-fns';
import {
  normalizeInvoice,
  toDateKey,
  type LedgerExpense,
  type LedgerInventoryItem,
  type LedgerInvoice,
  type LedgerLineItem,
  type LedgerPayslip
} from '../ledgerService';

// ---------------------------------------------------------------------------------------------
// Builders and a deterministic RNG for generated cases
// ---------------------------------------------------------------------------------------------

let sequence = 0;
export const invoice = (overrides: Partial<LedgerInvoice> = {}): LedgerInvoice => {
  sequence += 1;
  return {
    id: `inv-${sequence}`,
    invoiceNumber: `INV-${String(sequence).padStart(4, '0')}`,
    patientId: null,
    visitId: null,
    practitionerId: null,
    batchId: null,
    issueDate: '2026-10-01',
    dueDate: '2026-10-31',
    total: 100,
    medicalAidTotal: 0,
    patientTotal: 100,
    status: 'pending',
    rawStatus: 'pending',
    paymentMethod: null,
    updatedAt: null,
    createdAt: null,
    ...overrides
  };
};

export const payslip = (overrides: Partial<LedgerPayslip> = {}): LedgerPayslip => ({
  id: `ps-${++sequence}`,
  userId: 'u1',
  employeeName: 'Staff member',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  paymentDate: '2026-10-31',
  gross: 1000,
  deductions: 200,
  net: 800,
  status: 'unpaid',
  ...overrides
});

export const expense = (overrides: Partial<LedgerExpense> = {}): LedgerExpense => ({
  id: `ex-${++sequence}`,
  name: 'Rent',
  type: 'rent',
  category: 'fixed_monthly',
  amount: 500,
  expenseDate: '2026-10-01',
  dueDate: null,
  paidDate: null,
  status: 'pending',
  vendor: null,
  paymentMethod: null,
  isRecurring: false,
  ...overrides
});

export const item = (overrides: Partial<LedgerInventoryItem> = {}): LedgerInventoryItem => ({
  id: `it-${++sequence}`,
  name: 'Gloves',
  category: 'disposables',
  quantity: 10,
  unit: 'box',
  unitCost: 25,
  recordedValue: 250,
  reorderLevel: null,
  expiryDate: null,
  location: null,
  ...overrides
});

export const line = (overrides: Partial<LedgerLineItem> = {}): LedgerLineItem => ({
  invoiceId: 'inv-x',
  code: '0190',
  description: 'Consultation',
  quantity: 1,
  unitPrice: 100,
  total: 100,
  medicalAid: 0,
  patient: 100,
  ...overrides
});

/** mulberry32: small seeded PRNG so generated cases are identical on every run */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANDOM_STATUSES: (string | null)[] = ['paid', 'pending', 'overdue', 'cancelled', null, 'partial', 'PAID', 'Overdue'];

export function randomInvoices(count: number, seed: number): LedgerInvoice[] {
  const random = seededRandom(seed);
  const base = new Date(2025, 0, 1);
  return Array.from({ length: count }, (_, i) => {
    const totalCents = Math.floor(random() * 500000);
    // Some medical aid portions exceed the total or are negative, as bad data can
    const medicalAidCents = Math.floor((random() * 1.4 - 0.2) * totalCents);
    const issue = addDays(base, Math.floor(random() * 700));
    const rawStatus = RANDOM_STATUSES[Math.floor(random() * RANDOM_STATUSES.length)];
    return normalizeInvoice({
      id: `gen-${seed}-${i}`,
      invoice_number: `G${i}`,
      issue_date: toDateKey(issue),
      due_date: toDateKey(addDays(issue, 30)),
      total: (totalCents / 100).toFixed(2),
      medical_aid_total: medicalAidCents / 100,
      payment_status: rawStatus,
      payment_method: ['cash', 'card', 'eft', null, 'medical_aid'][Math.floor(random() * 5)],
      patient_id: `p-${Math.floor(random() * 20)}`
    });
  });
}

export const cents = (amount: number) => Math.round(amount * 100);
