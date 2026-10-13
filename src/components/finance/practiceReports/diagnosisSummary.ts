/**
 * ICD-10 diagnosis summaries (parity R30): per practitioner, how many visits each code was the main diagnosis of
 * (the line's main code, the "master diagnosis") and how many visits carried it on any line (main or additional
 * codes), with how many patients. The same rule as Encounters > Analytics > Diagnoses (topDiagnoses): the codes on the
 * lines of invoices dated in the period, cancelled invoices left out, a visit counted once per code. A line's
 * practitioner is its own, else its invoice's (the rule claims use).
 */
import type { CsvCell } from '../financeExport';
import { staffName, type LinkedReport, type StaffNames } from './reportTargets';

/** An invoice line with its codes, its practitioner and its invoice (invoice_services joined to invoices_enhanced) */
export interface DiagnosisLineRow {
  icd10_primary: string | null;
  icd10_secondary: string[] | null;
  practitioner_id: string | null;
  invoice: {
    id: string;
    visit_id: string | null;
    patient_id: string | null;
    practitioner_id: string | null;
    payment_status: string | null;
  } | null;
}

export const NO_PRACTITIONER = 'none';

export interface DiagnosisRow {
  /** A practitioner's user id, NO_PRACTITIONER, or '' for the whole practice */
  practitioner: string;
  code: string;
  /** Visits where the code was a line's main code */
  mainVisitIds: string[];
  /** Visits where the code was on any line, main or additional */
  anyVisitIds: string[];
  patients: number;
}

export interface DiagnosisSummary {
  /** Per practitioner and code */
  rows: DiagnosisRow[];
  /** Per code for the whole practice (a visit with two practitioners counts once) */
  practice: DiagnosisRow[];
  /** Coded lines on invoices without a visit: not counted (the analytics counts visits) */
  linesWithoutVisit: number;
}

/** A code as the analytics compares it (topDiagnoses: trimmed, capitals) */
const codeOf = (code: string | null | undefined): string => (code ?? '').trim().toUpperCase();

interface Group {
  practitioner: string;
  code: string;
  main: Set<string>;
  any: Set<string>;
  patients: Set<string>;
}

const toRow = (group: Group): DiagnosisRow => ({
  practitioner: group.practitioner,
  code: group.code,
  mainVisitIds: [...group.main],
  anyVisitIds: [...group.any],
  patients: group.patients.size
});

const byUse = (a: DiagnosisRow, b: DiagnosisRow): number =>
  b.anyVisitIds.length - a.anyVisitIds.length || b.mainVisitIds.length - a.mainVisitIds.length || a.code.localeCompare(b.code);

export function diagnosisSummary(lines: readonly DiagnosisLineRow[]): DiagnosisSummary {
  const perPractitioner = new Map<string, Group>();
  const perPractice = new Map<string, Group>();
  let linesWithoutVisit = 0;
  const groupIn = (map: Map<string, Group>, practitioner: string, code: string): Group => {
    const key = `${practitioner}|${code}`;
    const group = map.get(key) ?? { practitioner, code, main: new Set<string>(), any: new Set<string>(), patients: new Set<string>() };
    map.set(key, group);
    return group;
  };

  for (const line of lines) {
    const invoice = line.invoice;
    // A cancelled invoice billed nothing
    if (!invoice || (invoice.payment_status ?? '').trim().toLowerCase() === 'cancelled') continue;
    const main = codeOf(line.icd10_primary);
    const all = [...new Set([main, ...(line.icd10_secondary ?? []).map(codeOf)].filter(Boolean))];
    if (all.length === 0) continue;
    if (!invoice.visit_id) {
      linesWithoutVisit += 1;
      continue;
    }
    const practitioner = line.practitioner_id ?? invoice.practitioner_id ?? NO_PRACTITIONER;
    for (const code of all) {
      for (const group of [groupIn(perPractitioner, practitioner, code), groupIn(perPractice, '', code)]) {
        group.any.add(invoice.visit_id);
        if (code === main) group.main.add(invoice.visit_id);
        if (invoice.patient_id) group.patients.add(invoice.patient_id);
      }
    }
  }

  return {
    rows: [...perPractitioner.values()].map(toRow).sort((a, b) => a.practitioner.localeCompare(b.practitioner) || byUse(a, b)),
    practice: [...perPractice.values()].map(toRow).sort(byUse),
    linesWithoutVisit
  };
}

export const practitionerOf = (key: string, names: StaffNames): string =>
  key === NO_PRACTITIONER ? 'No practitioner recorded' : staffName(key, names, 'Practitioner not on the staff list');

export const DIAGNOSIS_NOTES = [
  'Main diagnosis: the visits where the code was a line\'s main ICD-10 code. On any line: the visits where it was a main or an additional code. A visit counts once per code.',
  'The codes on the lines of invoices dated in the period; cancelled invoices are left out. A line counts for its own practitioner, else the invoice\'s.'
];

export interface DiagnosisTableInput {
  rows: readonly DiagnosisRow[];
  periodLabel: string;
  descriptions: ReadonlyMap<string, string>;
  names: StaffNames;
  /** Per practitioner (true) or for the whole practice */
  perPractitioner: boolean;
  linesWithoutVisit: number;
}

/** The summary; each row opens its visits */
export function diagnosisTable({ rows, periodLabel, descriptions, names, perPractitioner, linesWithoutVisit }: DiagnosisTableInput): LinkedReport {
  const notes = [...DIAGNOSIS_NOTES];
  if (linesWithoutVisit > 0) notes.push(`${linesWithoutVisit} coded line${linesWithoutVisit === 1 ? ' is' : 's are'} on invoices without a visit and not counted.`);
  return {
    table: {
      title: perPractitioner ? 'ICD-10 diagnoses by practitioner' : 'ICD-10 diagnoses, whole practice',
      basis: `Invoices dated ${periodLabel}`,
      columns: [
        ...(perPractitioner ? [{ header: 'Practitioner', type: 'text' as const }] : []),
        { header: 'ICD-10 code', type: 'text' },
        { header: 'Description', type: 'text' },
        { header: 'Main diagnosis (visits)', type: 'count' },
        { header: 'On any line (visits)', type: 'count' },
        { header: 'Patients', type: 'count' }
      ],
      rows: rows.map(row => [
        ...(perPractitioner ? [practitionerOf(row.practitioner, names)] : []),
        row.code,
        descriptions.get(row.code) ?? 'Not in the ICD-10 list',
        row.mainVisitIds.length,
        row.anyVisitIds.length,
        row.patients
      ] as CsvCell[]),
      notes
    },
    targets: rows.map(row => ({
      kind: 'visits' as const,
      ids: row.anyVisitIds,
      label: `${perPractitioner ? `${practitionerOf(row.practitioner, names)}: ` : ''}diagnosis ${row.code}, ${periodLabel}`
    })),
    names: rows.map(row => (perPractitioner ? `${practitionerOf(row.practitioner, names)}, ${row.code}` : row.code))
  };
}
