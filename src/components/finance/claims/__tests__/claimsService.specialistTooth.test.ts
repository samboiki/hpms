/**
 * Claim review asks a dental specialist for a tooth where the dentist's list does (owner, 14 Oct 2026: "Yes, copy the
 * dentist flags"). Why: the specialist's visit asks for the tooth of those codes, and a claim line without one is pended or
 * rejected by the fund, so claim review has to know the same codes the visit did. A specialist's shared list is empty (its
 * codes come from NAMAF), so the loader reads the dentist's codes for it, and for no other practice. Invented rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: { code?: string; message: string } | null };

const db = vi.hoisted(() => ({
  /** practice_tariffs_with_types rows by practice type name */
  shared: new Map<string, unknown[]>(),
  dentistError: null as { message: string } | null,
  /** The type names asked of practice_tariffs_with_types, in order */
  sharedReads: [] as string[]
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const filters: Record<string, unknown> = {};
      const builder: unknown = new Proxy(
        {},
        {
          get: (_target, key) => {
            if (key === 'then') {
              return (resolve: (value: Result) => unknown) => {
                if (table === 'practice_tariffs_with_types') {
                  const type = String(filters.practice_type_name);
                  db.sharedReads.push(type);
                  if (type === 'dental' && db.dentistError) return Promise.resolve<Result>({ data: null, error: db.dentistError }).then(resolve);
                  return Promise.resolve<Result>({ data: db.shared.get(type) ?? [], error: null }).then(resolve);
                }
                return Promise.resolve<Result>({ data: [], error: null }).then(resolve);
              };
            }
            if (key === 'eq') {
              return (column: string, value: unknown) => {
                filters[column] = value;
                return builder;
              };
            }
            if (key === 'maybeSingle' || key === 'single') return () => Promise.resolve<Result>({ data: null, error: null });
            return () => builder;
          }
        }
      );
      return builder;
    },
    rpc: () => Promise.resolve({ data: [], error: null })
  }
}));

import { clearNamafCache } from '../../../../services/namafTariffService';
import { resetInvoicingSetupCache } from '../../../../services/invoicingSetup';
import { loadBatchLineSources } from '../claimsService';
import type { BatchHeaderRow, PracticeInfo } from '../types';

const batch = { id: '5d0b6a3e-0000-4000-8000-000000000010' } as BatchHeaderRow;
const practice = (practiceType: string | null) =>
  ({ id: '5d0b6a3e-0000-4000-8000-000000000001', name: 'Invented Practice', practice_number: '0000001', practice_type: practiceType, contact_email: null }) as PracticeInfo;

const dentistRow = (code: string, flag: string) => ({
  id: `dental-${code}`,
  code,
  price: 200,
  is_active: true,
  effective_from: '2025-01-01',
  effective_to: null,
  can_be_multiplied: 'NO',
  requires_tooth_number: flag
});

beforeEach(() => {
  clearNamafCache();
  resetInvoicingSetupCache();
  db.shared = new Map([['dental', [dentistRow('8341', 'YES'), dentistRow('8501', 'YES'), dentistRow('8101', 'NO')]]]);
  db.dentistError = null;
  db.sharedReads = [];
});

describe("a dental specialist's claim review", () => {
  it("is given the dentist's tooth codes, so a line it would have asked a tooth for is asked on the claim too", async () => {
    const sources = await loadBatchLineSources(batch, practice('orthodontist'));
    expect([...(sources.dentistToothCodes ?? [])].sort()).toEqual(['8341', '8501']);
    // Its own shared list is empty: the codes come from NAMAF, so the rows are only its own codes
    expect(sources.tariffRows).toEqual([]);
    expect(sources.warnings).toEqual([]);
    // Its own shared list and the dentist's, whichever answers first
    expect([...db.sharedReads].sort()).toEqual(['dental', 'orthodontist']);
  });

  // The review still opens: the batch is not sent unchecked because a list could not be read, it is told in words
  it("says, and still opens, when the dentist's tooth codes cannot be read", async () => {
    db.dentistError = { message: 'network down' };
    const sources = await loadBatchLineSources(batch, practice('periodontist'));
    expect(sources.dentistToothCodes).toBeUndefined();
    expect(sources.warnings).toHaveLength(1);
    expect(sources.warnings[0]).toContain("dentist's tooth rules");
    expect(sources.warnings[0]).toContain('were not checked');
  });
});

describe('every other practice', () => {
  // The dentist's own shared list carries its flags on its rows; a second copy would be a second place to keep right
  it("the dentist's claim review reads its shared list as before and no second list", async () => {
    const sources = await loadBatchLineSources(batch, practice('dental'));
    expect(sources.dentistToothCodes).toBeUndefined();
    expect(sources.tariffRows.map(row => row.code)).toEqual(['8341', '8501', '8101']);
    expect(db.sharedReads).toEqual(['dental']);
  });

  it('a general practice never numbers teeth and reads no tariff list for it', async () => {
    const sources = await loadBatchLineSources(batch, practice('medical'));
    expect(sources.dentistToothCodes).toBeUndefined();
    expect(sources.tariffRows).toEqual([]);
    expect(db.sharedReads).toEqual([]);
  });
});
