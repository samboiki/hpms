import { formatNad, fromCents, toCents } from '../../utils/billing/money';
import { plainWords } from '../../utils/plainErrors';
import type { AccountFlagKind } from './accountFlags';
import type { ArAdjustment } from './arModel';
import type { AgingItem } from './receivables';

// ---------------------------------------------------------------------------------------------
// Small-balance write-off run (Finance > Debtors > Small balances): the leftovers that cost more
// to chase than they are worth, written off in one go with one reason. Eminance offers this at
// month end ("below a set amount"); here staff choose the amount and how old the debt must be,
// see every account with a total, untick any, and get a plain account of what was and was not
// written off. Each balance is its own write-off through ar_post_adjustment, so the database
// checks the approver (admins and doctors) and the amount still owed on every one.
//
// What qualifies is decided per account (whoever pays: a family is one account), never per
// invoice: a patient owing N$ 9 on ten invoices owes N$ 90, which is not a small balance.
// Only the patient portion is written off. An account is left out when:
// - it is in dispute or handed over (someone is dealing with it),
// - it holds unallocated credit (allocate the credit instead of writing off),
// - the medical aid has not paid its part of one of those invoices yet (the balance may change),
// - part of it is newer than the age chosen (it is not stale; ask for it at the next visit).
// ---------------------------------------------------------------------------------------------

export const SMALL_BALANCE_REASON_CODE = 'small_balance';
/** Ages (days since the invoice date) staff choose from */
export const SMALL_BALANCE_AGES: readonly number[] = [30, 60, 90, 120, 180];
export const DEFAULT_SMALL_BALANCE_MAX_CENTS = 1000;
export const DEFAULT_SMALL_BALANCE_AGE_DAYS = 90;

export interface SmallBalanceLine {
  invoiceId: string;
  invoiceNumber: string;
  /** The patient the invoice belongs to (the account holder or a family member) */
  patientId: string;
  /** The patient portion still owed */
  amountCents: number;
  /** Days since the invoice date; null when undated (it cannot be shown to be recent) */
  ageDays: number | null;
}

export interface SmallBalanceAccount {
  /** Whoever pays: the account holder, or the patient who pays for themselves */
  accountId: string;
  name: string;
  owedCents: number;
  lines: SmallBalanceLine[];
}

export type SmallBalanceExclusion = 'dispute' | 'handed_over' | 'credit' | 'fund_open' | 'too_recent';

export const SMALL_BALANCE_EXCLUSION_LABELS: Record<SmallBalanceExclusion, string> = {
  dispute: 'in dispute',
  handed_over: 'handed over',
  credit: 'credit to allocate first',
  fund_open: 'waiting for the medical aid',
  too_recent: 'part of it is newer than the age chosen'
};

export interface SmallBalancePlan {
  accounts: SmallBalanceAccount[];
  /** Small balances left out, per reason */
  excluded: Partial<Record<SmallBalanceExclusion, number>>;
  totalCents: number;
}

/**
 * The small balances that qualify: accounts whose patient portions add up to more than nothing and
 * at most `maxCents`, every part at least `minAgeDays` old, and none of the reasons above. Sorted by
 * name so staff find a patient to untick.
 */
