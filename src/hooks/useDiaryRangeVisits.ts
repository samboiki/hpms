import { useCallback, useEffect, useRef, useState } from 'react';
import { plainWords } from '../utils/plainErrors';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { loadDiaryRangeVisits } from '../services/diaryService';
import type { DiaryRange } from '../utils/diary/diaryRange';
import type { Visit } from '../types/enhanced-visit.types';

const NO_VISITS: Visit[] = [];
/** Several changes in a row (a reminder run, a repeat booking) reload once */
const RELOAD_DELAY_MS = 800;

export interface DiaryRangeVisits {
  visits: Visit[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * The bookings of the week or month the diary shows. Kept apart from the visits store on purpose:
 * the store holds the selected day, which the visit tracker loads too, so a month loaded into it
 * would be replaced by the tracker's single day (and the tracker would count a whole month).
 * Changes made anywhere (check-in, a move, an SMS reply) reload the range through a live
 * subscription, so the views never show a stale booking for long.
 */
export function useDiaryRangeVisits(practiceId: string | null | undefined, range: DiaryRange, enabled: boolean): DiaryRangeVisits {
  const [visits, setVisits] = useState<Visit[]>(NO_VISITS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled || !practiceId) return;
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const loaded = await loadDiaryRangeVisits(practiceId, range.from, range.to);
      // Only the newest request may fill the view (a slow old month must not replace this week)
      if (request === requestRef.current) {
        setVisits(loaded);
        setError(null);
      }
    } catch (failure) {
      if (request === requestRef.current) setError(failure instanceof Error ? plainWords(failure.message) : String(failure));
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [enabled, practiceId, range.from, range.to]);

  useEffect(() => {
    if (!enabled) {
      requestRef.current += 1;
      setVisits(NO_VISITS);
      return;
    }
    void load();
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !practiceId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const client = supabase as unknown as SupabaseClient;
    const channel = client
      .channel(`diary-range-${practiceId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits', filter: `practice_id=eq.${practiceId}` }, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => void load(), RELOAD_DELAY_MS);
      })
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [enabled, practiceId, load]);

  const reload = useCallback(() => void load(), [load]);

  return { visits: enabled ? visits : NO_VISITS, loading, error, reload };
}
