/**
 * Average spend per patient and patients by town (parity R28; Eminance's average patient spending and patient address
 * reports): what the practice billed in a period per patient and per town, with how many patients each town has on
 * file. Billed is Finance's own figure: uncancelled invoices by invoice date, the whole invoice (medical aid and patient
 * portions), so the total is Overview's "Billed" for the same days. Whole cents.
 */
import { invoiceDateKey, isInRange, isRevenueInvoice, splitCents, type DateRange, type LedgerInvoice } from '../../../services/ledgerService';
import type { CsvCell } from '../financeExport';
import { TOWN_NOT_RECORDED } from './patientTowns';
import type { LinkedReport } from './reportTargets';

/** Invoices without a patient are kept apart (they count in the total, not in the average per patient) */
export const NO_PATIENT = '__no_patient__';
export const NO_PATIENT_LABEL = 'No patient on the invoice';

export interface PatientSpend {
  /** The patient's id, or NO_PATIENT */
  key: string;
  invoices: number;
  billedCents: number;
}

export interface SpendSummary {
  patients: PatientSpend[];
  billedCents: number;
  invoices: number;
  /** Distinct patients billed (invoices without a patient not counted) */
  patientsBilled: number;
}

/** What each patient was billed in the range, the most first */
export function spendPerPatient(invoices: readonly LedgerInvoice[], range: DateRange): SpendSummary {
  const byPatient = new Map<string, PatientSpend>();
  let billedCents = 0;
  let count = 0;
  for (const invoice of invoices) {
    if (!isRevenueInvoice(invoice) || !isInRange(invoiceDateKey(invoice), range)) continue;
    const key = invoice.patientId ?? NO_PATIENT;
    const row = byPatient.get(key) ?? { key, invoices: 0, billedCents: 0 };
    const cents = splitCents(invoice).totalCents;
    row.invoices += 1;
    row.billedCents += cents;
    byPatient.set(key, row);
    billedCents += cents;
    count += 1;
  }
  const patients = [...byPatient.values()].sort((a, b) => Number(a.key === NO_PATIENT) - Number(b.key === NO_PATIENT) || b.billedCents - a.billedCents || a.key.localeCompare(b.key));
  return { patients, billedCents, invoices: count, patientsBilled: patients.filter(row => row.key !== NO_PATIENT).length };
}

/** Billed divided by patients (or invoices), to the cent; null when there are none */
export const averageCents = (cents: number, count: number): number | null => (count > 0 ? Math.round(cents / count) : null);

export interface TownSpend {
  town: string;
  patientsOnFile: number;
  patientsBilled: number;
  invoices: number;
  billedCents: number;
}

/**
 * Per town: patients on file, patients billed in the range, invoices and what was billed. Every town with patients on
 * file is listed (a town with nobody billed still shows how many patients live there); the most billed first, towns not
 * recorded and invoices without a patient last.
 */
export function spendByTown(summary: SpendSummary, townOf: (patientId: string) => string, onFileByTown: ReadonlyMap<string, number>): TownSpend[] {
  const towns = new Map<string, TownSpend>();
  const townRow = (town: string) => {
    const row = towns.get(town) ?? { town, patientsOnFile: onFileByTown.get(town) ?? 0, patientsBilled: 0, invoices: 0, billedCents: 0 };
    towns.set(town, row);
    return row;
  };
  for (const town of onFileByTown.keys()) townRow(town);
  for (const patient of summary.patients) {
    const row = townRow(patient.key === NO_PATIENT ? NO_PATIENT_LABEL : townOf(patient.key));
    if (patient.key !== NO_PATIENT) row.patientsBilled += 1;
    row.invoices += patient.invoices;
    row.billedCents += patient.billedCents;
  }
  const rank = (town: string) => (town === NO_PATIENT_LABEL ? 2 : town === TOWN_NOT_RECORDED ? 1 : 0);
  return [...towns.values()].sort((a, b) => rank(a.town) - rank(b.town) || b.billedCents - a.billedCents || b.patientsOnFile - a.patientsOnFile || a.town.localeCompare(b.town));
}

const amount = (cents: number | null): number | null => (cents === null ? null : cents / 100);

/** One row per town; a row lists the patients of that town */
export function townSpendTable(rows: readonly TownSpend[], summary: SpendSummary, input: { basis: string; notes: string[] }): LinkedReport & { keys: string[] } {
  const onFile = rows.reduce((sum, row) => sum + row.patientsOnFile, 0);
  return {
    table: {
      title: 'Spend and patients by town',
      basis: input.basis,
      columns: [
        { header: 'Town', type: 'text' },
        { header: 'Patients on file', type: 'count' },
        { header: 'Patients billed', type: 'count' },
        { header: 'Invoices', type: 'count' },
        { header: 'Billed', type: 'money' },
        { header: 'Average per patient', type: 'money' },
        { header: 'Share of billed', type: 'percent' }
      ],
      rows: rows.map(row => [
        row.town,
        row.patientsOnFile,
        row.patientsBilled,
        row.invoices,
        amount(row.billedCents),
        amount(averageCents(row.billedCents, row.patientsBilled)),
        summary.billedCents !== 0 ? row.billedCents / summary.billedCents : null
      ] as CsvCell[]),
      totals: [
        'Total', onFile, summary.patientsBilled, summary.invoices, amount(summary.billedCents),
        amount(averageCents(summary.billedCents - (summary.patients.find(row => row.key === NO_PATIENT)?.billedCents ?? 0), summary.patientsBilled)),
        summary.billedCents !== 0 ? 1 : null
      ],
      notes: input.notes
    },
    targets: rows.map(() => null),
    keys: rows.map(row => row.town)
  };
}

/** One row per patient billed: town, invoices, billed and the average invoice; each opens the patient's file */
export function patientSpendTable(
  patients: readonly PatientSpend[],
  input: { basis: string; notes: string[]; nameOf: (patientId: string) => string; townOf: (patientId: string) => string }
): LinkedReport {
  const rows = patients.filter(row => row.key !== NO_PATIENT);
  const billed = rows.reduce((sum, row) => sum + row.billedCents, 0);
  const invoices = rows.reduce((sum, row) => sum + row.invoices, 0);
  return {
    table: {
      title: 'Spend per patient',
      basis: input.basis,
      columns: [
        { header: 'Patient', type: 'text' },
        { header: 'Town', type: 'text' },
        { header: 'Invoices', type: 'count' },
        { header: 'Billed', type: 'money' },
        { header: 'Average per invoice', type: 'money' }
      ],
      rows: rows.map(row => [input.nameOf(row.key), input.townOf(row.key), row.invoices, amount(row.billedCents), amount(averageCents(row.billedCents, row.invoices))] as CsvCell[]),
      totals: ['Total', `${rows.length} patients`, invoices, amount(billed), amount(averageCents(billed, invoices))],
      notes: input.notes
    },
    targets: rows.map(row => ({ kind: 'patient' as const, id: row.key })),
    names: rows.map(row => input.nameOf(row.key))
  };
}