export function planSmallBalances(input: {
  items: readonly AgingItem[];
  accountOf: (patientId: string) => string;
  names: Readonly<Record<string, string>>;
  creditByPatient?: Readonly<Record<string, number>>;
  flagsByPatient?: Readonly<Record<string, readonly AccountFlagKind[]>>;
  maxCents: number;
  minAgeDays: number;
}): SmallBalancePlan {
  const byAccount = new Map<string, { lines: SmallBalanceLine[]; fundOpen: boolean; patientIds: Set<string> }>();
  for (const item of input.items) {
    const patientId = item.invoice.patientId;
    const amountCents = toCents(item.patient);
    if (!patientId || amountCents <= 0) continue;
    const accountId = input.accountOf(patientId);
    const group = byAccount.get(accountId) ?? { lines: [], fundOpen: false, patientIds: new Set<string>([accountId]) };
    group.lines.push({ invoiceId: item.invoice.id, invoiceNumber: item.invoice.invoiceNumber, patientId, amountCents, ageDays: item.ageDays });
    group.fundOpen = group.fundOpen || toCents(item.medicalAid) > 0;
    group.patientIds.add(patientId);
    byAccount.set(accountId, group);
  }

  // Credit of every family member counts for the account, also of members who owe nothing
  const creditByAccount = new Map<string, number>();
  for (const [patientId, cents] of Object.entries(input.creditByPatient ?? {})) {
    if (cents <= 0) continue;
    const accountId = input.accountOf(patientId);
    creditByAccount.set(accountId, (creditByAccount.get(accountId) ?? 0) + cents);
  }

  const plan: SmallBalancePlan = { accounts: [], excluded: {}, totalCents: 0 };
  const exclude = (reason: SmallBalanceExclusion) => { plan.excluded[reason] = (plan.excluded[reason] ?? 0) + 1; };
  for (const [accountId, group] of byAccount) {
    const owedCents = group.lines.reduce((sum, line) => sum + line.amountCents, 0);
    if (owedCents > input.maxCents) continue; // not a small balance
    const flags = new Set([...group.patientIds].flatMap(id => [...(input.flagsByPatient?.[id] ?? [])]));
    if (flags.has('dispute')) { exclude('dispute'); continue; }
    if (flags.has('handed_over')) { exclude('handed_over'); continue; }
    if ((creditByAccount.get(accountId) ?? 0) > 0) { exclude('credit'); continue; }
    if (group.fundOpen) { exclude('fund_open'); continue; }
    if (group.lines.some(line => line.ageDays !== null && line.ageDays < input.minAgeDays)) { exclude('too_recent'); continue; }
    const lines = [...group.lines].sort((a, b) => (b.ageDays ?? Infinity) - (a.ageDays ?? Infinity) || a.invoiceNumber.localeCompare(b.invoiceNumber));
    plan.accounts.push({ accountId, name: input.names[accountId] ?? 'Patient', owedCents, lines });
    plan.totalCents += owedCents;
  }
  plan.accounts.sort((a, b) => a.name.localeCompare(b.name) || a.accountId.localeCompare(b.accountId));
  return plan;
}

/** What a run writes off: the ticked accounts (every one unless staff untick it) */
export function smallBalanceSelection(accounts: readonly SmallBalanceAccount[], unticked: ReadonlySet<string>): {
  accounts: SmallBalanceAccount[];
  lines: SmallBalanceLine[];
  totalCents: number;
} {
  const chosen = accounts.filter(account => !unticked.has(account.accountId));
  return {
    accounts: chosen,
    lines: chosen.flatMap(account => account.lines),
    totalCents: chosen.reduce((sum, account) => sum + account.owedCents, 0)
  };
}

// ---------------------------------------------------------------------------------------------
// The run: one write-off per balance, each tagged with the run, so the run can be listed afterwards
// and a retry never writes the same balance off twice (invoice_adjustments_external_ref_unique)
// ---------------------------------------------------------------------------------------------

const REF_PREFIX = 'small-balance';

/** The tag on each write-off of a run */
export const smallBalanceRef = (runId: string, invoiceId: string): string => `${REF_PREFIX}:${runId}:${invoiceId}`;

/** Every write-off of small-balance runs has a tag starting with this (for the list of runs) */
export const SMALL_BALANCE_REF_PATTERN = `${REF_PREFIX}:%`;

export function parseSmallBalanceRef(ref: string | null | undefined): { runId: string; invoiceId: string } | null {
  const parts = (ref ?? '').split(':');
  if (parts.length !== 3 || parts[0] !== REF_PREFIX || !parts[1] || !parts[2]) return null;
  return { runId: parts[1], invoiceId: parts[2] };
}

/** The database refused a line because this run already wrote it off (a retry after a timeout): it is done */
export const isAlreadyWrittenOff = (message: string): boolean => /invoice_adjustments_external_ref_unique|duplicate key/i.test(message);

export interface WriteOffResult {
  line: SmallBalanceLine;
  ok: boolean;
  /** The write-off's number (WO-...) when saved now */
  number: string | null;
  /** Why the database refused it, in its words */
  error: string | null;
}

/**
 * Writes off each line in turn (one call per balance, so the database checks each one). One refusal
 * never stops the others, and every line ends up written off or with the reason it was not.
 */
