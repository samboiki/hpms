/**
 * Daily and month-end controls: ledger movements (what changes what debtors owe, and on which
 * day), the day-end summary and cashier report, cash-ups and deposit slips, the daybook, and the
 * month-end close (control totals, checks, the lock). Amounts are cents unless a name says otherwise.
 */
import { describe, it, expect } from 'vitest';
import {
  MOVEMENT_KINDS,
  activeCashUps,
  billedPortions,
  cashierReport,
  changesSinceCashUp,
  checkCashCount,
  checkDepositSlip,
  checkMarkDeposited,
  checkReopen,
  closeChecks,
  closedMonths,
  controlSummary,
  controlTotals,
  controlTotalsFromSnapshot,
  dailyTakingsFromReceipts,
  depositCandidates,
  depositWarnings,
  describeDaybookEntry,
  firstOpenDay,
  invoiceFigures,
  ledgerMovements,
  lockFor,
  monthRange,
  netOfMovements,
  normalizeCashUp,
  normalizeDaybookEntry,
  normalizeDaybookPrint,
  normalizeDeposit,
  normalizePeriodClose,
  parseControlAggregates,
  printBanner,
  sequenceGaps,
  snapshotOf,
  summarizeDaybook,
  totalMovements,
  zeroMovements,
  type ArAdjustment,
  type ArAllocation,
  type ArReceipt,
  type BankDeposit,
  type CloseCheckInput,
  type ControlAggregates,
  type LedgerInvoice,
  type MovementTotals,
  type PeriodClose,
  type RawDaybookRow
} from '../ledgerService';
import { cents, invoice, seededRandom } from './ledgerTestUtils';

const TODAY = '2026-10-07';

let seq = 0;
const receipt = (overrides: Partial<ArReceipt> = {}): ArReceipt => {
  seq += 1;
  return {
    id: `r${seq}`,
    number: `RC-${String(seq).padStart(6, '0')}`,
    payerType: 'patient',
    patientId: 'pt1',
    fundName: null,
    payerName: null,
    method: 'cash',
    amountCents: 10000,
    receivedOn: '2026-10-02',
    reference: null,
    source: 'manual',
    notes: null,
    createdBy: 'anna',
    createdAt: '2026-10-02T09:00:00+02:00',
    reversal: null,
    allocatedCents: 0,
    refundedCents: 0,
    unallocatedCents: 10000,
    ...overrides
  };
};

const adjustment = (overrides: Partial<ArAdjustment> = {}): ArAdjustment => {
  seq += 1;
  return {
    id: `a${seq}`,
    number: `CN-${String(seq).padStart(6, '0')}`,
    kind: 'credit_note',
    invoiceId: 'inv-x',
    receiptId: null,
    patientId: 'pt1',
    portion: 'patient',
    amountCents: 1000,
    method: null,
    reasonCode: null,
    reason: 'Test',
    approvedBy: null,
    effectiveOn: '2026-10-02',
    createdBy: 'anna',
    createdAt: '2026-10-02T09:00:00+02:00',
    reversal: null,
    ...overrides
  };
};

const reversedOn = (dateKey: string, reason = 'Captured in error') => ({ at: `${dateKey}T11:00:00+02:00`, by: 'anna', reason });

