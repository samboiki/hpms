import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { Field } from '../stock/stockParts';
import { DANGER, INPUT, PRIMARY, QUIET, SECONDARY, errorText } from '../stock/stockUi';
import { deleteFundNote, loadFundNotes, loadFunds, saveFundNote } from '../../services/optometry/optometryService';
import { fromCents } from '../../utils/billing/money';
import { describeLimit, validateFundNoteDraft, type FundNote, type FundNoteDraft, type FundNoteDraftErrors } from '../../utils/optometry/fundNotes';
import { EyesNotSetUp } from './optometryParts';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'not_set_up' } | { status: 'ready'; notes: FundNote[] };

const EMPTY: FundNoteDraft = { fundReference: '', planOption: '', note: '', limit: '', cycleMonths: '' };
const draftOf = (note: FundNote): FundNoteDraft => ({
  id: note.id,
  fundReference: note.fundReference,
  planOption: note.planOption ?? '',
  note: note.note,
  limit: note.limitCents === null ? '' : fromCents(note.limitCents).toFixed(2),
  cycleMonths: note.cycleMonths === null ? '' : String(note.cycleMonths)
});

/**
 * The practice's optical benefit notes, one per fund (or per fund option): what the fund pays for spectacles and how
 * often, as the practice knows it. OneHealth keeps no benefit tables; these notes show on the patient's Eyes tab and
 * on the lab order. Practice admins write them.
 */
const FundNotesPanel: React.FC<{ practiceId: string }> = ({ practiceId }) => {
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [funds, setFunds] = useState<Array<{ reference: string; name: string }>>([]);
  const [draft, setDraft] = useState<FundNoteDraft | null>(null);
  const [errors, setErrors] = useState<FundNoteDraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setConfirming(null);
    loadFundNotes(practiceId)
      .then(result => !cancelled && setLoad(result.status === 'not_set_up' ? { status: 'not_set_up' } : { status: 'ready', notes: result.notes }))
      .catch((error: unknown) => !cancelled && setLoad({ status: 'error', message: errorText(error, 'Could not read the notes.') }));
    loadFunds().then(rows => !cancelled && setFunds(rows), () => undefined);
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  const fundName = (reference: string) => funds.find(fund => fund.reference === reference)?.name ?? reference;
  const set = (patch: Partial<FundNoteDraft>) => setDraft(current => (current ? { ...current, ...patch } : current));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const checked = validateFundNoteDraft(draft);
    if (!checked.ok) return setErrors(checked.errors);
    setErrors({});
    setBusy(true);
    try {
      await saveFundNote(practiceId, checked.payload);
      toast.success('Note saved.');
      setDraft(null);
      reload();
    } catch (failure) {
      toast.error(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note: FundNote) => {
    setBusy(true);
    try {
      await deleteFundNote(note.id);
      toast.success('Note deleted.');
      reload();
    } catch (failure) {
      toast.error(errorText(failure));
    } finally {
      setBusy(false);
    }
  };

  if (load.status === 'loading') return <p className="py-6 text-center text-sm text-gray-500" role="status">Loading the notes...</p>;
  if (load.status === 'not_set_up') return <EyesNotSetUp compact />;
  if (load.status === 'error') return <p className="py-4 text-center text-sm text-red-700" role="alert">{load.message}</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        Funds change their optical benefits every year, so OneHealth keeps no benefit tables: write what your practice knows per fund.
        {isAdmin ? '' : ' A practice admin writes the notes.'}
      </p>
      {load.notes.length === 0 && !draft && <p className="text-sm text-gray-500">No notes yet.</p>}
      <ul className="space-y-2">
        {load.notes.map(note => (
          <li key={note.id} className="rounded-xl border border-gray-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{fundName(note.fundReference)}{note.planOption ? ` · ${note.planOption}` : ' · all options'}</span>
              {isAdmin && (
                <span className="ml-auto flex flex-wrap gap-1">
                  {confirming === note.id ? (
                    <>
                      <span className="self-center text-xs text-gray-600">Delete this note?</span>
                      <button type="button" className={DANGER} onClick={() => void remove(note)} disabled={busy}>Delete</button>
                      <button type="button" className={QUIET} onClick={() => setConfirming(null)} disabled={busy}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={QUIET} onClick={() => setDraft(draftOf(note))} disabled={busy}>Change</button>
                      <button type="button" className={QUIET} onClick={() => setConfirming(note.id)} disabled={busy}>Delete</button>
                    </>
                  )}
                </span>
              )}
            </div>
            <p className="whitespace-pre-line text-sm text-gray-700">{note.note}</p>
            {describeLimit(note) && <p className="text-xs text-gray-500">{describeLimit(note)}</p>}
          </li>
        ))}
      </ul>
      {isAdmin && !draft && (
        <button type="button" className={SECONDARY} onClick={() => setDraft({ ...EMPTY })}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Add a note
        </button>
      )}
      {draft && (
        <form onSubmit={save} noValidate className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Fund" error={errors.fundReference}>
              {props => (
                <select {...props} className={INPUT} value={draft.fundReference} onChange={event => set({ fundReference: event.target.value })}>
                  <option value="">Choose</option>
                  {funds.map(fund => (
                    <option key={fund.reference} value={fund.reference}>{fund.name} ({fund.reference})</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Option (optional)" error={errors.planOption} hint="Empty: every option of the fund">
              {props => <input {...props} className={INPUT} value={draft.planOption} maxLength={60} onChange={event => set({ planOption: event.target.value })} />}
            </Field>
          </div>
          <Field label="Note" error={errors.note} hint="E.g. one pair every 24 months, pre-authorise multifocals">
            {props => <textarea {...props} rows={3} className={INPUT} value={draft.note} maxLength={500} onChange={event => set({ note: event.target.value })} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Limit in N$ (optional)" error={errors.limit}>
              {props => <input {...props} className={INPUT} inputMode="decimal" value={draft.limit} onChange={event => set({ limit: event.target.value })} />}
            </Field>
            <Field label="Every (months, optional)" error={errors.cycleMonths}>
              {props => <input {...props} className={INPUT} inputMode="numeric" value={draft.cycleMonths} onChange={event => set({ cycleMonths: event.target.value })} />}
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={SECONDARY} onClick={() => setDraft(null)} disabled={busy}>Cancel</button>
            <button type="submit" className={PRIMARY} disabled={busy}>Save note</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default FundNotesPanel;