export async function runSmallBalanceWriteOffs(
  lines: readonly SmallBalanceLine[],
  writeOff: (line: SmallBalanceLine) => Promise<{ number: string }>,
  onProgress?: (done: number, total: number) => void
): Promise<WriteOffResult[]> {
  const results: WriteOffResult[] = [];
  for (const line of lines) {
    try {
      const saved = await writeOff(line);
      results.push({ line, ok: true, number: saved.number, error: null });
    } catch (error) {
      // The database's wording decides 'already written off'; staff read it in plain words (owner, 13 Oct 2026)
      const raw = error instanceof Error && error.message ? error.message : 'The write-off was not saved';
      results.push(isAlreadyWrittenOff(raw)
        ? { line, ok: true, number: null, error: null }
        : { line, ok: false, number: null, error: plainWords(raw) });
    }
    onProgress?.(results.length, lines.length);
  }
  return results;
}

const nad = (cents: number): string => formatNad(fromCents(cents));
const balances = (count: number): string => `${count} ${count === 1 ? 'balance' : 'balances'}`;

export interface RunOutcome {
  doneCount: number;
  doneCents: number;
  failed: WriteOffResult[];
  failedCents: number;
  /** One sentence for the result screen, never quiet about a refusal */
  headline: string;
}

export function runOutcome(results: readonly WriteOffResult[]): RunOutcome {
  const done = results.filter(result => result.ok);
  const failed = results.filter(result => !result.ok);
  const doneCents = done.reduce((sum, result) => sum + result.line.amountCents, 0);
  const failedCents = failed.reduce((sum, result) => sum + result.line.amountCents, 0);
  const headline = failed.length === 0
    ? `Written off ${balances(done.length)}: ${nad(doneCents)}.`
    : done.length === 0
      ? `Nothing was written off: the database refused all ${balances(failed.length)} (${nad(failedCents)}). The reasons are below.`
      : `Written off ${done.length} of ${balances(results.length)} (${nad(doneCents)}). ${balances(failed.length)} (${nad(failedCents)}) ${failed.length === 1 ? 'was' : 'were'} not: the reasons are below.`;
  return { doneCount: done.length, doneCents, failed, failedCents, headline };
}

// ---------------------------------------------------------------------------------------------
// Runs afterwards: the write-offs grouped by their run tag, newest run first
// ---------------------------------------------------------------------------------------------

export interface SmallBalanceRunLine {
  adjustmentId: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string;
  patientId: string | null;
  amountCents: number;
  reversed: boolean;
}

export interface SmallBalanceRun {
  runId: string;
  /** When the first write-off of the run was saved (ISO) */
  at: string;
  by: string | null;
  reason: string;
  lines: SmallBalanceRunLine[];
  /** Written off and still standing (reversed ones are owed again) */
  totalCents: number;
  reversedCount: number;
}

export function groupSmallBalanceRuns(rows: ReadonlyArray<{ adjustment: ArAdjustment; externalRef: string | null; invoiceNumber: string | null }>): SmallBalanceRun[] {
  const runs = new Map<string, SmallBalanceRun>();
  for (const { adjustment, externalRef, invoiceNumber } of rows) {
    const ref = parseSmallBalanceRef(externalRef);
    if (!ref || adjustment.kind !== 'write_off' || !adjustment.invoiceId) continue;
    const at = adjustment.createdAt ?? '';
    const run = runs.get(ref.runId) ?? { runId: ref.runId, at, by: adjustment.createdBy, reason: adjustment.reason, lines: [], totalCents: 0, reversedCount: 0 };
    if (at && (!run.at || at < run.at)) run.at = at;
    const reversed = adjustment.reversal !== null;
    run.lines.push({
      adjustmentId: adjustment.id,
      number: adjustment.number,
      invoiceId: adjustment.invoiceId,
      invoiceNumber: invoiceNumber?.trim() || adjustment.invoiceId.slice(0, 8),
      patientId: adjustment.patientId,
      amountCents: adjustment.amountCents,
      reversed
    });
    if (reversed) run.reversedCount += 1;
    else run.totalCents += adjustment.amountCents;
    runs.set(ref.runId, run);
  }
  return [...runs.values()]
    .map(run => ({ ...run, lines: [...run.lines].sort((a, b) => a.number.localeCompare(b.number)) }))
    .sort((a, b) => b.at.localeCompare(a.at));
}