describe('ledger movements: what changes what debtors owe, on which day', () => {
  it('dates a reversal on the day it was made, so reversing a September receipt in October never changes a closed September', () => {
    const late = receipt({ receivedOn: '2026-09-30', amountCents: 50000, reversal: reversedOn('2026-10-02', 'EFT bounced') });
    const movements = ledgerMovements({ invoices: [], receipts: [late], adjustments: [] });
    expect(totalMovements(movements, monthRange('2026-09')).receipts).toBe(-50000);
    expect(totalMovements(movements, monthRange('2026-10'))).toMatchObject({ receipts: 0, receipt_reversals: 50000 });
  });

  it('counts invoices at what they bill now (a cancelled invoice bills nothing) on their invoice date', () => {
    const movements = ledgerMovements({
      invoices: [invoice({ issueDate: '2026-10-01', total: 300, medicalAidTotal: 100 }), invoice({ issueDate: '2026-10-01', total: 999, status: 'cancelled' })],
      receipts: [],
      adjustments: []
    });
    expect(totalMovements(movements, monthRange('2026-10')).invoices).toBe(30000);
  });

  it('does not count allocations or shortfall transfers: they move money between invoices and portions, not in or out', () => {
    const movements = ledgerMovements({
      invoices: [],
      receipts: [],
      adjustments: [adjustment({ kind: 'shortfall_transfer', portion: 'medical_aid', amountCents: 4000 })]
    });
    expect(movements).toEqual([]);
  });

  it('gives each adjustment its sign: credit notes and write-offs take off, journals add or take off, refunds add credit back', () => {
    const movements = ledgerMovements({
      invoices: [],
      receipts: [],
      adjustments: [
        adjustment({ kind: 'credit_note', amountCents: 1000 }),
        adjustment({ kind: 'write_off', amountCents: 2000 }),
        adjustment({ kind: 'journal', amountCents: -300 }),
        adjustment({ kind: 'journal', amountCents: 500 }),
        adjustment({ kind: 'refund', invoiceId: null, receiptId: 'r1', portion: null, method: 'cash', amountCents: 700 }),
        adjustment({ kind: 'write_off', amountCents: 900, reversal: reversedOn('2026-10-03') })
      ]
    });
    const october = totalMovements(movements, monthRange('2026-10'));
    expect(october).toMatchObject({ credit_notes: -1000, write_offs: -2900, journals: 200, refunds: 700, adjustment_reversals: 900 });
  });

  it('always explains the ledger: all movements add up to every invoice\'s balance less unallocated credit (generated cases)', () => {
    for (const seed of [1, 7, 99, 2026]) {
      const random = seededRandom(seed);
      const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
      const day = () => `2026-${pick(['08', '09', '10'])}-${String(1 + Math.floor(random() * 28)).padStart(2, '0')}`;
      const invoices: LedgerInvoice[] = Array.from({ length: 40 }, (_, i) => invoice({
        id: `g${seed}-${i}`, issueDate: day(), total: Math.floor(random() * 200000) / 100, medicalAidTotal: Math.floor(random() * 150000) / 100,
        status: random() < 0.1 ? 'cancelled' : 'pending'
      }));
      const receipts: ArReceipt[] = [];
      const allocations: ArAllocation[] = [];
      const adjustments: ArAdjustment[] = [];
      for (let i = 0; i < 30; i += 1) {
        const r = receipt({ amountCents: 1000 + Math.floor(random() * 90000), receivedOn: day() });
        const target = pick(invoices);
        const allocated = Math.floor(r.amountCents * random());
        if (allocated > 0) allocations.push({ id: `al${seed}-${i}`, receiptId: r.id, invoiceId: target.id, portion: pick(['patient', 'medical_aid'] as const), amountCents: allocated, createdBy: null, createdAt: null, reversal: random() < 0.15 ? reversedOn('2026-10-04') : null });
        const refund = random() < 0.3 ? adjustment({ kind: 'refund', invoiceId: null, receiptId: r.id, portion: null, method: 'cash', amountCents: Math.floor((r.amountCents - allocated) * random()) || 1, effectiveOn: day(), reversal: random() < 0.2 ? reversedOn('2026-10-05') : null }) : null;
        if (refund) adjustments.push(refund);
        if (random() < 0.15) {
          // A reversed receipt takes its allocations and refunds with it (the database insists)
          r.reversal = reversedOn('2026-10-06');
          allocations.filter(a => a.receiptId === r.id && !a.reversal).forEach(a => { a.reversal = r.reversal; });
          if (refund && !refund.reversal) refund.reversal = reversedOn('2026-10-05');
        }
        receipts.push(r);
      }
      for (let i = 0; i < 25; i += 1) {
        const target = pick(invoices);
        const kind = pick(['credit_note', 'write_off', 'journal', 'shortfall_transfer'] as const);
        adjustments.push(adjustment({
          kind, invoiceId: target.id, portion: kind === 'shortfall_transfer' ? 'medical_aid' : pick(['patient', 'medical_aid'] as const),
          amountCents: (kind === 'journal' && random() < 0.5 ? -1 : 1) * (100 + Math.floor(random() * 5000)), effectiveOn: day(),
          reversal: random() < 0.2 ? reversedOn('2026-10-06') : null
        }));
      }

      // The ledger as ar_invoice_balances and ar_receipt_balances compute it
      const reversedReceipts = new Set(receipts.filter(r => r.reversal).map(r => r.id));
      const owed = invoices.reduce((sum, inv) => {
        const figures = invoiceFigures(billedPortions(inv), allocations.filter(a => a.invoiceId === inv.id), adjustments.filter(d => d.invoiceId === inv.id), reversedReceipts);
        return sum + figures.outstanding.medical_aid + figures.outstanding.patient;
      }, 0);
      const credit = receipts.reduce((sum, r) => {
        if (r.reversal) return sum;
        const allocated = allocations.filter(a => a.receiptId === r.id && !a.reversal).reduce((s, a) => s + a.amountCents, 0);
        const refunded = adjustments.filter(d => d.kind === 'refund' && d.receiptId === r.id && !d.reversal).reduce((s, d) => s + d.amountCents, 0);
        return sum + r.amountCents - allocated - refunded;
      }, 0);

      const movements = ledgerMovements({ invoices, receipts, adjustments });
      expect(movements.reduce((sum, m) => sum + m.cents, 0)).toBe(owed - credit);
    }
  });
});

