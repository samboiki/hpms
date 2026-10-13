import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { plainErrorMessage } from '../../utils/plainErrors';
import { lastBatchFromStart, nextClaimBatchNumber, parseLastBatchInput, startFromLastBatch } from './claimBatchStart';

// practices.claim_batch_number_start is newer than the generated types
const db = supabase as unknown as SupabaseClient;

const NOT_SET_UP_CODES = ['42703', 'PGRST204', '42P01', 'PGRST205'];

type Load =
  | { state: 'loading' }
  | { state: 'not_set_up' }
  | { state: 'error' }
  | { state: 'ready'; start: number | null; highestUsed: number | null };

interface ClaimBatchStartSectionProps {
  practiceId: string | null | undefined;
  /** Practice administrators and OneHealth support: the database refuses the column to anyone else */
  canChange: boolean;
}

/**
 * Settings > Practice: the last claim batch number the practice sent from Eminance, so OneHealth's batches continue
 * the numbering the funds know (owner decision 13 Oct 2026; rules in claimBatchStart.ts). Same look as the practice
 * type section above it.
 */
export const ClaimBatchStartSection: React.FC<ClaimBatchStartSectionProps> = ({ practiceId, canChange }) => {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    void (async () => {
      const { data, error: loadError } = await db
        .from('practices')
        .select('practice_number, claim_batch_number_start')
        .eq('id', practiceId)
        .maybeSingle();
      if (cancelled) return;
      if (loadError || !data) {
        console.warn('[OneHealth] claim batch start not read:', loadError);
        setLoad({ state: loadError && NOT_SET_UP_CODES.includes(loadError.code ?? '') ? 'not_set_up' : 'error' });
        return;
      }
      const row = data as { practice_number: string | null; claim_batch_number_start: number | null };
      // The highest number already used under this practice number; the next batch follows it or the start
      let highestUsed: number | null = null;
      if (row.practice_number) {
        const highest = await db
          .from('batch_headers')
          .select('batch_number')
          .eq('practice_number', row.practice_number)
          .order('batch_number', { ascending: false })
          .limit(1);
        if (cancelled) return;
        if (highest.error) console.warn('[OneHealth] highest claim batch not read:', highest.error);
        else highestUsed = (highest.data?.[0] as { batch_number?: number } | undefined)?.batch_number ?? null;
      }
      setLoad({ state: 'ready', start: row.claim_batch_number_start, highestUsed });
      const last = lastBatchFromStart(row.claim_batch_number_start);
      setText(last === null ? '' : String(last));
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  if (!practiceId) return null;

  const ready = load.state === 'ready' ? load : null;
  const parsed = parseLastBatchInput(text);
  const dirty = !!ready && parsed.ok && startFromLastBatch(parsed.value) !== (ready.start ?? null);

  const save = async () => {
    if (!ready || !parsed.ok) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    const start = startFromLastBatch(parsed.value);
    const { data, error: saveError } = await db
      .from('practices')
      .update({ claim_batch_number_start: start })
      .eq('id', practiceId)
      .select('id');
    setSaving(false);
    if (saveError) {
      setError(plainErrorMessage(saveError, 'Not saved'));
      return;
    }
    // The access rules skip a practice the user may not change without an error: never say "Saved" then
    if (!data || data.length === 0) {
      setError('Not saved: your account is not permitted to change this practice.');
      return;
    }
    setLoad({ ...ready, start });
    setSaved(true);
  };

  return (
    <section className="rounded-lg bg-gray-50 p-6" aria-labelledby="claim-batch-start-heading">
      <h3 id="claim-batch-start-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Icon icon="solar:document-text-bold-duotone" className="h-5 w-5 text-purple-600" aria-hidden="true" />
        Claim batches
      </h3>
      <p className="mb-4 text-sm text-gray-600">
        If the practice sent claims from Eminance, enter the last batch number it sent. OneHealth's claim batches then carry on
        after it, so a fund never receives the same batch number twice.
      </p>

      {load.state === 'loading' && <p className="text-sm text-gray-500" role="status">Loading...</p>}
      {load.state === 'not_set_up' && (
        <p className="text-sm text-gray-600" role="status">Batch numbering is not set up yet for this practice. Please contact support.</p>
      )}
      {load.state === 'error' && (
        <p className="text-sm text-red-700" role="alert">Could not load the claim batch numbers. Please refresh the page and try again.</p>
      )}

      {ready && (
        <div className="space-y-3">
          <p className="text-sm text-gray-900">
            <span className="font-medium">Next claim batch: </span>
            number {nextClaimBatchNumber(ready.highestUsed, ready.start)}
          </p>

          {canChange ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 sm:w-80">
                <label htmlFor="claim-batch-last" className="mb-1 block text-sm font-medium text-gray-700">
                  Last batch number sent from Eminance
                </label>
                <input
                  id="claim-batch-last"
                  type="text"
                  inputMode="numeric"
                  value={text}
                  placeholder="None"
                  onChange={event => {
                    setText(event.target.value);
                    setError(null);
                    setSaved(false);
                  }}
                  aria-describedby={!parsed.ok ? 'claim-batch-last-problem' : undefined}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:diskette-bold-duotone'} className={`h-4 w-4 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-900">
              <span className="font-medium">Last batch number sent from Eminance: </span>
              {lastBatchFromStart(ready.start) ?? 'None'}
            </p>
          )}

          {!parsed.ok && canChange && (
            <p id="claim-batch-last-problem" className="text-sm text-red-700" role="alert">{parsed.error}</p>
          )}
          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {saved && (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
              <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 shrink-0" aria-hidden="true" />
              Saved. The next claim batch is number {nextClaimBatchNumber(ready.highestUsed, ready.start)}.
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default ClaimBatchStartSection;
