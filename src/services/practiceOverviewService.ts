/**
 * The practice list of Practice Management (/admin/practices, OneHealth support). It read the admin_practice_overview
 * view, which no longer exists in the database (checked 2026-10-08), so the screen only said "Practices could not be
 * loaded". Practices are read directly, without their bank, Gmail or password columns, and counted here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { addMonthsToKey } from '../utils/billing/dates';
import { EXCLUDE_CARRIER_VISITS } from '../utils/carrierVisits';
import { windhoekClock } from '../utils/patientLists/listDates';

// Read with the untyped client: the generated types still describe the old view's columns
const db = supabase as unknown as SupabaseClient;

/** What the practice cards show (never bank details, the Gmail token or the admin password columns) */
export const PRACTICE_OVERVIEW_COLUMNS =
  'id, slug, name, domain, status, subscription_tier, contact_email, contact_phone, city, admin_name, admin_email, created_at';

export interface PracticeOverview {
  id: string;
  slug: string;
  name: string;
  domain: string;
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  subscription_tier: 'trial' | 'standard' | 'premium' | 'enterprise';
  contact_email: string;
  contact_phone: string;
  city: string;
  admin_name?: string;
  admin_email?: string;
  total_users: number;
  /** null when it could not be counted */
  total_patients: number | null;
  /** Bookings dated this month (Windhoek); null when they could not be counted */
  appointments_this_month: number | null;
  created_at: string;
}

/** How many rows name each practice (rows hold practice_id). */
export function countByPractice(rows: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const practiceId = (row as { practice_id?: unknown } | null)?.practice_id;
    if (typeof practiceId === 'string' && practiceId) counts[practiceId] = (counts[practiceId] ?? 0) + 1;
  }
  return counts;
}

/** This month in Windhoek as [first day, first day of next month) date keys: visit dates are Windhoek dates. */
export function windhoekMonthRange(now: Date): [string, string] {
  const start = `${windhoekClock(now).dateKey.slice(0, 7)}-01`;
  return [start, addMonthsToKey(start, 1)];
}

const exactCount = (result: { count: number | null; error: unknown }): number | null =>
  result.error ? null : (result.count ?? 0);

/** Every practice, newest first, with its staff, patients and this month's bookings. */
export async function loadPracticeOverview(now: Date = new Date()): Promise<PracticeOverview[]> {
  const [practices, staff] = await Promise.all([
    db.from('practices').select(PRACTICE_OVERVIEW_COLUMNS).order('created_at', { ascending: false }),
    db.from('users').select('practice_id').not('practice_id', 'is', null),
  ]);
  if (practices.error) throw new Error(practices.error.message);
  if (staff.error) throw new Error(staff.error.message);

  const staffCounts = countByPractice(staff.data);
  const [monthStart, nextMonthStart] = windhoekMonthRange(now);
  // Patients and bookings are counted only where staff work: the directory listings have neither
  const counted = await Promise.all(
    Object.keys(staffCounts).map(async (practiceId) => {
      const [patients, visits] = await Promise.all([
        db.from('patients').select('id', { count: 'exact', head: true }).eq('practice_id', practiceId),
        db
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('practice_id', practiceId)
          .or(EXCLUDE_CARRIER_VISITS)
          .gte('visit_date', monthStart)
          .lt('visit_date', nextMonthStart),
      ]);
      return [practiceId, { patients: exactCount(patients), visits: exactCount(visits) }] as const;
    })
  );
  const counts = new Map(counted);

  return ((practices.data ?? []) as Array<Omit<PracticeOverview, 'total_users' | 'total_patients' | 'appointments_this_month'>>).map(
    (practice) => {
      const usage = counts.get(practice.id);
      return {
        ...practice,
        total_users: staffCounts[practice.id] ?? 0,
        total_patients: usage ? usage.patients : 0,
        appointments_this_month: usage ? usage.visits : 0,
      };
    }
  );
}