describe('day-end summary (control totals of a day, and month to date)', () => {
  const sources = {
    invoices: [invoice({ issueDate: '2026-10-02', total: 450, medicalAidTotal: 300 }), invoice({ issueDate: '2026-10-01', total: 100 })],
    receipts: [
      receipt({ method: 'cash', amountCents: 20000 }),
      receipt({ method: 'card', amountCents: 15000 }),
      receipt({ method: 'cash', amountCents: 5000, reversal: reversedOn('2026-10-02', 'Captured twice') }),
      receipt({ method: 'eft', amountCents: 80000, receivedOn: '2026-09-30', reversal: reversedOn('2026-10-02', 'EFT bounced') }),
      receipt({ payerType: 'medical_aid', fundName: 'NHP', method: 'eft', amountCents: 120000 })
    ],
    adjustments: [
      adjustment({ kind: 'refund', invoiceId: null, receiptId: 'rx', portion: null, method: 'cash', amountCents: 3000 }),
      adjustment({ kind: 'credit_note', amountCents: 2500 }),
      adjustment({ kind: 'shortfall_transfer', portion: 'medical_aid', amountCents: 6000 })
    ]
  };
  const day = { startKey: '2026-10-02', endKey: '2026-10-02' };

  it('totals what was invoiced, received, refunded, credited and reversed that day, and the net change in debtors', () => {
    const summary = controlSummary(sources, day);
    expect(summary.invoices).toEqual({ count: 1, billedCents: 45000, medicalAidCents: 30000, patientCents: 15000 });
    expect(summary.receipts).toMatchObject({ count: 4, cents: 160000, fromMedicalAidsCents: 120000, fromOthersCents: 40000 });
    expect(summary.receiptReversals).toEqual({ count: 2, cents: 85000 }); // reversals made today, of today's and of an older receipt
    expect(summary.refunds).toEqual({ count: 1, cents: 3000, cashCents: 3000 });
    expect(summary.adjustments.credit_note).toEqual({ count: 1, cents: 2500 });
    expect(summary.adjustments.shortfall_transfer).toEqual({ count: 1, cents: 6000 });
    // +45000 invoiced - 160000 received + 85000 reversed + 3000 refunded - 2500 credited
    expect(summary.netMovementCents).toBe(-29500);
  });

  it('expects in the till the cash still standing less cash refunds, because a cash receipt captured twice and reversed was never in the drawer', () => {
    expect(controlSummary(sources, day).cash).toEqual({ receivedCents: 20000, refundedCents: 3000, expectedCents: 17000 });
  });

  it('adds up month to date over the same rules as the day', () => {
    const mtd = controlSummary(sources, { startKey: '2026-10-01', endKey: '2026-10-02' });
    expect(mtd.invoices.billedCents).toBe(55000);
    expect(mtd.netMovementCents).toBe(netOfMovements(mtd.movements));
  });
});

