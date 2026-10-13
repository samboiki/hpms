/** Finance > Reports > ICD-10 diagnoses (parity R30). Invented ids and codes only. */
import { describe, expect, it } from 'vitest';
import { topDiagnoses } from '../../../../utils/encounters/encounterAnalytics';
import { NO_PRACTITIONER, diagnosisSummary, diagnosisTable, type DiagnosisLineRow } from '../diagnosisSummary';

const line = (overrides: Partial<DiagnosisLineRow> & { visit?: string | null; patient?: string; invoicePractitioner?: string | null; status?: string }): DiagnosisLineRow => ({
  icd10_primary: overrides.icd10_primary ?? 'J06.9',
  icd10_secondary: overrides.icd10_secondary ?? [],
  practitioner_id: overrides.practitioner_id ?? null,
  invoice: {
    id: `inv-${overrides.visit ?? 'none'}`,
    visit_id: overrides.visit === undefined ? 'v1' : overrides.visit,
    patient_id: overrides.patient ?? 'p1',
    practitioner_id: overrides.invoicePractitioner === undefined ? 'drA' : overrides.invoicePractitioner,
    payment_status: overrides.status ?? 'pending'
  }
});

describe('ICD-10 diagnosis summaries (R30)', () => {
  const lines: DiagnosisLineRow[] = [
    line({ visit: 'v1', patient: 'p1', icd10_primary: 'J06.9', icd10_secondary: ['R50.9'] }),
    line({ visit: 'v1', patient: 'p1', icd10_primary: 'j06.9 ' }), // the same visit again, typed in small letters
    line({ visit: 'v2', patient: 'p2', icd10_primary: 'R50.9' }),
    line({ visit: 'v3', patient: 'p2', icd10_primary: 'J06.9', practitioner_id: 'drB' }), // a colleague treated this line
    line({ visit: 'v4', patient: 'p3', icd10_primary: 'J06.9', status: 'cancelled' }),
    line({ visit: null, patient: 'p4', icd10_primary: 'J06.9' }),
    line({ visit: 'v5', patient: 'p5', icd10_primary: 'K02.9', invoicePractitioner: null })
  ];
  const summary = diagnosisSummary(lines);
  const row = (practitioner: string, code: string) => summary.rows.find(r => r.practitioner === practitioner && r.code === code);

  it('counts a visit once per code, however many lines carry it, as Encounters > Analytics does', () => {
    expect(row('drA', 'J06.9')?.anyVisitIds).toEqual(['v1']);
    const practice = new Map(summary.practice.map(r => [r.code, r.anyVisitIds.length]));
    for (const top of topDiagnoses(lines, 100)) expect(practice.get(top.code)).toBe(top.visitIds.length);
  });

  it('tells the main diagnosis apart from codes that were only additional', () => {
    expect(row('drA', 'R50.9')).toMatchObject({ mainVisitIds: ['v2'], anyVisitIds: ['v1', 'v2'], patients: 2 });
  });

  it('credits a line to its own practitioner before the invoice\'s, and names a missing one instead of dropping it', () => {
    expect(row('drB', 'J06.9')?.anyVisitIds).toEqual(['v3']);
    expect(row(NO_PRACTITIONER, 'K02.9')?.anyVisitIds).toEqual(['v5']);
  });

  it('leaves out cancelled invoices and says how many coded lines had no visit to count', () => {
    expect(summary.practice.find(r => r.code === 'J06.9')?.anyVisitIds.sort()).toEqual(['v1', 'v3']);
    expect(summary.linesWithoutVisit).toBe(1);
    const table = diagnosisTable({ rows: summary.rows, periodLabel: 'Oct 2026', descriptions: new Map([['J06.9', 'Acute upper respiratory infection']]), names: { drA: 'Practitioner A' }, perPractitioner: true, linesWithoutVisit: 1 });
    expect(table.table.notes?.[table.table.notes.length - 1]).toBe('1 coded line is on invoices without a visit and not counted.');
  });

  it('opens each row\'s own visits, and says when a code is not in the funds\' ICD-10 list', () => {
    const table = diagnosisTable({ rows: summary.rows, periodLabel: 'Oct 2026', descriptions: new Map(), names: {}, perPractitioner: false, linesWithoutVisit: 0 });
    expect(table.targets[0]).toMatchObject({ kind: 'visits' });
    expect(table.table.rows[0][1]).toBe('Not in the ICD-10 list');
  });
});
