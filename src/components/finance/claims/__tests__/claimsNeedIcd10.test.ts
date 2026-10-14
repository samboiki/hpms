/**
 * The database guard that keeps a batch from being marked as sent while a line has no usable main ICD-10 code
 * (proposals/2026-10-14-claims-need-icd10.sql) and the app have to mean the same things. If the guard's idea of "not sent
 * yet" drifted from the app's (isOpenBatch), a batch could slip into "sent" unchecked, or the app could email a file the
 * database then refuses to record. These tests read the proposal, the way claimPractitioner.test.ts reads the database's
 * other claim rules, and fail as soon as the two disagree.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_ORDER } from '../../../../../scripts/db/rehearsal';
import { OPEN_BATCH_STATUSES } from '../status';

const PROPOSAL = 'proposals/2026-10-14-claims-need-icd10.sql';
const sql = (): string => readFileSync(PROPOSAL, 'utf8');

/** Every status list written as IN ('a', 'b', ...) next to a batch's status in the proposal */
const statusLists = (text: string): string[][] =>
  [...text.matchAll(/COALESCE\((?:OLD|NEW)\.status, 'active'\)\) IN \(([^)]*)\)/g)].map(match =>
    match[1].split(',').map(word => word.trim().replace(/'/g, '')).sort()
  );

describe('the guard on batch_headers and the app agree', () => {
  it('the proposal exists and is rehearsed with the others, before the patient app file', () => {
    expect(existsSync(PROPOSAL)).toBe(true);
    const at = DEFAULT_ORDER.indexOf(PROPOSAL);
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(DEFAULT_ORDER.indexOf('proposals/2026-10-07-patient-portal.sql'));
  });

  it('"not sent yet" means the statuses the app calls open, in the trigger and in the function it fires', () => {
    const lists = statusLists(sql());
    // the trigger's WHEN clause (before the change) and the trigger function (after the change)
    expect(lists).toHaveLength(2);
    lists.forEach(list => expect(list).toEqual([...OPEN_BATCH_STATUSES].sort()));
  });

  it('the app asks the function the proposal creates, with the argument it takes', () => {
    const service = readFileSync('src/components/finance/claims/claimsService.ts', 'utf8');
    expect(service).toMatch(/\.rpc\('claim_batch_icd10_gaps', \{ p_batch_id: batchId \}\)/);
    expect(sql()).toMatch(/CREATE OR REPLACE FUNCTION public\.claim_batch_icd10_gaps\(p_batch_id uuid\)/);
  });

  // The helper and the trigger function are the database's own; the public key must reach none of them, and signed-in
  // users only the question the app asks. prepare_batch_for_sending built a claim file with no ICD-10 check at all.
  it('closes what the app must not call and opens only the question the app asks', () => {
    const text = sql();
    expect(text).toMatch(/REVOKE ALL ON FUNCTION public\.claim_main_icd10_ok\(text, text\) FROM PUBLIC, anon, authenticated;/);
    expect(text).toMatch(/REVOKE ALL ON FUNCTION public\.claim_batch_sent_needs_icd10\(\) FROM PUBLIC, anon, authenticated;/);
    expect(text).toMatch(/REVOKE ALL ON FUNCTION public\.claim_batch_icd10_gaps\(uuid\) FROM PUBLIC, anon;/);
    expect(text).toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_batch_icd10_gaps\(uuid\) TO authenticated, service_role;/);
    expect(text).toMatch(/REVOKE EXECUTE ON FUNCTION public\.prepare_batch_for_sending\(uuid\) FROM PUBLIC, anon, authenticated;/);
  });

  it('nothing in the app calls prepare_batch_for_sending any more (only a comment in claimFile.ts names it)', () => {
    const claimFile = readFileSync('src/utils/billing/claimFile.ts', 'utf8');
    const callers = claimFile.split('\n').filter(line => line.includes('prepare_batch_for_sending') && !line.trim().startsWith('*') && !line.trim().startsWith('//'));
    expect(callers).toEqual([]);
  });
});
