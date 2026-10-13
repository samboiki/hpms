/**
 * Rows that only carry invoices (payment plan instalments, package sales, Eminance opening balances) are not visits
 * (proposals/2026-10-13-billing-extras-followup.sql). One rule, automation_source 'system', is shared by the database
 * (public.visit_is_carrier) and the app (src/utils/carrierVisits.ts). These tests keep the two the same, keep every place
 * that counts visits on that rule, and fail when the rule is copied somewhere instead. Invented rows only.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CARRIER_VISIT_SOURCE, EXCLUDE_CARRIER_VISITS, isCarrierVisit } from '../carrierVisits';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

/** What PostgREST does with an `or` list of `column.is.null` and `column.neq.value` (the two filters the rule uses) */
const kept = (filter: string, row: Record<string, string | null>): boolean =>
  filter.split(',').some(part => {
    const [column, operator, ...rest] = part.split('.');
    const value = rest.join('.');
    if (operator === 'is' && value === 'null') return row[column] === null;
    // As in SQL, NULL <> 'system' is not true: a neq on its own would drop every visit without a source
    if (operator === 'neq') return row[column] !== null && row[column] !== value;
    throw new Error(`A filter the rule does not use: ${part}`);
  });

describe('a row that only carries invoices', () => {
  it('is told apart by automation_source system, and only by it', () => {
    expect(isCarrierVisit({ automation_source: CARRIER_VISIT_SOURCE })).toBe(true);
    for (const source of [null, undefined, 'template', 'manual', 'System', '']) {
      expect(isCarrierVisit({ automation_source: source })).toBe(false);
    }
  });

  it('is left out of a visits query, while visits without a source (nearly all of them) stay', () => {
    const sources = [null, 'template', 'manual', CARRIER_VISIT_SOURCE];
    expect(sources.filter(source => kept(EXCLUDE_CARRIER_VISITS, { automation_source: source }))).toEqual([null, 'template', 'manual']);
  });

  it('follows the same rule in the database, and both features that make such rows write it', () => {
    const rule = /FUNCTION public\.visit_is_carrier\(p_automation_source text\)[\s\S]*?IS NOT DISTINCT FROM '([^']+)'/.exec(
      read('proposals/2026-10-13-billing-extras-followup.sql')
    );
    expect(rule?.[1]).toBe(CARRIER_VISIT_SOURCE);
    expect(read('proposals/2026-10-13-billing-extras.sql')).toContain(`p_subtype, '${CARRIER_VISIT_SOURCE}', p_note)`);
    expect(read('proposals/2026-10-07-eminance-import.sql')).toContain(`'eminance_opening_balance', '${CARRIER_VISIT_SOURCE}',`);
  });
});

// Every place in the app that counts visits, or asks whether a patient was seen, and could meet such a row. The diary,
// its report, recalls, smart lists and no-shows read bookings or leave cancelled visits out, so they never meet one.
const COUNTING_PLACES = [
  'src/services/encounterAnalyticsService.ts', // Encounters > Analytics
  'src/services/encounterStatsService.ts', // the dashboard's encounter card
  'src/services/patientStatsService.ts', // the dashboard's active patients
  'src/services/dashboardStatsService.ts', // the dashboard's visit figures
  'src/services/practiceOverviewService.ts', // support's practice list: bookings this month
  'src/components/finance/financeData.ts', // Finance > Reports: appointments and attendance, doctor productivity
  'src/components/finance/practiceReports/reportBuilderService.ts', // Finance > Reports > Build a report: visits
  'src/lib/aiSearchFallback.ts', // patient search: seen recently, a condition named at a visit
  'src/components/patients/ComprehensivePatientModal.tsx' // the patient file: visits on record, the Encounters tab
];

// Every place where staff pick a visit, or that lists a patient's visits: such a row is not a visit, so it is never
// offered (a lab or imaging request, a quote's invoice or an optical lab order would land on a row nobody sees) and
// never shown as one (the record a patient or another practice receives, the history beside the visit
// being recorded).
const PICKING_PLACES = [
  'src/components/forms/AddLabRequestForm.tsx', // the visit of a lab request
  'src/components/forms/AddMediaRequestForm.tsx', // the visit of an imaging request
  'src/components/quotes/quoteService.ts', // the visit a quote is invoiced at
  'src/services/optometry/optometryService.ts', // the visit an optical lab order is billed at
  'src/services/patientRecordExportService.ts', // the record export's visit list
  'src/components/visits/PatientHistoryPanel.tsx' // previous visits beside the visit being recorded
];

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

describe('one rule, not copies', () => {
  it('every place that counts visits leaves those rows out through the shared rule', () => {
    for (const file of COUNTING_PLACES) {
      const source = read(file);
      expect(source, file).toMatch(/from '(\.\.?\/)+(utils\/)?carrierVisits'/);
      expect(/\.or\(EXCLUDE_CARRIER_VISITS\)|isCarrierVisit\(/.test(source), file).toBe(true);
    }
  });

  it('every place that offers or lists visits leaves those rows out through the shared rule', () => {
    for (const file of PICKING_PLACES) {
      const source = read(file);
      expect(source, file).toMatch(/from '(\.\.?\/)+(utils\/)?carrierVisits'/);
      expect(/\.or\(EXCLUDE_CARRIER_VISITS\)|isCarrierVisit\(/.test(source), file).toBe(true);
    }
  });

  // Vitals belong to a visit: recorded from the patient file they go on the latest real visit, never on such a row
  it("records vitals from the patient file on the latest visit, not on a row that only carries invoices", () => {
    const vitals = /<VitalsForm[\s\S]*?visitId=\{([^}]+)\}/.exec(read('src/components/patients/ComprehensivePatientModal.tsx'));
    expect(vitals?.[1]).toMatch(/^encounterVisits\[0\]/);
  });

  it('no other code tells those rows apart its own way', () => {
    const copies = sourceFiles(resolve(root, 'src'))
      .filter(path => !path.endsWith(`${join('utils', 'carrierVisits.ts')}`))
      .filter(path => {
        const source = readFileSync(path, 'utf8');
        return /automation_source[^\n]{0,80}['"]system['"]|['"]system['"][^\n]{0,80}automation_source/.test(source)
          || /Not a consultation[^\n]{0,40}\)|(i?like|includes)\([^)\n]*Not a consultation/.test(source);
      })
      .map(path => relative(root, path));
    expect(copies).toEqual([]);
  });
});
