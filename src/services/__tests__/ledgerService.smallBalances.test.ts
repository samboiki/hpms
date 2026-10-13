/**
 * Small-balance write-off run (Finance > Debtors > Small balances). A write-off gives money away,
 * so the run must take only what is truly small and stale, never what someone is still dealing
 * with, and must say exactly what was and was not written off. Amounts are cents.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  familyAccounts,
  groupSmallBalanceRuns,
  parseSmallBalanceRef,
  planSmallBalances,
  runOutcome,
  runSmallBalanceWriteOffs,
  smallBalanceRef,
  smallBalanceSelection,
  type AccountFlagKind,
  type AgingItem,
  type ArAdjustment,
  type SmallBalanceLine
} from '../ledgerService';
import { invoice } from './ledgerTestUtils';

const item = (patientId: string, patient: number, ageDays: number | null, medicalAid = 0): AgingItem => {
  const inv = invoice({ patientId, total: patient + medicalAid, medicalAidTotal: medicalAid, patientTotal: patient });
  return { invoice: inv, bucket: 'days_over_90', daysPastDue: ageDays, ageDays, ageBand: 'days_120', amount: patient + medicalAid, medicalAid, patient };
};

const names = { ann: 'Ann Amukoto', ben: 'Ben Basson', kid: 'Kim Basson', cas: 'Cas Coetzee' };
const selfPaying = (patientId: string) => patientId;

const plan = (items: AgingItem[], overrides: Partial<Parameters<typeof planSmallBalances>[0]> = {}) =>
  planSmallBalances({ items, accountOf: selfPaying, names, maxCents: 1000, minAgeDays: 90, ...overrides });

describe('which balances qualify', () => {
  it('takes accounts owing at most the amount chosen, every part at least as old as chosen', () => {
    const result = plan([item('ann', 7.5, 120), item('ben', 10, 95), item('cas', 10.01, 200)]);
    expect(result.accounts.map(account => [account.accountId, account.owedCents])).toEqual([['ann', 750], ['ben', 1000]]);
    expect(result.totalCents).toBe(1750);
  });

  it('decides per account, not per invoice: N$ 6 on each of two invoices is N$ 12, more than a N$ 10 limit', () => {
    expect(plan([item('ann', 6, 120), item('ann', 6, 150)]).accounts).toEqual([]);
  });

  it('treats a family as one account under whoever pays, with each member\'s invoice as its own write-off', () => {
    const family = familyAccounts([{ id: 'l1', patientId: 'kid', holderId: 'ben', relationship: 'child', linkedBy: null, linkedAt: null, unlinkedAt: null, unlinkReason: null }]);
    const result = plan([item('ben', 4, 100), item('kid', 3, 130)], { accountOf: family.accountOf });
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toMatchObject({ accountId: 'ben', name: 'Ben Basson', owedCents: 700 });
    expect(result.accounts[0].lines.map(line => line.patientId)).toEqual(['kid', 'ben']); // oldest first
  });

  it('leaves out an account when part of it is newer than the age chosen: ask for it at the next visit instead', () => {
    const result = plan([item('ann', 3, 200), item('ann', 2, 20)]);
    expect(result.accounts).toEqual([]);
    expect(result.excluded).toEqual({ too_recent: 1 });
  });

  it('leaves out disputed and handed-over accounts: someone is already dealing with them', () => {
    const flagsByPatient: Record<string, AccountFlagKind[]> = { ann: ['dispute'], ben: ['handed_over'] };
    const result = plan([item('ann', 5, 120), item('ben', 5, 120), item('cas', 5, 120)], { flagsByPatient });
    expect(result.accounts.map(account => account.accountId)).toEqual(['cas']);
    expect(result.excluded).toEqual({ dispute: 1, handed_over: 1 });
  });

  it('leaves out an account holding credit, also credit on a family member\'s file: allocate the credit instead of writing off', () => {
    const family = familyAccounts([{ id: 'l1', patientId: 'kid', holderId: 'ben', relationship: 'child', linkedBy: null, linkedAt: null, unlinkedAt: null, unlinkReason: null }]);
    const result = plan([item('ann', 5, 120), item('ben', 5, 120)], { accountOf: family.accountOf, creditByPatient: { ann: 200, kid: 100 } });
    expect(result.accounts).toEqual([]);
    expect(result.excluded).toEqual({ credit: 2 });
  });

  it('leaves out a patient portion whose medical aid part is still open: the balance may still change (and a waived co-payment is not small change to a fund)', () => {
    const result = plan([item('ann', 5, 120, 500)]);
    expect(result.accounts).toEqual([]);
    expect(result.excluded).toEqual({ fund_open: 1 });
  });

  it('treats an undated invoice as old: it cannot be shown to be recent', () => {
    expect(plan([item('ann', 5, null)]).accounts).toHaveLength(1);
  });

  it('adds up only the ticked accounts, so staff can untick anyone before writing off', () => {
    const { accounts } = plan([item('ann', 7.5, 120), item('ben', 10, 95)]);
    const chosen = smallBalanceSelection(accounts, new Set(['ann']));
    expect(chosen.totalCents).toBe(1000);
    expect(chosen.lines.map(line => line.patientId)).toEqual(['ben']);
  });
});

describe('the run', () => {
  const line = (invoiceId: string, amountCents: number): SmallBalanceLine => ({ invoiceId, invoiceNumber: invoiceId.toUpperCase(), patientId: 'ann', amountCents, ageDays: 120 });

  it('writes off each balance in turn, keeps going after a refusal and keeps the database\'s reason for each refusal', async () => {
    const writeOff = vi.fn(async (current: SmallBalanceLine) => {
      if (current.invoiceId === 'b') throw new Error('A write-off cannot be more than the N$ 2.00 still owed on the patient portion of invoice B');
      return { number: `WO-${current.invoiceId}` };
    });
    const progress = vi.fn();
    const results = await runSmallBalanceWriteOffs([line('a', 300), line('b', 400), line('c', 500)], writeOff, progress);
    expect(writeOff).toHaveBeenCalledTimes(3);
    expect(results.map(result => [result.line.invoiceId, result.ok, result.number])).toEqual([['a', true, 'WO-a'], ['b', false, null], ['c', true, 'WO-c']]);
    expect(results[1].error).toMatch(/still owed/);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
  });

  it('counts a balance this run already wrote off (a retry after a timeout) as done, never as written off twice', async () => {
    const results = await runSmallBalanceWriteOffs([line('a', 300)], async () => {
      throw new Error('duplicate key value violates unique constraint "invoice_adjustments_external_ref_unique"');
    });
    expect(results[0]).toMatchObject({ ok: true, error: null });
  });

  it('says plainly when only part of the run went through, with the amounts on both sides', () => {
    const outcome = runOutcome([
      { line: line('a', 300), ok: true, number: 'WO-1', error: null },
      { line: line('b', 400), ok: false, number: null, error: 'Only a practice admin or doctor can approve a write-off' }
    ]);
    expect(outcome.headline).toBe('Written off 1 of 2 balances (N$ 3.00). 1 balance (N$ 4.00) was not: the reasons are below.');
    expect(outcome.failed).toHaveLength(1);
    expect(runOutcome([{ line: line('a', 300), ok: true, number: 'WO-1', error: null }]).headline).toBe('Written off 1 balance: N$ 3.00.');
    expect(runOutcome([{ line: line('a', 300), ok: false, number: null, error: 'x' }]).headline).toMatch(/^Nothing was written off/);
  });

  it('tags each write-off with its run and invoice, so the run can be listed and retried safely', () => {
    const ref = smallBalanceRef('run-1', 'inv-9');
    expect(ref).toBe('small-balance:run-1:inv-9');
    expect(parseSmallBalanceRef(ref)).toEqual({ runId: 'run-1', invoiceId: 'inv-9' });
    expect(parseSmallBalanceRef('sha256:abc')).toBeNull();
    expect(parseSmallBalanceRef(null)).toBeNull();
  });
});

describe('runs afterwards', () => {
  const adjustment = (overrides: Partial<ArAdjustment>): ArAdjustment => ({
    id: 'adj',
    number: 'WO-000001',
    kind: 'write_off',
    invoiceId: 'inv-1',
    receiptId: null,
    patientId: 'ann',
    portion: 'patient',
    amountCents: 500,
    method: null,
    reasonCode: 'small_balance',
    reason: 'Small balance not worth collecting',
    approvedBy: 'u1',
    effectiveOn: '2026-10-08',
    createdBy: 'u1',
    createdAt: '2026-10-08T10:00:00+02:00',
    reversal: null,
    ...overrides
  });

  it('lists each run once, newest first, with its total; a reversed write-off is owed again and leaves the total', () => {
    const runs = groupSmallBalanceRuns([
      { adjustment: adjustment({ id: 'a1', number: 'WO-000001' }), externalRef: 'small-balance:old:inv-1', invoiceNumber: 'INV-1' },
      { adjustment: adjustment({ id: 'a2', number: 'WO-000005', invoiceId: 'inv-2', amountCents: 300, createdAt: '2026-10-09T08:00:00+02:00' }), externalRef: 'small-balance:new:inv-2', invoiceNumber: 'INV-2' },
      { adjustment: adjustment({ id: 'a3', number: 'WO-000006', invoiceId: 'inv-3', amountCents: 200, createdAt: '2026-10-09T08:00:01+02:00', reversal: { at: '2026-10-10T09:00:00+02:00', by: 'u1', reason: 'Patient paid' } }), externalRef: 'small-balance:new:inv-3', invoiceNumber: 'INV-3' },
      { adjustment: adjustment({ id: 'a4', invoiceId: 'inv-4' }), externalRef: null, invoiceNumber: 'INV-4' } // a write-off made by hand is not part of a run
    ]);
    expect(runs.map(run => [run.runId, run.lines.length, run.totalCents, run.reversedCount])).toEqual([['new', 2, 300, 1], ['old', 1, 500, 0]]);
    expect(runs[0].lines[0]).toMatchObject({ invoiceId: 'inv-2', invoiceNumber: 'INV-2', patientId: 'ann' });
  });
});