describe('cashier report', () => {
  const receipts = [
    receipt({ createdBy: 'anna', method: 'cash', amountCents: 20000 }),
    receipt({ createdBy: 'anna', method: 'card', amountCents: 15000 }),
    receipt({ createdBy: 'ben', method: 'cash', amountCents: 7000 }),
    receipt({ createdBy: 'ben', method: 'cash', amountCents: 9900, reversal: reversedOn('2026-10-02', 'Captured twice') }),
    receipt({ createdBy: 'ben', method: 'eft', amountCents: 50000, receivedOn: '2026-10-01' })
  ];
  const refunds = [adjustment({ kind: 'refund', createdBy: 'ben', invoiceId: null, receiptId: 'r1', portion: null, method: 'cash', amountCents: 2000 })];
  const day = { startKey: '2026-10-02', endKey: '2026-10-02' };

  it('says how much cash each person must hand over: their cash receipts less the cash refunds they paid out', () => {
    const report = cashierReport(receipts, refunds, day);
    expect(report.lines.map(line => [line.userId, line.receivedCents, line.expectedCashCents])).toEqual([['anna', 35000, 20000], ['ben', 7000, 5000]]);
  });

  it('lists a reversed receipt against the person who captured it, so a reversal cannot hide missing cash', () => {
    const ben = cashierReport(receipts, refunds, day).lines.find(line => line.userId === 'ben')!;
    expect(ben).toMatchObject({ reversedCount: 1, reversedCents: 9900, receiptCount: 1 });
  });

  it('adds up to the daily takings report for the same day, so the two cash-up views never disagree', () => {
    const report = cashierReport(receipts, refunds, day);
    const takings = dailyTakingsFromReceipts(receipts, refunds, day);
    expect(report.totals.netCents).toBe(cents(takings.total));
    expect(report.totals.byMethod.cash).toBe(cents(takings.byMethod.cash));
  });
});

describe('cash-up', () => {
  it('requires a note when the till is over or short, because an unexplained difference is what an auditor asks about', () => {
    expect(checkCashCount({ countedCents: 16000, expectedCents: 17000, notes: '', replacing: false, replaceReason: '' }).error).toMatch(/short by N\$ 10\.00/);
    expect(checkCashCount({ countedCents: 16000, expectedCents: 17000, notes: 'R10 change given from the float', replacing: false, replaceReason: '' }).ok).toBe(true);
    expect(checkCashCount({ countedCents: 0, expectedCents: 0, notes: '', replacing: false, replaceReason: '' }).ok).toBe(true);
    expect(checkCashCount({ countedCents: null, expectedCents: 0, notes: '', replacing: false, replaceReason: '' }).ok).toBe(false);
  });

  it('asks why a day is counted again, and keeps the latest count in force', () => {
    expect(checkCashCount({ countedCents: 100, expectedCents: 100, notes: '', replacing: true, replaceReason: ' ' }).ok).toBe(false);
    const records = [
      normalizeCashUp({ id: 'c1', business_date: '2026-10-02', expected_cash: '170.00', counted_cash: '160.00', difference: '-10.00', closed_at: '2026-10-02T17:00:00+02:00', superseded_at: '2026-10-03T08:00:00+02:00' }),
      normalizeCashUp({ id: 'c2', business_date: '2026-10-02', expected_cash: '170.00', counted_cash: '170.00', difference: '0', closed_at: '2026-10-03T08:00:00+02:00' })
    ].filter((r): r is NonNullable<typeof r> => r !== null);
    expect(activeCashUps(records).get('2026-10-02')?.id).toBe('c2');
  });

  it('shows what changed on a day after it was cashed up (a receipt captured later but dated that day)', () => {
    const day = { startKey: '2026-10-02', endKey: '2026-10-02' };
    const before = snapshotOf(controlSummary({ invoices: [], receipts: [receipt({ amountCents: 1000 })], adjustments: [] }, day));
    const after = snapshotOf(controlSummary({ invoices: [], receipts: [receipt({ amountCents: 1000 }), receipt({ amountCents: 500 })], adjustments: [] }, day));
    expect(changesSinceCashUp(before, after).map(change => change.label)).toEqual(['Payments received', 'Cash expected in the till']);
    expect(changesSinceCashUp(before, before)).toEqual([]);
  });
});

