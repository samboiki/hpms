import { beforeEach, describe, expect, it, vi } from 'vitest';

// Invented ids only; the database is a stand-in that records what was asked
const db = vi.hoisted(() => ({ result: { data: [] as unknown[] | null, error: null as null | { code: string; message: string } }, asked: [] as unknown[][], throws: false }));
vi.mock('../../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'in', 'not']) {
    chain[name] = (...args: unknown[]) => {
      if (db.throws) throw new TypeError('connection lost');
      db.asked.push([name, ...args]);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(db.result).then(resolve);
  return { supabase: { from: () => chain } };
});

import { invoicesBilledToAccounts } from '../accountBilledInvoices';

const invoices = [
  { id: 'inv-company', visitId: 'visit-company' },
  { id: 'inv-own', visitId: 'visit-own' },
  { id: 'inv-no-visit', visitId: null }
];

beforeEach(() => {
  db.result = { data: [], error: null };
  db.asked = [];
  db.throws = false;
});

describe('invoices billed to company and fund accounts (A14, A19)', () => {
  // The patient's statement, payments and reminders leave these out: the account pays them
  it("names the invoices whose visit an account pays, asking only for visits billed to an account", async () => {
    db.result = { data: [{ visit_id: 'visit-company' }], error: null };
    expect([...(await invoicesBilledToAccounts(invoices))]).toEqual(['inv-company']);
    expect(db.asked).toContainEqual(['in', 'visit_id', ['visit-company', 'visit-own']]);
    expect(db.asked).toContainEqual(['not', 'payer_account_id', 'is', null]);
  });

  it("leaves every invoice the patient's before the table exists, and when the database cannot be read", async () => {
    db.result = { data: null, error: { code: '42P01', message: 'relation "public.visit_payers" does not exist' } };
    expect((await invoicesBilledToAccounts(invoices)).size).toBe(0);
    db.throws = true;
    expect((await invoicesBilledToAccounts(invoices)).size).toBe(0);
  });

  it('asks nothing for invoices without a visit', async () => {
    expect((await invoicesBilledToAccounts([{ id: 'inv-no-visit', visitId: null }])).size).toBe(0);
    expect(db.asked).toEqual([]);
  });
});
