/**
 * Opening balances from Eminance's age analysis.
 *
 * Eminance ages each account's unpaid lines by transaction date into Current (0-29 days), 30, 60, 90, 120, 150 and
 * 180+ days, and shows money received but not yet allocated to a line separately (UNALLOCATED, a credit). It runs
 * for both portions or for "medical aid only" / "patient only". OneHealth's age bands are the same
 * (AGE_BANDS in src/services/ledger/receivables.ts), so each band becomes one opening balance dated back from the day
 * the age analysis was run, and lands in the same band.
 *
 * Credit is set off against the account's own debts, oldest first, as Eminance's "auto allocate all" does when an
 * account is converted. What is left (an account in credit) is not brought over: a receipt can never be deleted,
 * so the import could no longer be undone. The wizard lists those accounts for the practice to refund or record.
 */
import { zeroBands, type BandCents } from '../../services/ledger/ageAnalysis';
import { AGE_BANDS, type AgeBand } from '../../services/ledger/receivables';
import { addDaysToKey } from '../billing/dates';
import type { Cell } from '../billing/tariffImport';
import { BAND_FIELDS, type ColumnMapping } from './eminanceFields';
import type { RowProblem } from './eminancePeople';
import { canonicalAccountNumber, cleanText, parseMoneyCents } from './importValues';
import type { ImportTable } from './tableFile';

export type { BandCents };

/** Which part of each account the file holds: Eminance's age analysis is run for both portions or for one */
export type BalancePortion = 'both' | 'medical_aid' | 'patient';

const FIELD_BAND: Readonly<Record<(typeof BAND_FIELDS)[number], AgeBand>> = {
  current: 'current',
  days30: 'days_30',
  days60: 'days_60',
  days90: 'days_90',
  days120: 'days_120',
  days150: 'days_150',
  days180: 'days_180_plus'
};

export interface BalanceRow {
  key: string;
  fileName: string;
  line: number;
  accountNumber: string;
  /** The debtor's name as the report shows it (for the screens only) */
  name: string | null;
  bands: BandCents;
  /** Money Eminance holds for the account and has not allocated: a credit, as a positive number */
  creditCents: number;
  totalCents: number | null;
  problems: RowProblem[];
}

export const sumBands = (bands: BandCents): number => AGE_BANDS.reduce((total, band) => total + bands[band.key], 0);

const cellAt = (cells: readonly Cell[], mapping: ColumnMapping, key: keyof ColumnMapping): Cell =>
  mapping[key] === undefined ? null : cells[mapping[key] as number];

/** One account per row of an age analysis. A negative amount in an age column is credit too. */
export function readBalances(table: ImportTable, mapping: ColumnMapping, options: { fileName: string; fileIndex: number }): BalanceRow[] {
  return table.rows.map(row => {
    const problems: RowProblem[] = [];
    const accountNumber = canonicalAccountNumber(cellAt(row.cells, mapping, 'accountNumber'));
    if (!accountNumber) problems.push({ message: 'No account number', blocking: true });
    else if (/^(SUB)?TOTALS?\b|^GRANDTOTAL/.test(accountNumber)) problems.push({ message: 'A total line, not an account', blocking: true });
    else if (accountNumber.length > 20) problems.push({ message: 'The account number is longer than 20 characters', blocking: true });

    const bands = zeroBands();
    let creditCents = 0;
    for (const field of BAND_FIELDS) {
      const cents = parseMoneyCents(cellAt(row.cells, mapping, field));
      if (cents === null) continue;
      if (cents < 0) creditCents += -cents;
      else bands[FIELD_BAND[field]] += cents;
    }
    const unallocated = parseMoneyCents(cellAt(row.cells, mapping, 'unallocated'));
    if (unallocated !== null) creditCents += Math.abs(unallocated);
    const totalCents = parseMoneyCents(cellAt(row.cells, mapping, 'total'));

    // Eminance's total is the age columns plus the (negative) unallocated credit; some reports leave the credit out
    const owed = sumBands(bands);
    if (totalCents !== null && Math.abs(owed - creditCents - totalCents) > 1 && Math.abs(owed - totalCents) > 1) {
      problems.push({ message: `The total (${(totalCents / 100).toFixed(2)}) does not match the age columns (${(owed / 100).toFixed(2)}); the age columns are used`, blocking: false });
    }
    const name = cleanText(cellAt(row.cells, mapping, 'fullName'), 100);
    return {
      key: `b:${options.fileIndex}:${row.line}`,
      fileName: options.fileName,
      line: row.line,
      accountNumber,
      name: name || null,
      bands,
      creditCents,
      totalCents,
      problems
    };
  });
}