describe('deposit slips', () => {
  const cash1 = receipt({ id: 'c1', method: 'cash', amountCents: 20000, receivedOn: '2026-10-01' });
  const cash2 = receipt({ id: 'c2', method: 'cash', amountCents: 5000, receivedOn: '2026-10-02' });
  const card = receipt({ id: 'k1', method: 'card', amountCents: 9000 });
  const reversedCash = receipt({ id: 'c3', method: 'cash', amountCents: 7000, reversal: reversedOn('2026-10-02') });
  const later = receipt({ id: 'c4', method: 'cash', amountCents: 1000, receivedOn: '2026-10-05' });
  const cashRefund = adjustment({ id: 'f1', kind: 'refund', invoiceId: null, receiptId: 'c1', portion: null, method: 'cash', amountCents: 1500, effectiveOn: '2026-10-02' });
  const slip = (overrides: Partial<BankDeposit>): BankDeposit => ({
    id: 'd1', number: 'DP-000001', status: 'prepared', preparedOn: '2026-10-02', depositedOn: null, bankReference: null, receiptIds: [], refundIds: [],
    amountCents: 0, notes: null, preparedBy: 'anna', preparedAt: null, depositedBy: null, cancelledAt: null, cancelReason: null, ...overrides
  });

  it('offers only standing cash not on a slip yet, less the cash refunds paid from the till', () => {
    const candidates = depositCandidates([cash1, cash2, card, reversedCash, later], [cashRefund], [], '2026-10-02');
    expect(candidates.receipts.map(r => r.id)).toEqual(['c1', 'c2']);
    expect(candidates.refunds.map(r => r.id)).toEqual(['f1']);
    expect(candidates.totalCents).toBe(23500);
  });

  it('never banks the same receipt twice, but a cancelled slip frees its receipts', () => {
    expect(depositCandidates([cash1, cash2], [], [slip({ receiptIds: ['c1'] })], TODAY).receipts.map(r => r.id)).toEqual(['c2']);
    expect(depositCandidates([cash1, cash2], [], [slip({ receiptIds: ['c1'], status: 'cancelled' })], TODAY).receipts.map(r => r.id)).toEqual(['c1', 'c2']);
  });

  it('refuses a slip with nothing to bank, a reversed receipt or a card payment', () => {
    expect(checkDepositSlip([], []).ok).toBe(false);
    expect(checkDepositSlip([reversedCash], []).ok).toBe(false);
    expect(checkDepositSlip([card], []).error).toMatch(/Only cash/);
    expect(checkDepositSlip([cash2], [cashRefund, cashRefund, cashRefund, cashRefund]).error).toMatch(/nothing to bank/);
    expect(checkDepositSlip([cash1, cash2], [cashRefund]).ok).toBe(true);
  });

  it('marks a slip deposited only with the bank\'s reference and a real banking day', () => {
    const base = { status: 'prepared' as const, bankReference: 'FNB 7712', depositedOn: '2026-10-03', preparedOn: '2026-10-02', todayKey: TODAY };
    expect(checkMarkDeposited(base).ok).toBe(true);
    expect(checkMarkDeposited({ ...base, bankReference: '' }).ok).toBe(false);
    expect(checkMarkDeposited({ ...base, depositedOn: '2026-10-08' }).error).toMatch(/future/);
    expect(checkMarkDeposited({ ...base, depositedOn: '2026-10-01' }).error).toMatch(/before the slip/);
    expect(checkMarkDeposited({ ...base, status: 'deposited' }).ok).toBe(false);
  });

  it('warns when a receipt on a slip not yet banked has been reversed since', () => {
    const warnings = depositWarnings(slip({ receiptIds: ['c3'] }), new Map([['c3', reversedCash]]), new Map());
    expect(warnings[0]).toMatch(/was reversed after this slip was prepared/);
  });

  it('reads slips with their receipts and refunds', () => {
    const deposit = normalizeDeposit({ id: 'd9', deposit_number: 'DP-000009', status: 'deposited', amount: '235.00', deposited_on: '2026-10-03', bank_reference: ' FNB 1 ' },
      [{ deposit_id: 'd9', receipt_id: 'c1' }, { deposit_id: 'd9', refund_id: 'f1' }, { deposit_id: 'other', receipt_id: 'zz' }]);
    expect(deposit).toMatchObject({ number: 'DP-000009', status: 'deposited', amountCents: 23500, bankReference: 'FNB 1', receiptIds: ['c1'], refundIds: ['f1'] });
  });
});

