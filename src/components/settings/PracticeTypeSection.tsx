import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { refreshAfterSave } from '../../lib/queryClient';
import { plainErrorMessage } from '../../utils/plainErrors';
import {
  needsPracticeTypeChoice,
  practiceTypeChanged,
  practiceTypeOptions,
  practiceTypeState,
  practiceTypeUpdate,
  type PracticeTypeOption
} from '../../utils/practiceType';

interface PracticeRow {
  practice_type: string | null;
  practice_type_id: string | null;
}

type Load = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; practice: PracticeRow; options: PracticeTypeOption[] };

interface PracticeTypeSectionProps {
  practiceId: string | null | undefined;
  /** Practice administrators and OneHealth support (isStaffAdmin): the database refuses anyone else */
  canChange: boolean;
}

/**
 * Settings > Practice: the practice's discipline. It decides the tariff list and which records show (Teeth for dental
 * practices, Eyes for optometry), so only an administrator changes it; the practices_protected_columns trigger refuses
 * everyone else, and its own words are shown when it does. Both stored copies are written together.
 */
export const PracticeTypeSection: React.FC<PracticeTypeSectionProps> = ({ practiceId, canChange }) => {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [choiceId, setChoiceId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!practiceId) return;
    let cancelled = false;
    void (async () => {
      const [practice, types] = await Promise.all([
        supabase.from('practices').select('practice_type, practice_type_id').eq('id', practiceId).maybeSingle(),
        supabase.from('practice_types').select('id, name, is_active').order('name')
      ]);
      if (cancelled) return;
      if (practice.error || types.error || !practice.data) {
        console.error('Error loading the practice type:', practice.error ?? types.error);
        // Staff need what to do, not the database's wording
        setLoad({ state: 'error', message: 'Please refresh the page and try again.' });
        return;
      }
      const options = practiceTypeOptions(types.data ?? []);
      const row = practice.data as PracticeRow;
      setLoad({ state: 'ready', practice: row, options });
      setChoiceId(practiceTypeState(row, options).suggested?.id ?? '');
    })();
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  // The price-list screens link here (#practice-type): bring the section into view once it has loaded
  useEffect(() => {
    if (load.state !== 'ready' || window.location.hash !== '#practice-type') return;
    document.getElementById('practice-type')?.scrollIntoView?.({ block: 'start' });
  }, [load.state]);

  if (!practiceId) return null;

  const ready = load.state === 'ready' ? load : null;
  const state = ready ? practiceTypeState(ready.practice, ready.options) : null;
  const choice = ready?.options.find(option => option.id === choiceId) ?? null;
  const dirty = !!ready && !!choice && practiceTypeChanged(ready.practice, choice);

  const save = async () => {
    if (!ready || !choice) return;
    setSaving(true);
    setError(null);
    const update = practiceTypeUpdate(choice);
    const { data, error: saveError } = await supabase.from('practices').update(update).eq('id', practiceId).select('id');
    setSaving(false);
    if (saveError) {
      // The protected-columns trigger says in plain words who may change it
      console.error('Error saving the practice type:', saveError);
      setError(plainErrorMessage(saveError, 'Not saved. Please try again.'));
      return;
    }
    // Row-level security skips a practice the user may not change without an error: never say "Saved" then
    if (!data || data.length === 0) {
      setError('Not saved: you cannot change this practice.');
      return;
    }
    setLoad({ ...ready, practice: { ...ready.practice, ...update } });
    setSavedLabel(choice.label);
    // The menu (Optometry), the tariff list and the diary read the practice from the shared cache
    void refreshAfterSave('practice');
  };

  return (
    <section id="practice-type" className="rounded-lg bg-gray-50 p-6" aria-labelledby="practice-type-heading">
      <h3 id="practice-type-heading" className="mb-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
        <Icon icon="solar:stethoscope-bold-duotone" className="h-5 w-5 text-purple-600" aria-hidden="true" />
        Practice type
      </h3>
      <p className="mb-4 text-sm text-gray-600">
        Decides the tariff list and which records show: the tooth chart for dental practices, eye records for optometry.
      </p>

      {load.state === 'loading' && <p className="text-sm text-gray-500" role="status">Loading...</p>}
      {load.state === 'error' && <p className="text-sm text-red-700" role="alert">Could not load the practice type: {load.message}</p>}

      {ready && state && (
        <div className="space-y-3">
          {needsPracticeTypeChoice(ready.practice.practice_type) && (
            // Owner, 13 Oct 2026: 'general' (the default) matches no price list, so the practice is asked to choose
            <p id="practice-type-needed" className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Choose your practice type. Until it is chosen, no price list matches the practice, so codes have no prices.
                {canChange ? '' : ' Ask a practice administrator to choose it.'}
              </span>
            </p>
          )}
          <p className="text-sm text-gray-900">
            <span className="font-medium">Now: </span>
            {state.current ? state.current.label : 'Not chosen yet'}
          </p>
          {state.linkedElsewhere && (
            <p className="text-sm text-amber-800">
              The OneHealth directory lists this practice as {state.linkedElsewhere.label}.{' '}
              {canChange ? 'Choose the type to make both agree.' : 'A practice administrator can choose the type to make both agree.'}
            </p>
          )}

          {canChange ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 sm:w-80">
                <label htmlFor="practice-type-choice" className="mb-1 block text-sm font-medium text-gray-700">
                  Type of practice
                </label>
                <select
                  id="practice-type-choice"
                  value={choiceId}
                  onChange={event => {
                    setChoiceId(event.target.value);
                    setError(null);
                    setSavedLabel(null);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {!choice && <option value="">Choose the type</option>}
                  {ready.options.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon icon={saving ? 'solar:refresh-bold-duotone' : 'solar:diskette-bold-duotone'} className={`h-4 w-4 ${saving ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
                {saving ? 'Saving...' : 'Save type'}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Only a practice administrator can change the practice type.</p>
          )}

          {error && (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}
          {savedLabel && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">
              <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 shrink-0" aria-hidden="true" />
              Saved: {savedLabel}. The matching screens show after OneHealth reloads.
              <button type="button" onClick={() => window.location.reload()} className="font-medium underline">
                Reload now
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default PracticeTypeSection;
