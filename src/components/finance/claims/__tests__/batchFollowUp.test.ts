/**
 * Following up claim batches. A fund that leaves a batch unanswered costs the practice money if nobody notices
 * (claims go stale past the fund's deadline), but an alert that lists batches already paid, or not sent yet, teaches
 * staff to ignore it. Invented values only.
 */
import { describe, it, expect } from 'vitest';
import { FUND_RULES, fundRulesFromRows } from '../../../../utils/billing/fundRules';
import {
  SILENT_FUND_DEFAULTS,
  describeSilentFundDays,
  fundCodeOf,
  outcomeCounts,
  parseSilentFundDays,
  silentBatches,
  silentDaysFor,
  silentFundDefaults,
  silentFunds
} from '../batchFollowUp';
import type { ClaimLineOutcome } from '../status';
import type { BatchHeaderRow } from '../types';

const batch = (id: string, overrides: Partial<BatchHeaderRow> = {}): BatchHeaderRow => ({
  id,
  practice_id: 'practice-1',
  practice_number: '0012345',
  batch_number: Number(id.replace(/\D/g, '')) || 1,
  batch_date: '2026-08-01',
  medical_aid_reference: 'NMC1',
  status: 'sent',
  total_amount: 1000,
  total_invoices: 2,
  generated_file_content: null,
  recipient_email: null,
  // Noon local time, so the sent day is the same in every time zone the tests run in
  sent_at: '2026-08-31T12:00:00',
  confirmed_at: null,
  created_at: null,
  transaction_type: 'D',
  source_software: null,
  source_software_version: null,
  system_identification: 1,
  ...overrides
});

const today = '2026-10-09'; // 39 days after 31 Aug

describe('silentBatches', () => {
  it('flags a sent batch the fund has not answered for 30 days or more while it still owes on it', () => {
    const silent = silentBatches([batch('b1')], new Map([['b1', 45000]]), today);
    expect(silent).toEqual([expect.objectContaining({ fundCode: 'NMC1', daysSinceSent: 39, owedCents: 45000 })]);
    expect(SILENT_FUND_DEFAULTS.default).toBe(30);
  });

  // PSEMAS pays a median 31 days after the service: at 30 days half its batches would be flagged on their way
  it('lets PSEMAS take 60 days by default, whatever its batches call it', () => {
    const psemas = [batch('b1', { medical_aid_reference: 'MAG1' }), batch('b2', { medical_aid_reference: 'PSEMAS', sent_at: '2026-08-01T12:00:00' })];
    const owed = new Map([['b1', 100], ['b2', 100]]);
    expect(silentBatches(psemas, owed, today).map(item => [item.batch.id, item.daysSinceSent])).toEqual([['b2', 69]]);
  });

  it("uses the practice's own wait per fund when it set one", () => {
    const owed = new Map([['b1', 100], ['b2', 100]]);
    const waits = { default: 45, byFund: { NHPM: 20 } };
    const flagged = silentBatches([batch('b1'), batch('b2', { medical_aid_reference: 'NHPM' })], owed, today, waits);
    expect(flagged.map(item => item.batch.id)).toEqual(['b2']);
  });

  it('waits the full 30 days: a batch sent 29 days ago is not flagged yet, one sent 30 days ago is', () => {
    const twentyNine = batch('b1', { sent_at: '2026-09-10T12:00:00' });
    const thirty = batch('b2', { sent_at: '2026-09-09T12:00:00' });
    const owed = new Map([['b1', 100], ['b2', 100]]);
    expect(silentBatches([twentyNine, thirty], owed, today).map(item => item.batch.id)).toEqual(['b2']);
  });

  // Once anything comes back (a remittance or a keyed payment), the batch's status moves on from "sent"
  it('leaves out batches the fund has answered (paid, partly paid, acknowledged, refused)', () => {
    const answered = ['paid', 'partially_paid', 'confirmed', 'unpaid', 'rejected'].map((status, index) => batch(`b${index + 1}`, { status }));
    const owed = new Map(answered.map(item => [item.id, 100]));
    expect(silentBatches(answered, owed, today)).toEqual([]);
  });

  it('leaves out batches not sent yet', () => {
    expect(silentBatches([batch('b1', { status: 'active', sent_at: null })], new Map([['b1', 100]]), today)).toEqual([]);
  });

  // Paid by hand (a receipt keyed without the batch moving), moved to the patient or written off: nothing to chase
  it('leaves out a batch on which the fund owes nothing any more', () => {
    expect(silentBatches([batch('b1'), batch('b2')], new Map([['b1', 0]]), today)).toEqual([]);
  });

  it('still lists unanswered batches when what is owed could not be read, with the amount unknown', () => {
    expect(silentBatches([batch('b1')], null, today)).toEqual([expect.objectContaining({ owedCents: null })]);
  });

  it('puts the longest silence first', () => {
    const newer = batch('b1', { sent_at: '2026-09-01T12:00:00' });
    const older = batch('b2', { sent_at: '2026-07-01T12:00:00' });
    const owed = new Map([['b1', 100], ['b2', 100]]);
    expect(silentBatches([newer, older], owed, today).map(item => item.batch.id)).toEqual(['b2', 'b1']);
  });

  // A credit file takes money back from the fund: nothing is owed on it, so even when the amounts cannot be read it
  // must never appear among the funds that have not answered (staff would chase the fund for a refund it owes nobody)
  it('never lists a credit file (header transaction type C)', () => {
    expect(silentBatches([batch('b1', { transaction_type: 'C' })], null, today)).toEqual([]);
  });
});