describe('daybook', () => {
  const row = (number: number, overrides: Partial<RawDaybookRow> = {}): RawDaybookRow => ({
    entry_number: number, recorded_at: '2026-10-07T09:00:00+02:00', recorded_on: '2026-10-07', business_date: '2026-10-07',
    entry_type: 'receipt', document_number: `RC-${number}`, amount: '100.00', debtors_effect: '-100.00', method: 'cash', ...overrides
  });

  it('reads entries and refuses rows it does not understand rather than showing them wrongly', () => {
    expect(normalizeDaybookEntry(row(1))).toMatchObject({ number: 1, kind: 'receipt', amountCents: 10000, effectCents: -10000, method: 'cash' });
    expect(normalizeDaybookEntry(row(2, { entry_type: 'something_else' }))).toBeNull();
    expect(normalizeDaybookEntry(row(3, { entry_number: null }))).toBeNull();
  });

  it('totals a day by type with the net change in debtors and the money banked, and counts late captures', () => {
    const entries = [
      row(10, { entry_type: 'invoice_raised', document_number: 'INV-1', amount: '450.00', debtors_effect: '450.00', method: null }),
      row(11),
      row(12, { entry_type: 'refund', amount: '30.00', debtors_effect: '30.00' }),
      row(13, { entry_type: 'allocation', amount: '100.00', debtors_effect: '0' }),
      row(14, { entry_type: 'receipt', business_date: '2026-10-03', amount: '50.00', debtors_effect: '-50.00' })
    ].map(normalizeDaybookEntry).filter((e): e is NonNullable<typeof e> => e !== null);
    const summary = summarizeDaybook(entries);
    expect(summary.netEffectCents).toBe(45000 - 10000 + 3000 - 5000);
    expect(summary.netReceivedCents).toBe(10000 + 5000 - 3000);
    expect(summary.backdatedCount).toBe(1);
    expect(summary.byKind.map(kind => [kind.kind, kind.count])).toEqual([['invoice_raised', 1], ['receipt', 2], ['allocation', 1], ['refund', 1]]);
    expect([summary.firstNumber, summary.lastNumber]).toEqual([10, 14]);
  });

  it('shows a gap in the numbering instead of hiding it: the numbers are gapless in the database, so a gap means a missing page', () => {
    expect(sequenceGaps([{ number: 5 }, { number: 6 }, { number: 9 }, { number: 10 }, { number: 13 }])).toEqual([{ from: 7, to: 8 }, { from: 11, to: 12 }]);
    expect(sequenceGaps([{ number: 1 }, { number: 2 }])).toEqual([]);
  });

  it('marks every print after the first as a reprint, with when the original was made and what is new since', () => {
    const original = normalizeDaybookPrint({ id: 'p1', day: '2026-10-07', kind: 'print', copy_number: 1, from_number: 10, to_number: 14, printed_by: 'anna', printed_at: '2026-10-07T17:05:00+02:00' })!;
    expect(printBanner({ copyNumber: 1, fromNumber: 10, toNumber: 14 }, [])).toBe('Original');
    const banner = printBanner({ copyNumber: 2, fromNumber: 10, toNumber: 16 }, [original], { anna: 'Anna Shikongo' });
    expect(banner).toMatch(/^REPRINT, copy 2\. First printed 7 Oct 2026, \d\d:\d\d by Anna Shikongo\. Entries 15 to 16 were recorded after the original\.$/);
  });

  it('describes an entry in words, with the portion and how it was paid', () => {
    const entry = normalizeDaybookEntry(row(20, { entry_type: 'adjustment_reversed', adjustment_kind: 'write_off', document_number: 'WO-000003', portion: 'patient', method: null }))!;
    expect(describeDaybookEntry(entry)).toBe('Write-off WO-000003 reversed, patient portion');
    expect(describeDaybookEntry(normalizeDaybookEntry(row(21))!)).toBe('Payment received RC-21 (cash)');
    expect(describeDaybookEntry(normalizeDaybookEntry(row(22, { entry_type: 'allocation', document_number: 'RC-7', related_document: 'INV-9', portion: 'medical_aid', method: null }))!))
      .toBe('Payment allocated RC-7 to INV-9, medical aid portion');
  });
});

