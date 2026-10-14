/**
 * The database's refusal to mark a claim batch as sent without ICD-10 codes tells staff where to go, and it must name a place
 * that exists: Finance has no Claims tab (its tabs are Overview, Invoicing, Quotes, Payments, Debtors, Ledgers, Reports,
 * Batches and Remittances; src/__tests__/screenNamesInText.test.ts keeps the app's own text to them). The first version of
 * the guard said "Finance > Claims"; proposals/2026-10-14-claims-guard-wording.sql replaced it in place, so this reads the
 * words the database now holds. If the first file is rehearsed after the second the old words would come back, so the order
 * is kept too.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER } from '../../../../../scripts/db/rehearsal';

const WORDING = 'proposals/2026-10-14-claims-guard-wording.sql';
const GUARD = 'proposals/2026-10-14-claims-need-icd10.sql';

describe("the guard's refusal names a tab Finance has", () => {
  it('says Finance > Batches, and the Batches tab is there', () => {
    const text = readFileSync(WORDING, 'utf8');
    const refusal = text.match(/RAISE EXCEPTION '([^']*)'/)?.[1] ?? '';
    expect(refusal).toContain('Add and save the codes in Finance > Batches first.');
    expect(refusal).not.toContain('Finance > Claims');
    // The tab bar's own labels: Batches is one, Claims is not
    const tabs = readFileSync('src/components/finance/FinanceTabBar.tsx', 'utf8');
    expect(tabs).toContain("label: 'Batches'");
    expect(tabs).not.toContain("label: 'Claims'");
  });

  it('replaces the guard function and nothing else: same name, same privileges, no new trigger or table', () => {
    const body = readFileSync(WORDING, 'utf8').split(/^BEGIN;$/m)[1].split(/^ROLLBACK;/m)[0];
    expect(body).toMatch(/CREATE OR REPLACE FUNCTION public\.claim_batch_sent_needs_icd10\(\)/);
    expect(body).toMatch(/REVOKE ALL ON FUNCTION public\.claim_batch_sent_needs_icd10\(\) FROM PUBLIC, anon, authenticated;/);
    expect(body).not.toMatch(/GRANT |CREATE TRIGGER|CREATE TABLE|ALTER TABLE|DROP /i);
  });

  it('is rehearsed after the file that first creates the guard, before the patient app file', () => {
    expect(DEFAULT_ORDER.indexOf(WORDING)).toBeGreaterThan(DEFAULT_ORDER.indexOf(GUARD));
    expect(DEFAULT_ORDER.indexOf(WORDING)).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });
});
