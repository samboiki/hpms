/**
 * Which practitioner a claim line names (claim field 36, their HPCNA number; field 29, their practice number). The
 * database builds the claim line (claim_invoice_into_batch) and corrects a sent one (claim_line_correct); the app writes
 * the claim file (buildClaimLines) and offers "Correct and send again". If they named different practitioners, the fund
 * would be paid for one practitioner's work under another's number, and a correction would treat the wrong one as what
 * was sent. These tests read the database's rule from the latest proposal that defines it, in the order the proposals
 * are applied, and fail as soon as it and the app's rule (claimedPractitionerOf) disagree. Invented values only.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER } from '../../../../../scripts/db/rehearsal';
import { claimedPractitionerOf } from '../../../../utils/billing/claimLine';
import { buildClaimLines } from '../buildClaimLines';
import type { BatchDetailRow, BatchLineSources } from '../types';

/** The last statement matching `pattern` in the last proposal (in apply order) that has one: the live definition */
function latestStatement(pattern: RegExp): { file: string; args: string[] } {
  for (const file of [...DEFAULT_ORDER].reverse()) {
    if (!existsSync(file)) continue;
    const matches = [...readFileSync(file, 'utf8').matchAll(pattern)];
    if (matches.length > 0) {
      return { file, args: matches[matches.length - 1][1].split(',').map(arg => arg.trim()) };
    }
  }
  throw new Error(`No proposal defines ${pattern}`);
}

// The database's sources, in its own words, mapped to the app's: the invoice line, then the invoice
const DATABASE_SOURCES: Record<string, 'line' | 'invoice'> = {
  'v_service.practitioner_id': 'line',
  'CASE WHEN v_has_line THEN v_line.practitioner_id END': 'line',
  'v_invoice.practitioner_id': 'invoice'
};

/** The app's rule, asked which source wins when both are known and which stands in when the line has none */
const appOrder = (): Array<'line' | 'invoice'> => [
  claimedPractitionerOf('line', 'invoice') === 'line' ? 'line' : 'invoice',
  claimedPractitionerOf(null, 'invoice') === 'invoice' ? 'invoice' : 'line'
];

describe('the practitioner a claim line names: the database and the app agree', () => {
  it('builds every claim line by the rule the claim file uses', () => {
    const { file, args } = latestStatement(/v_line_practitioner := COALESCE\(([^;]*)\);/g);
    expect(args.map(arg => DATABASE_SOURCES[arg]), file).toEqual(appOrder());
  });

  it('corrects a sent line from the same practitioner', () => {
    const { file, args } = latestStatement(/v_pract := COALESCE\((CASE WHEN v_has_line THEN v_line\.practitioner_id END, [^;]*)\);/g);
    expect([args[0], args.slice(1).join(', ')].map(arg => DATABASE_SOURCES[arg]), file).toEqual(appOrder());
  });

  it("writes the invoice's practitioner into the claim file for a line without its own, whatever the visit says", () => {
    const detail = { id: 'd1', invoice_id: 'inv-1', visit_id: 'visit-1', patient_id: null, transaction_number_in_batch: 1, bhf_tariff_code: '0190', service_amount: 450, treating_doctor_hpcsa_number: 'MP00999', practice_number: '0123456' } as unknown as BatchDetailRow;
    const sources: BatchLineSources = {
      details: [detail],
      patients: new Map(),
      medicalAid: new Map(),
      visits: new Map([['visit-1', { id: 'visit-1', visit_date: '2026-10-01', doctor_id: 'visit-doctor', diagnosis: null }]]),
      doctors: new Map([
        ['visit-doctor', { id: 'visit-doctor', full_name: 'Dr Visit Example', hpcsa_number: 'MP00111' }],
        ['invoice-doctor', { id: 'invoice-doctor', full_name: 'Dr Invoice Example', hpcsa_number: 'MP00222' }],
        ['line-doctor', { id: 'line-doctor', full_name: 'Dr Line Example', hpcsa_number: 'MP00333' }]
      ]),
      invoiceServices: [{ id: 's1', invoice_id: 'inv-1', code: '0190', unit_price: 450, quantity: 1, total_price: 450, tooth_number: null, system_transaction_number: 1, practitioner_id: null }],
      invoicePractitioners: new Map([['inv-1', 'invoice-doctor']]),
      tariffRows: [],
      warnings: []
    };
    expect(buildClaimLines(sources, {})[0].treatingDoctorHpcnaNumber).toBe('MP00222');
    const withOwn = { ...sources, invoiceServices: [{ ...sources.invoiceServices[0], practitioner_id: 'line-doctor' }] };
    expect(buildClaimLines(withOwn, {})[0].treatingDoctorHpcnaNumber).toBe('MP00333');
  });
});