describe('month end', () => {
  const close = (monthKey: string, overrides: Partial<PeriodClose> = {}): PeriodClose => ({
    id: `pc-${monthKey}`, monthKey, closedAt: '2026-09-03T10:00:00+02:00', closedBy: 'boss', notes: null, snapshot: null,
    closingCents: null, reopenedAt: null, reopenedBy: null, reopenReason: null, ...overrides
  });
  const totals = (overrides: Partial<Record<'before' | 'during' | 'after', Partial<MovementTotals>>> & { ledgerNetCents?: number } = {}): ControlAggregates => ({
    before: { ...zeroMovements(), invoices: 500000, receipts: -300000, ...overrides.before },
    during: { ...zeroMovements(), invoices: 200000, receipts: -150000, credit_notes: -10000, ...overrides.during },
    after: { ...zeroMovements(), invoices: 30000, ...overrides.after },
    ledgerNetCents: overrides.ledgerNetCents ?? 270000
  });

  it('rolls forward: opening + movements = closing, and the closing is what the account balances say the month ended on', () => {
    const result = controlTotals('2026-09', totals());
    expect(result).toMatchObject({ openingCents: 200000, netMovementCents: 40000, closingCents: 240000, ledgerClosingCents: 240000, ledgerDifferenceCents: 0, openingSource: 'computed' });
  });

  it('shows a difference when the balances are not explained by the entries (something changed without an entry)', () => {
    expect(controlTotals('2026-09', totals({ ledgerNetCents: 270500 })).ledgerDifferenceCents).toBe(-500);
  });

  it('brings forward the closing balance kept at the previous close, and flags it when a closed month changed since', () => {
    expect(controlTotals('2026-09', totals(), { closingCents: 200000 })).toMatchObject({ openingSource: 'previous_close', openingDifferenceCents: 0 });
    expect(controlTotals('2026-09', totals(), { closingCents: 201000 }).openingDifferenceCents).toBe(1000);
  });

  it('reads the database totals and refuses a malformed answer instead of showing zeros', () => {
    const json = { before: { invoices: 500000, receipts: -300000 }, during: { invoices: 200000 }, after: {}, ledger_net_cents: 400000 };
    expect(parseControlAggregates(json)?.during.invoices).toBe(200000);
    expect(parseControlAggregates({ ...json, ledger_net_cents: '400000' })).toBeNull();
    expect(parseControlAggregates({ ...json, during: { invoices: 1.5 } })).toBeNull();
    expect(parseControlAggregates(null)).toBeNull();
  });

  const input = (overrides: Partial<CloseCheckInput> = {}): CloseCheckInput => ({
    monthKey: '2026-09',
    todayKey: TODAY,
    role: 'admin',
    closes: [close('2026-08')],
    unallocatedReceipts: [],
    explanations: {},
    cashDays: ['2026-09-01', '2026-09-02'],
    cashedUpDays: new Set(['2026-09-01', '2026-09-02']),
    totals: controlTotals('2026-09', totals()),
    loadedMovements: totals().during,
    ...overrides
  });
  const failing = (result: ReturnType<typeof closeChecks>) => result.checks.filter(check => !check.ok).map(check => check.key);

  it('closes a month whose checks pass', () => {
    const result = closeChecks(input());
    expect(failing(result)).toEqual([]);
    expect(result.canClose).toBe(true);
  });

  it('will not close a month while money sits unallocated without a reason: that money is someone\'s payment', () => {
    const open = receipt({ receivedOn: '2026-09-20', unallocatedCents: 4000, number: 'RC-000777' });
    const blocked = closeChecks(input({ unallocatedReceipts: [open] }));
    expect(blocked.canClose).toBe(false);
    expect(blocked.checks.find(check => check.key === 'receipts')?.items).toEqual(['RC-000777: N$ 40.00 unallocated']);
    expect(closeChecks(input({ unallocatedReceipts: [open], explanations: { [open.id]: 'NHP payment, remittance not received yet' } })).canClose).toBe(true);
    // Money received after the month does not hold up its close
    expect(closeChecks(input({ unallocatedReceipts: [receipt({ receivedOn: '2026-10-01', unallocatedCents: 4000 })] })).canClose).toBe(true);
  });

  it('will not close a month with a day that took money but was never cashed up', () => {
    const result = closeChecks(input({ cashDays: ['2026-09-01', '2026-09-02', '2026-09-15'] }));
    expect(failing(result)).toEqual(['cash_ups']);
    expect(result.checks.find(check => check.key === 'cash_ups')?.items).toEqual(['15 Sep 2026']);
  });

  it('cannot close the current month (it has not ended), a closed month, or as anyone but an admin', () => {
    expect(failing(closeChecks(input({ monthKey: '2026-10', totals: controlTotals('2026-10', totals()), closes: [close('2026-09')] })))).toContain('month_ended');
    expect(failing(closeChecks(input({ closes: [close('2026-08'), close('2026-09')] })))).toContain('not_closed');
    expect(failing(closeChecks(input({ role: 'doctor' })))).toEqual(['role']);
  });

  it('blocks when the entries on screen differ from the database totals, because the pack kept with the close must be complete', () => {
    const result = closeChecks(input({ loadedMovements: { ...totals().during, receipts: -149000 } }));
    expect(failing(result)).toEqual(['loaded']);
    expect(result.checks.find(check => check.key === 'loaded')?.detail).toMatch(/Payments received/);
  });

  it('blocks when the opening balance is not last month\'s closing balance: a closed month changed and must be reopened with a reason', () => {
    expect(failing(closeChecks(input({ totals: controlTotals('2026-09', totals(), { closingCents: 201000 }) })))).toEqual(['opening']);
  });

  it('only warns when the previous month is still open, so a practice starting out is not forced to close years of history', () => {
    const result = closeChecks(input({ closes: [] }));
    expect(failing(result)).toEqual(['previous_month']);
    expect(result.canClose).toBe(true);
  });

  it('locks a closed month until it is reopened, and points late entries to the first open day', () => {
    const closes = [close('2026-08'), close('2026-09'), close('2026-07', { reopenedAt: '2026-09-10T10:00:00+02:00', reopenReason: 'Late remittance' })];
    expect(lockFor('2026-09-14', closes)?.monthKey).toBe('2026-09');
    expect(lockFor('2026-07-14', closes)).toBeNull();
    expect([...closedMonths(closes).keys()].sort()).toEqual(['2026-08', '2026-09']);
    expect(firstOpenDay('2026-08-20', closes)).toBe('2026-10-01');
    expect(firstOpenDay('2026-10-03', closes)).toBe('2026-10-03');
  });

  it('reopens only for an admin with a reason, which is kept with the month', () => {
    const closed = close('2026-09');
    expect(checkReopen({ role: 'admin', reason: 'NHP remittance for September arrived late', close: closed }).ok).toBe(true);
    expect(checkReopen({ role: 'doctor', reason: 'NHP remittance for September arrived late', close: closed }).ok).toBe(false);
    expect(checkReopen({ role: 'admin', reason: 'oops', close: closed }).ok).toBe(false);
    expect(checkReopen({ role: 'admin', reason: 'Late remittance', close: { ...closed, reopenedAt: '2026-10-01T10:00:00+02:00' } }).ok).toBe(false);
  });

  it('shows a closed month with the totals kept at the close, so a reprint is exactly what was signed off', () => {
    const kept = { control_totals: { before: { invoices: 500000, receipts: -300000 }, during: { invoices: 200000, receipts: -150000 }, after: { invoices: 99000 }, ledger_net_cents: 349000, opening_cents: 200000, opening_source: 'previous_close' } };
    expect(controlTotalsFromSnapshot('2026-09', kept)).toMatchObject({ openingCents: 200000, closingCents: 250000, ledgerDifferenceCents: 0, openingSource: 'previous_close' });
    expect(controlTotalsFromSnapshot('2026-09', { pack: {} })).toBeNull();
  });

  it('reads a close and its balance', () => {
    expect(normalizePeriodClose({ id: 'x', period_month: '2026-09-01', closed_at: '2026-10-02T10:00:00+02:00', closing_balance: '2400.00' })).toMatchObject({ monthKey: '2026-09', closingCents: 240000 });
    // The same kinds dc_close_period compares with the screen (discounts since proposals/2026-10-13-discounts-and-statements.sql)
    expect(MOVEMENT_KINDS.map(kind => kind.key)).toEqual([
      'invoices', 'credit_notes', 'discounts', 'write_offs', 'journals', 'receipts', 'refunds', 'receipt_reversals', 'refund_reversals', 'adjustment_reversals'
    ]);
  });
});
