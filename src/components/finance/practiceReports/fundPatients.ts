/**
 * A fund's patients with balances (parity R20): the age analysis (buildAgeAnalysis) per patient, with its fund filter,
 * so the list is the same money the age analysis and the medical aid age analysis show: what each patient of the fund
 * owes (the fund's part and their own), credit not allocated yet and the net, oldest debt first. Handed-over accounts
 * stay on it (the fund is still the fund); the flag shows on the account.
 */
import {
  DEFAULT_AGE_FILTER,
  accountIdOfRowKey,
  buildAgeAnalysis,
  type AgeAnalysis,
  type AgeAnalysisContext,
  type AgingReport
} from '../../../services/ledgerService';
import type { CsvCell } from '../financeExport';
import type { LinkedReport } from './reportTargets';

export interface FundChoice {
  fund: string;
  owedCents: number;
  patients: number;
}

/** The funds with something owed or credit held, the fund owed most first (the funds as recorded on patients) */
export function fundChoices(aging: AgingReport, context: AgeAnalysisContext): FundChoice[] {
  const byFund = buildAgeAnalysis(aging, { ...DEFAULT_AGE_FILTER, grouping: 'fund', portion: 'both', excludeFlags: [] }, context);
  return byFund.rows
    // A company or fund account's row is not a medical aid
    .filter(row => accountIdOfRowKey(row.key) === null)
    .map(row => ({ fund: row.key, owedCents: row.owedCents, patients: row.patientIds.length }))
    .sort((a, b) => b.owedCents - a.owedCents || a.fund.localeCompare(b.fund));
}

/** The fund's patients with balances */
export const fundPatients = (aging: AgingReport, fund: string, context: AgeAnalysisContext): AgeAnalysis =>
  buildAgeAnalysis(aging, { ...DEFAULT_AGE_FILTER, grouping: 'patient', portion: 'both', excludeFlags: [], fund }, context);

const amount = (cents: number): number => cents / 100;

/** One row per patient of the fund; each opens the patient's file */
export function fundPatientsTable(analysis: AgeAnalysis, fund: string, asOfLabel: string): LinkedReport {
  const totals = analysis.totals;
  return {
    table: {
      title: `Patients of ${fund} with balances`,
      basis: `As at ${asOfLabel}`,
      columns: [
        { header: 'Patient', type: 'text' },
        { header: 'Medical aid owes', type: 'money' },
        { header: 'Patient owes', type: 'money' },
        { header: 'Owed', type: 'money' },
        { header: 'Credit not allocated', type: 'money' },
        { header: 'Net', type: 'money' },
        { header: 'Invoices', type: 'count' },
        { header: 'Oldest debt (days)', type: 'count' }
      ],
      rows: analysis.rows.map(row => [
        row.label, amount(row.medicalAidCents), amount(row.patientCents), amount(row.owedCents), amount(row.unallocatedCents),
        amount(row.netCents), row.invoiceCount, row.oldestAgeDays
      ] as CsvCell[]),
      totals: ['Total', amount(totals.medicalAidCents), amount(totals.patientCents), amount(totals.owedCents), amount(totals.unallocatedCents), amount(totals.netCents), totals.invoiceCount, null],
      notes: [
        'The fund as recorded on each patient\'s file. What each patient of the fund owes, the fund\'s part and their own, after payments, credit notes and write-offs, oldest debt first; credit not allocated yet is netted off.',
        'Handed-over accounts are included: they are still this fund\'s patients.'
      ]
    },
    targets: analysis.rows.map(row => (row.accountId ? { kind: 'patient' as const, id: row.accountId } : null))
  };
}
