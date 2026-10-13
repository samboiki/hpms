/**
 * Reads what the funds paid and refused before (remittance_lines, claim_rejections) for batch review's learned
 * checks (preSendChecks.ts). The tables come from proposals/2026-10-07-remittances.sql: until remittances are
 * imported there is no history, and only the checks that need none (dependant code, membership number) run.
 * Read-only; no names are read, only numbers, dates, codes and amounts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { toCents } from '../../../utils/billing/money';
import { addMonthsToKey, todayKey } from '../../../utils/billing/dates';
import { classifyLineReasons, type ReasonCategory } from '../../../utils/remittance/reasonCodes';
import { numberKey } from '../../../utils/remittance/text';
import type { Administrator } from '../../../utils/remittance/types';
import type { RemittanceHistoryLine } from '../../../utils/remittance/preSubmissionChecks';
import { isNotSetUpError } from '../../../services/invoicingSetup';
import type { EarlierRejection, PreSendHistory } from './preSendChecks';
import type { BatchDetailRow } from './types';

// The generated database types do not know the remittance tables yet
const db = supabase as unknown as SupabaseClient;

/** How far back the checks look, and how many fund answers they read at most (the newest first). */
export const HISTORY_MONTHS = 18;
export const HISTORY_PAGE = 1000;
export const HISTORY_MAX_LINES = 5000;

interface RemittanceLineRow {
  practice_reference: string | null;
  member_number: string | null;
  service_date: string | null;
  tariff_code: string | null;
  claimed: number | string | null;
  paid: number | string | null;
  reason_codes: string[] | null;
  reason_texts: string[] | null;
  document: { fund_code: string | null; administrator: string | null; reason_legend: Record<string, string> | null } | null;
}

interface RejectionRow {
  resubmitted_line_id: string | null;
  category: string | null;
  reason_codes: string[] | null;
  remittance_line: { member_number: string | null } | null;
}

const cents = (value: number | string | null): number | null => {
  const number = typeof value === 'number' ? value : Number(value);
  return value === null || value === '' || !Number.isFinite(number) ? null : toCents(number);
};

const ADMINISTRATORS: readonly Administrator[] = ['methealth', 'medscheme', 'switchon', 'unknown'];

/** One stored remittance line as the learned checks read it. */
export function toHistoryLine(row: RemittanceLineRow): RemittanceHistoryLine {
  const paidCents = cents(row.paid) ?? 0;
  const claimedCents = cents(row.claimed);
  const administrator = (ADMINISTRATORS as readonly string[]).includes(row.document?.administrator ?? '')
    ? (row.document?.administrator as Administrator)
    : 'unknown';
  const codes = row.reason_codes ?? [];
  const reason = classifyLineReasons(administrator, codes, row.reason_texts ?? [], row.document?.reason_legend ?? {}, claimedCents !== null && paidCents >= claimedCents);
  return {
    fundCode: row.document?.fund_code ?? null,
    patientReference: row.practice_reference,
    memberNumber: row.member_number,
    serviceDate: row.service_date,
    tariffCode: row.tariff_code,
    claimedCents,
    paidCents,
    category: reason.primary?.category ?? null,
    reasonCodes: codes
  };
}

export interface PreSendHistoryLoad {
  history: PreSendHistory;
  /** Shown above the lines when some checks could not run */
  note: string | null;
}

const EMPTY: PreSendHistory = { remittanceLines: null, earlierRejections: new Map() };

/** The fund answers of the last HISTORY_MONTHS for the practice, and the earlier rejections of resubmitted lines. */
export async function loadPreSendHistory(practiceId: string, details: readonly BatchDetailRow[]): Promise<PreSendHistoryLoad> {
  const since = addMonthsToKey(todayKey(), -HISTORY_MONTHS);
  const rows: RemittanceLineRow[] = [];
  for (let from = 0; from < HISTORY_MAX_LINES; from += HISTORY_PAGE) {
    const { data, error } = await db
      .from('remittance_lines')
      .select('practice_reference, member_number, service_date, tariff_code, claimed, paid, reason_codes, reason_texts, document:remittance_documents(fund_code, administrator, reason_legend)')
      .eq('practice_id', practiceId)
      .gte('service_date', since)
      .order('service_date', { ascending: false })
      .range(from, from + HISTORY_PAGE - 1);
    if (error) {
      if (isNotSetUpError(error)) return { history: EMPTY, note: null };
      return { history: EMPTY, note: `Earlier fund answers could not be read (${error.message}), so the "already paid" and learned checks were skipped.` };
    }
    rows.push(...((data ?? []) as unknown as RemittanceLineRow[]));
    if ((data ?? []).length < HISTORY_PAGE) break;
  }

  const earlierRejections = new Map<string, EarlierRejection>();
  const resubmitted = details.filter(detail => (detail.resubmission_flag ?? '').trim() !== '').map(detail => detail.id);
  let note: string | null = rows.length >= HISTORY_MAX_LINES ? `The learned checks used the newest ${HISTORY_MAX_LINES} fund answers.` : null;
  if (resubmitted.length > 0) {
    const { data, error } = await db
      .from('claim_rejections')
      .select('resubmitted_line_id, category, reason_codes, remittance_line:remittance_lines(member_number)')
      .in('resubmitted_line_id', resubmitted);
    if (error && !isNotSetUpError(error)) {
      note = `Earlier rejections could not be read (${error.message}), so resubmitted lines were not checked.`;
    }
    const membershipOf = new Map(details.map(detail => [detail.id, numberKey(detail.medical_aid_membership_number)]));
    ((data ?? []) as unknown as RejectionRow[]).forEach(row => {
      if (!row.resubmitted_line_id || !row.category) return;
      const before = numberKey(row.remittance_line?.member_number);
      earlierRejections.set(row.resubmitted_line_id, {
        category: row.category as ReasonCategory,
        reasonCodes: row.reason_codes ?? [],
        membershipChanged: before !== '' && before !== membershipOf.get(row.resubmitted_line_id)
      });
    });
  }
  return { history: { remittanceLines: rows.map(toHistoryLine), earlierRejections }, note };
}
