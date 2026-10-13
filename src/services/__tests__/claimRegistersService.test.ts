/**
 * Reading and saving the referral and authorisation registers and a visit's claim details (parity C10, D15, F19):
 * what is sent to the database functions, and what staff are told when the database refuses or is not set up yet.
 * Invented values only; nothing reaches Supabase.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    rpc: [] as Array<{ name: string; args: Record<string, unknown> }>,
    rpcResult: { data: null as unknown, error: null as { code?: string; message: string } | null },
    selectResult: { data: [] as unknown[], error: null as { code?: string; message: string } | null }
  }
}));

vi.mock('../../lib/supabase', () => {
  const chain: Record<string, unknown> = {};
  ['select', 'eq', 'order', 'limit', 'not'].forEach(name => { chain[name] = () => chain; });
  chain.maybeSingle = () => Promise.resolve({ data: null, error: state.selectResult.error });
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(state.selectResult).then(resolve);
  return {
    supabase: {
      from: () => chain,
      rpc: (name: string, args: Record<string, unknown>) => {
        state.rpc.push({ name, args });
        return Promise.resolve(state.rpcResult);
      },
      storage: { from: () => ({ upload: () => Promise.resolve({ error: null }) }) }
    }
  };
});
vi.mock('../../stores/authStore', () => ({ useAuthStore: { getState: () => ({ selectedPracticeId: null, user: null }) } }));

import {
  REGISTERS_NOT_SET_UP,
  loadPatientReferrals,
  loadVisitClaimDetails,
  referralLetterProblem,
  savePatientAuthorisation,
  savePatientReferral
} from '../claimRegistersService';

beforeEach(() => {
  state.rpc = [];
  state.rpcResult = { data: null, error: null };
  state.selectResult = { data: [], error: null };
});

describe('the referral register', () => {
  it('reads the referrals as the screens need them', async () => {
    state.selectResult = {
      data: [{ id: 'r1', patient_id: 'p1', referring_name: 'Dr Test', referring_practice_number: ' 0123456 ', referring_hpcna: null, referral_number: '',
        referral_date: '2026-10-01', valid_until: null, reason: null, letter_path: null, letter_name: null, removed_at: null, created_at: null }],
      error: null
    };
    const result = await loadPatientReferrals('p1');
    expect(result).toEqual({ status: 'ready', rows: [expect.objectContaining({ id: 'r1', referringPracticeNumber: '0123456', referralNumber: null })] });
  });

  // Before the database update the screens say "not set up", never a raw database error
  it('says "not set up" before the database has the register', async () => {
    state.selectResult = { data: [], error: { code: 'PGRST205', message: 'Could not find the table' } };
    expect(await loadPatientReferrals('p1')).toEqual({ status: 'not_set_up' });
    expect(await loadVisitClaimDetails('v1')).toEqual({ status: 'not_set_up' });
  });

  it('sends what was typed to save_patient_referral', async () => {
    state.rpcResult = { data: 'r-new', error: null };
    const id = await savePatientReferral(null, 'p1', {
      referringName: 'Dr Test', referringPracticeNumber: '0123456', referringHpcna: null, referralNumber: 'REF-1',
      referralDate: '2026-10-01', validUntil: null, reason: null, letterPath: null, letterName: null
    });
    expect(id).toBe('r-new');
    expect(state.rpc[0]).toEqual({
      name: 'save_patient_referral',
      args: { p_id: null, p_patient_id: 'p1', p_referral: expect.objectContaining({ referring_name: 'Dr Test', referral_number: 'REF-1', referral_date: '2026-10-01' }) }
    });
  });

  // Another practice's staff are refused by the database; they are told why in plain words
  it("says plainly when the patient belongs to another practice", async () => {
    state.rpcResult = { data: null, error: { code: '42501', message: 'permission denied' } };
    await expect(savePatientReferral(null, 'p1', {
      referringName: 'Dr Test', referringPracticeNumber: null, referringHpcna: null, referralNumber: null,
      referralDate: '2026-10-01', validUntil: null, reason: null, letterPath: null, letterName: null
    })).rejects.toThrow("Only staff of this patient's practice can change these records.");
  });

  // A referral letter is a PDF or a photo; a large scan would fill the practice's storage
  it('takes a PDF or a photo of the letter up to 10 MB', () => {
    expect(referralLetterProblem({ type: 'application/pdf', size: 200_000 })).toBeNull();
    expect(referralLetterProblem({ type: 'application/msword', size: 200_000 })).toMatch(/PDF, or a JPG or PNG/);
    expect(referralLetterProblem({ type: 'image/jpeg', size: 11 * 1024 * 1024 })).toMatch(/larger than 10 MB/);
  });
});

describe('the authorisation register', () => {
  // The database numbers the lines already billed in the window; staff are told how many
  it('saves through save_patient_authorisation and says how many lines it numbered', async () => {
    state.rpcResult = { data: { id: 'a-new', applied: 3 }, error: null };
    const result = await savePatientAuthorisation(null, 'p1', {
      fundReference: 'MAG1', number: 'AUTH-1', validFrom: '2026-10-01', validTo: '2026-12-31', allCodes: false, codes: ['0190'],
      visitsAllowed: 6, note: null, quoteId: null
    });
    expect(result).toEqual({ id: 'a-new', applied: 3 });
    expect(state.rpc[0].args.p_authorisation).toEqual(expect.objectContaining({ fund_reference: 'MAG1', authorisation_number: 'AUTH-1', codes: ['0190'], visits_allowed: 6 }));
  });

  it('passes the database\'s own sentence on, and "not set up" before the update', async () => {
    state.rpcResult = { data: null, error: { code: '23505', message: 'Authorisation AUTH-1 is already on this patient\'s file' } };
    const values = { fundReference: 'MAG1', number: 'AUTH-1', validFrom: '2026-10-01', validTo: '2026-12-31', allCodes: true, codes: [], visitsAllowed: null, note: null, quoteId: null };
    await expect(savePatientAuthorisation(null, 'p1', values)).rejects.toThrow("Authorisation AUTH-1 is already on this patient's file");
    state.rpcResult = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.save_patient_authorisation in the schema cache' } };
    await expect(savePatientAuthorisation(null, 'p1', values)).rejects.toThrow(REGISTERS_NOT_SET_UP);
  });
});
