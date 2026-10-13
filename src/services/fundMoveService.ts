/**
 * Moving many patients from one fund or option to another (parity A21): the practice's patients with their medical aid,
 * the funds and their options, the move itself (apply_fund_move, administrators only) and the moves made so far, and
 * each patient's reason for their change history (proposals/2026-10-13-fund-moves.sql). Before that file is applied
 * the move says it is not set up yet.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { isMissingFunctionError, isMissingTableError } from '../utils/diary/dbErrors';
import { fundMoveKey, type FundMemberRow, type FundMoveResult, type FundProvider, type fundMovePayload } from '../utils/accounts/fundMoves';

// The generated database types do not know the move's tables and function yet
const db = supabase as unknown as SupabaseClient;

export class FundMovesNotSetUpError extends Error {
  constructor() {
    super('Moving patients to another fund is not set up in this database yet.');
    this.name = 'FundMovesNotSetUpError';
  }
}

export function isFundMovesNotSetUp(error: unknown): boolean {
  if (error instanceof FundMovesNotSetUpError) return true;
  return isMissingTableError(error, 'fund_moves') || isMissingTableError(error, 'fund_move_patients') || isMissingFunctionError(error, 'apply_fund_move');
}

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

interface PatientWithAid {
  id: string;
  first_name: string | null;
  last_name: string | null;
  medical_aid_details: Array<{
    id: string;
    provider: string | null;
    scheme: string | null;
    plan_type: string | null;
    medical_aid_provider_id: string | null;
    relationship_to_main: string | null;
  }> | null;
}

/** The practice's patients with a medical aid (files merged into another are left out), one row per medical aid */
export async function loadFundMembers(practiceId: string): Promise<FundMemberRow[]> {
  const rows: FundMemberRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from('patients')
      .select('id, first_name, last_name, medical_aid_details(id, provider, scheme, plan_type, medical_aid_provider_id, relationship_to_main)')
      .eq('practice_id', practiceId)
      .is('merged_into_patient_id', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not load the patients' medical aids: ${error.message}`);
    const page = (data ?? []) as unknown as PatientWithAid[];
    for (const patient of page) {
      const name = [patient.first_name, patient.last_name].map(part => part?.trim()).filter(Boolean).join(' ') || 'Patient';
      for (const aid of patient.medical_aid_details ?? []) {
        rows.push({
          medicalAidId: aid.id,
          patientId: patient.id,
          patientName: name,
          provider: aid.provider ?? '',
          scheme: aid.scheme ?? '',
          planType: aid.plan_type ?? '',
          providerId: aid.medical_aid_provider_id ?? null,
          relationship: aid.relationship_to_main ?? null
        });
      }
    }
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** The funds patients can move to (the medical aid list the patient forms use) */
export async function loadFundProviders(): Promise<FundProvider[]> {
  const { data, error } = await db.from('medical_aid_providers').select('id, name, medical_aid_reference').order('name');
  if (error) throw new Error(`Could not load the medical aid list: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; name: string; medical_aid_reference: string | null }>).map(row => ({
    id: row.id,
    name: row.name,
    reference: row.medical_aid_reference
  }));
}

/** A fund's options as the patient forms offer them (medical_aid_schemes) */
export async function loadFundOptions(providerId: string): Promise<string[]> {
  const { data, error } = await db.from('medical_aid_schemes').select('name').eq('provider_id', providerId).order('name');
  if (error) throw new Error(`Could not load the fund's options: ${error.message}`);
  return [...new Set(((data ?? []) as Array<{ name: string | null }>).map(row => row.name?.trim() ?? '').filter(Boolean))];
}

export async function applyFundMove(practiceId: string, payload: ReturnType<typeof fundMovePayload>): Promise<FundMoveResult> {
  const { data, error } = await db.rpc('apply_fund_move', { p_practice_id: practiceId, p_payload: payload });
  if (error) {
    if (isFundMovesNotSetUp(error)) throw new FundMovesNotSetUpError();
    throw new Error(error.message || 'The patients could not be moved');
  }
  const result = (data ?? {}) as { move_id?: string | null; moved?: number; claims_moved?: number; skipped?: Array<{ patient_id?: string; why?: string }> };
  return {
    moveId: result.move_id ?? null,
    moved: Number(result.moved ?? 0),
    claimsMoved: Number(result.claims_moved ?? 0),
    skipped: (result.skipped ?? []).map(item => ({ patientId: item.patient_id ?? '', why: item.why ?? 'not_found' }))
  };
}

export interface FundMoveRecord {
  id: string;
  movedAt: string;
  movedBy: string | null;
  /** The administrator's name, when the staff list has it */
  movedByName: string | null;
  fromLabel: string;
  toProvider: string;
  toOption: string | null;
  reason: string;
  patientCount: number;
  claimsMoved: number;
}

/** The moves made so far, the latest first */
export async function loadFundMoves(practiceId: string): Promise<FundMoveRecord[]> {
  const { data, error } = await db
    .from('fund_moves')
    .select('id, moved_at, moved_by, from_label, to_provider, to_option, reason, patient_count, claims_moved')
    .eq('practice_id', practiceId)
    .order('moved_at', { ascending: false })
    .range(0, 199);
  if (error) {
    if (isFundMovesNotSetUp(error)) throw new FundMovesNotSetUpError();
    throw new Error(`Could not load the moves made so far: ${error.message}`);
  }
  const records = ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
    id: String(row.id),
    movedAt: String(row.moved_at),
    movedBy: (row.moved_by as string | null) ?? null,
    movedByName: null as string | null,
    fromLabel: String(row.from_label ?? ''),
    toProvider: String(row.to_provider ?? ''),
    toOption: (row.to_option as string | null) ?? null,
    reason: String(row.reason ?? ''),
    patientCount: Number(row.patient_count ?? 0),
    claimsMoved: Number(row.claims_moved ?? 0)
  }));
  const userIds = [...new Set(records.map(record => record.movedBy).filter((id): id is string => !!id))];
  if (userIds.length === 0) return records;
  const { data: users, error: usersError } = await db.from('users').select('id, full_name').in('id', userIds);
  // The names only label the list; it is shown without them
  if (usersError) console.warn('The names of who moved the patients were not loaded:', usersError.message);
  const names = new Map(((users ?? []) as Array<{ id: string; full_name: string | null }>).map(user => [user.id, user.full_name?.trim() || null]));
  return records.map(record => ({ ...record, movedByName: record.movedBy ? names.get(record.movedBy) ?? null : null }));
}

/** The reason of each fund move of these medical aid records, by fundMoveKey. Empty before the moves exist. */
export async function loadFundMoveReasons(medicalAidIds: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(medicalAidIds.filter(Boolean))];
  const reasons = new Map<string, string>();
  for (let i = 0; i < unique.length; i += ID_CHUNK) {
    const { data, error } = await db
      .from('fund_move_patients')
      .select('medical_aid_id, moved_at, fund_moves(reason)')
      .in('medical_aid_id', unique.slice(i, i + ID_CHUNK))
      .range(0, PAGE_SIZE - 1);
    if (error) {
      if (isFundMovesNotSetUp(error)) return new Map();
      throw new Error(`Could not load the fund moves: ${error.message}`);
    }
    for (const row of (data ?? []) as Array<{ medical_aid_id: string; moved_at: string; fund_moves: { reason?: string } | Array<{ reason?: string }> | null }>) {
      const move = Array.isArray(row.fund_moves) ? row.fund_moves[0] : row.fund_moves;
      if (move?.reason) reasons.set(fundMoveKey(row.medical_aid_id, row.moved_at), move.reason);
    }
  }
  return reasons;
}