/** Credit used to pay the oldest debts first; returns what each band still owes and the credit left over */
export function setOffCredit(bands: BandCents, creditCents: number): { bands: BandCents; creditLeftCents: number } {
  const left = { ...bands };
  let credit = Math.max(creditCents, 0);
  for (const band of [...AGE_BANDS].reverse()) {
    const used = Math.min(credit, left[band.key]);
    left[band.key] -= used;
    credit -= used;
  }
  return { bands: left, creditLeftCents: credit };
}

export interface AccountBalance {
  accountNumber: string;
  name: string | null;
  patient: BandCents;
  medicalAid: BandCents;
  /** Credit set off against the account's debts */
  creditUsedCents: number;
  /** Credit Eminance holds beyond what the account owes: not brought over */
  creditLeftCents: number;
  warnings: string[];
}

/**
 * Every account's opening balance by portion and band, from one or more age analysis files. Credit is set off within
 * the file it is in (a "medical aid only" file holds the fund's unallocated money). A file with both portions is put on
 * the portion `ownerOfBoth` gives for the account. The same account twice in one file (an age analysis per
 * practitioner) is added up.
 */
export function combineBalances(
  files: ReadonlyArray<{ fileName: string; rows: readonly BalanceRow[]; portion: BalancePortion }>,
  ownerOfBoth: (accountNumber: string) => 'patient' | 'medical_aid'
): AccountBalance[] {
  const accounts = new Map<string, AccountBalance>();
  // account -> portion -> the files it is in: the same portion in two files is added up, but may be one file added twice
  const filesOf = new Map<string, Map<BalancePortion, string[]>>();
  for (const file of files) {
    const seen = new Map<string, number>();
    for (const row of file.rows) {
      if (row.problems.some(problem => problem.blocking)) continue;
      seen.set(row.accountNumber, (seen.get(row.accountNumber) ?? 0) + 1);
      const account = accounts.get(row.accountNumber) ?? {
        accountNumber: row.accountNumber,
        name: row.name,
        patient: zeroBands(),
        medicalAid: zeroBands(),
        creditUsedCents: 0,
        creditLeftCents: 0,
        warnings: []
      };
      account.name = account.name ?? row.name;
      const { bands, creditLeftCents } = setOffCredit(row.bands, row.creditCents);
      account.creditUsedCents += row.creditCents - creditLeftCents;
      account.creditLeftCents += creditLeftCents;
      const portion = file.portion === 'both' ? ownerOfBoth(row.accountNumber) : file.portion;
      const target = portion === 'medical_aid' ? account.medicalAid : account.patient;
      for (const band of AGE_BANDS) target[band.key] += bands[band.key];
      accounts.set(row.accountNumber, account);
    }
    for (const [accountNumber, times] of seen) {
      if (times > 1) accounts.get(accountNumber)?.warnings.push(`On ${times} lines of ${file.fileName}: the amounts were added up`);
      const portions = filesOf.get(accountNumber) ?? new Map<BalancePortion, string[]>();
      portions.set(file.portion, [...(portions.get(file.portion) ?? []), file.fileName]);
      filesOf.set(accountNumber, portions);
    }
  }
  for (const [accountNumber, portions] of filesOf) {
    for (const names of portions.values()) {
      if (names.length > 1) {
        accounts.get(accountNumber)?.warnings.push(`In ${names.length} files of the same portion (${names.join(', ')}): the amounts were added up. Check the same age analysis was not added twice`);
      }
    }
  }
  return [...accounts.values()];
}

/** The date that puts a debt in this band on the "balances as at" day: 30 days back for the 30-day band */
export function openingBalanceDate(asOf: string, band: AgeBand): string {
  const minDays = AGE_BANDS.find(item => item.key === band)?.minDays ?? 0;
  return addDaysToKey(asOf, -minDays);
}
