import React, { useId, useRef, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  SEVERITY_LABELS,
  addAllergy,
  removeAllergy,
  setNoKnownAllergies,
  verifyAllergy,
  type AllergyRecord,
  type AllergyRemoval,
  type AllergySeverity,
  type ClinicalProfileRecord
} from '../../../services/patientSafetyService';
import { INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';
import { COMMON_ALLERGY_SUBSTANCES, SEVERITY_CHIP, formatSafetyDate } from './safetyFormat';

interface AllergyPanelProps {
  practiceId: string;
  patientId: string;
  allergies: readonly AllergyRecord[];
  profile: ClinicalProfileRecord | null;
  /** The signed-in user may verify (practitioner, nurse, practice admin) */
  canVerify: boolean;
  onChanged: () => Promise<void>;
}

const SEVERITY_ORDER: readonly AllergySeverity[] = ['mild', 'moderate', 'severe', 'unknown'];

/** Allergies on the expanded alert strip: add, verify, remove, or state "no known allergies". */
export const AllergyPanel: React.FC<AllergyPanelProps> = ({ practiceId, patientId, allergies, profile, canVerify, onChanged }) => {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [substance, setSubstance] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<AllergySeverity>('unknown');
  const [verified, setVerified] = useState(canVerify);
  const substanceRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const substanceId = useId();
  const reactionId = useId();

  const run = async (key: string, action: () => Promise<void>, success: string): Promise<boolean> => {
    setBusy(key);
    try {
      await action();
      await onChanged();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'That did not work. Try again.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const startAdding = () => {
    setSubstance('');
    setReaction('');
    setSeverity('unknown');
    setVerified(canVerify);
    setAdding(true);
    setTimeout(() => substanceRef.current?.focus(), 0);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = substance.replace(/\s+/g, ' ').trim();
    if (!name) {
      substanceRef.current?.focus();
      return;
    }
    const ok = await run('add', () => addAllergy(practiceId, patientId, { substance: name, reaction, severity, verified: canVerify && verified }), `${name} added to the allergies.`);
    if (ok) setAdding(false);
  };

  const remove = (allergy: AllergyRecord, reason: AllergyRemoval) =>
    run(`remove-${allergy.id}`, () => removeAllergy(allergy.id, reason), `${allergy.substance} removed from the allergies.`).then(() => setRemovingId(null));

  const nka = profile?.noKnownAllergies === true && allergies.length === 0;

  return (
    <section aria-labelledby={`${listId}-title`} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${listId}-title`} className="text-sm font-semibold text-gray-900">
          Allergies
        </h3>
        {!adding && (
          <button type="button" className={QUIET_BUTTON} onClick={startAdding}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Add allergy
          </button>
        )}
      </div>

      {allergies.length === 0 && !adding && (
        nka ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span className="flex items-center gap-2">
              <Icon icon="solar:shield-check-bold-duotone" className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                No known allergies
                {profile?.nkaConfirmedAt && (
                  <span className="block text-xs text-emerald-700">
                    Confirmed{profile.nkaConfirmedByName ? ` by ${profile.nkaConfirmedByName}` : ''} on {formatSafetyDate(profile.nkaConfirmedAt)}
                  </span>
                )}
              </span>
            </span>
            <button
              type="button"
              className={QUIET_BUTTON}
              disabled={busy !== null}
              onClick={() => run('nka', () => setNoKnownAllergies(practiceId, patientId, false), 'Allergies are marked as not recorded.')}
            >
              Undo
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-sm text-amber-900">
            <p>Allergies have not been recorded yet. Ask the patient.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className={SECONDARY_BUTTON}
                disabled={busy !== null}
                onClick={() => run('nka', () => setNoKnownAllergies(practiceId, patientId, true), 'Recorded: no known allergies.')}
              >
                <Icon icon="solar:shield-check-bold-duotone" className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                No known allergies
              </button>
              <button type="button" className={SECONDARY_BUTTON} onClick={startAdding}>
                <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
                Add an allergy
              </button>
            </div>
          </div>
        )
      )}

      {allergies.length > 0 && (
        <ul className="space-y-2">
          {allergies.map(allergy => (
            <li key={allergy.id} className="rounded-xl border border-red-100 bg-white px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                    {allergy.substance}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CHIP[allergy.severity]}`}>
                      {SEVERITY_LABELS[allergy.severity]}
                    </span>
                  </p>
                  {allergy.reaction && <p className="text-sm text-gray-700">Reaction: {allergy.reaction}</p>}
                  <p className="text-xs text-gray-500">
                    {allergy.verifiedAt
                      ? `Verified${allergy.verifiedByName ? ` by ${allergy.verifiedByName}` : ''} on ${formatSafetyDate(allergy.verifiedAt)}`
                      : `Not verified yet${allergy.recordedByName ? ` (recorded by ${allergy.recordedByName})` : ''}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!allergy.verifiedAt && canVerify && (
                    <button
                      type="button"
                      className={QUIET_BUTTON}
                      disabled={busy !== null}
                      onClick={() => run(`verify-${allergy.id}`, () => verifyAllergy(allergy.id), `${allergy.substance} verified.`)}
                    >
                      <Icon icon="solar:verified-check-bold-duotone" className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      Verify
                    </button>
                  )}
                  <button
                    type="button"
                    className={QUIET_BUTTON}
                    disabled={busy !== null}
                    aria-expanded={removingId === allergy.id}
                    onClick={() => setRemovingId(removingId === allergy.id ? null : allergy.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
              {removingId === allergy.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 px-2 py-2 text-sm text-gray-700">
                  <span>Why?</span>
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => void remove(allergy, 'resolved')}>
                    No longer allergic
                  </button>
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy !== null} onClick={() => void remove(allergy, 'entered_in_error')}>
                    Added by mistake
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form onSubmit={save} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
          <datalist id={`${listId}-substances`}>
            {COMMON_ALLERGY_SUBSTANCES.map(option => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <div>
            <label htmlFor={substanceId} className={LABEL}>
              Allergic to
            </label>
            <input
              id={substanceId}
              ref={substanceRef}
              className={INPUT}
              value={substance}
              maxLength={120}
              list={`${listId}-substances`}
              autoComplete="off"
              placeholder="e.g. Penicillin"
              onChange={event => setSubstance(event.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor={reactionId} className={LABEL}>
              Reaction <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input
              id={reactionId}
              className={INPUT}
              value={reaction}
              maxLength={200}
              placeholder="e.g. rash, swelling, difficulty breathing"
              onChange={event => setReaction(event.target.value)}
            />
          </div>
          <fieldset>
            <legend className={LABEL}>How severe?</legend>
            <div className="flex flex-wrap gap-2">
              {SEVERITY_ORDER.map(option => (
                <label
                  key={option}
                  className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                    severity === option ? 'border-purple-400 bg-purple-50 text-purple-800' : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name={`${listId}-severity`}
                    value={option}
                    checked={severity === option}
                    onChange={() => setSeverity(option)}
                    className="h-4 w-4 accent-purple-600"
                  />
                  {option === 'unknown' ? 'Not sure' : SEVERITY_LABELS[option]}
                </label>
              ))}
            </div>
          </fieldset>
          {canVerify && (
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-purple-600" checked={verified} onChange={event => setVerified(event.target.checked)} />
              I have confirmed this allergy with the patient or their records
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setAdding(false)} disabled={busy === 'add'}>
              Cancel
            </button>
            <button type="submit" className={PRIMARY_BUTTON} disabled={busy === 'add' || !substance.trim()}>
              {busy === 'add' ? 'Saving...' : 'Save allergy'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

export default AllergyPanel;