describe('silentFunds', () => {
  // A fund's batches are counted together whatever its batches call it (older setups named PSEMAS by its name)
  it('groups the batches per fund by the fund code, the fund owing most first', () => {
    const owed = new Map([['b1', 10000], ['b2', 20000], ['b3', 5000]]);
    const groups = silentFunds(silentBatches([
      batch('b1', { medical_aid_reference: 'MAG1' }),
      batch('b2', { medical_aid_reference: 'PSEMAS', sent_at: '2026-07-01T12:00:00' }),
      batch('b3', { medical_aid_reference: 'NHPM' })
    ], owed, today, { default: 30, byFund: {} }));
    expect(groups.map(group => [group.fundCode, group.batches.length, group.owedCents, group.oldestDays])).toEqual([
      ['MAG1', 2, 30000, 100],
      ['NHPM', 1, 5000, 39]
    ]);
  });

  it('says the amount is unknown when one of its batches could not be read', () => {
    const groups = silentFunds([
      { batch: batch('b1'), fundCode: 'NMC1', daysSinceSent: 40, owedCents: 100 },
      { batch: batch('b2'), fundCode: 'NMC1', daysSinceSent: 35, owedCents: null }
    ]);
    expect(groups[0].owedCents).toBeNull();
  });

  it('knows a fund by any of its names', () => {
    expect(fundCodeOf('PSEMAS')).toBe('MAG1');
    expect(fundCodeOf('nhp')).toBe('NHPM');
    expect(fundCodeOf('XYZ9')).toBe('XYZ9');
  });
});

describe('the practice setting silent_fund_days', () => {
  // With no row (or an unreadable one) the practice still gets sensible warnings
  it('falls back to 30 days and PSEMAS 60 when nothing usable is stored', () => {
    for (const stored of [null, undefined, 'x', 12, [], {}]) {
      expect(parseSilentFundDays(stored)).toEqual({ default: 30, byFund: { MAG1: 60 } });
    }
  });

  it('keeps sensible whole days per fund code and ignores the rest', () => {
    expect(parseSilentFundDays({ default: 40, byFund: { PSEMAS: 75, nhp: 21, NMC1: 3, NAMM: 12.5, PROS: '60' } })).toEqual({ default: 40, byFund: { MAG1: 75, NHPM: 21 } });
    expect(parseSilentFundDays({ default: 1000, byFund: {} })).toEqual({ default: 30, byFund: {} });
  });

  // A saved setting is the whole truth: an administrator who removes the PSEMAS exception gets the common wait for it
  it('treats a saved list of funds as complete, and keeps the PSEMAS exception only when no list was saved', () => {
    expect(silentDaysFor('MAG1', parseSilentFundDays({ default: 45, byFund: {} }))).toBe(45);
    expect(silentDaysFor('PSEMAS', parseSilentFundDays({ default: 45 }))).toBe(60);
    expect(silentDaysFor('NMC1', SILENT_FUND_DEFAULTS)).toBe(30);
  });

  it('reads as one plain sentence', () => {
    const names: Record<string, string> = { MAG1: 'PSEMAS', NHPM: 'Namibia Health Plan' };
    expect(describeSilentFundDays(SILENT_FUND_DEFAULTS, code => names[code] ?? code)).toBe('Warn when a fund has not answered after 30 days; PSEMAS after 60 days.');
    expect(describeSilentFundDays({ default: 30, byFund: { NHPM: 30 } }, code => names[code] ?? code)).toBe('Warn when a fund has not answered after 30 days.');
  });

  // The funds' payment terms (fund master) are the waits for a practice that has not set its own; a practice that
  // did keeps its own, or a support change would silently move its alert
  it("waits for each fund's payment terms unless the practice set its own wait", () => {
    const rules = fundRulesFromRows([
      { medical_aid_reference: 'NMC1', claim_deadline_days: 120, claim_deadline_months: null, deadline_confirmed: true, claims_portal_url: null,
        membership_digits: [9], membership_hint: null, dependant_code_required: true, payment_terms_days: 45 }
    ]);
    const fundWaits = silentFundDefaults(rules);
    expect(fundWaits).toEqual({ default: 30, byFund: { NMC1: 45, MAG1: 60 } });
    expect(silentDaysFor('NMC1', parseSilentFundDays(null, fundWaits))).toBe(45);
    expect(silentDaysFor('NHPM', parseSilentFundDays(null, fundWaits))).toBe(30);
    const practiceOwn = parseSilentFundDays({ default: 30, byFund: { MAG1: 50 } }, fundWaits);
    expect([silentDaysFor('NMC1', practiceOwn), silentDaysFor('MAG1', practiceOwn)]).toEqual([30, 50]);
  });

  it('keeps the built-in waits (PSEMAS 60, the rest 30) as the defaults', () => {
    expect(SILENT_FUND_DEFAULTS).toEqual(silentFundDefaults(FUND_RULES));
    expect(SILENT_FUND_DEFAULTS).toEqual({ default: 30, byFund: { MAG1: 60 } });
  });
});

describe('outcomeCounts', () => {
  it('counts each line once by what the fund answered, lines with no answer as such', () => {
    const outcomes = new Map<string, ClaimLineOutcome>([['l1', 'paid'], ['l2', 'rejected'], ['l3', 'paid'], ['l4', 'waiting'], ['l5', 'part_paid']]);
    expect(outcomeCounts(['l1', 'l2', 'l3', 'l4', 'l5', 'l6'], key => outcomes.get(key))).toEqual({
      paid: 2, part_paid: 1, rejected: 1, waiting: 1, none: 1
    });
  });
});
