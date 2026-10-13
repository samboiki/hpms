import React, { useEffect, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { RELATIONSHIP_LABELS, type AccountRelationship } from '../../../services/ledgerService';
import { ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass, type Choice } from '../receipts/ArUi';
import { searchPatients, type PatientMatch } from '../receipts/arService';
import { linkAccountHolder, moveAccountHolder, unlinkAccountHolder } from './debtorsService';
import { patientFileLink } from './accountText';
import type { AccountPerson } from './useAccountFlags';

const RELATIONSHIPS: Choice<AccountRelationship>[] = (Object.keys(RELATIONSHIP_LABELS) as AccountRelationship[]).map(value => ({ value, label: RELATIONSHIP_LABELS[value] }));

interface FamilySheetProps {
  practiceId: string;
  patientId: string;
  patientName: string;
  holder: AccountPerson | null;
  members: readonly AccountPerson[];
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Family account of a patient: who pays for them, or whom they pay for. Link to an account holder,
 * add a family member to this patient's account, remove someone (with a reason, kept), or move the
 * whole account to another member (everyone follows, the reason is kept: dc_move_account_holder).
 */
export const FamilySheet: React.FC<FamilySheetProps> = ({ practiceId, patientId, patientName, holder, members, onClose, onChanged }) => {
  const [mode, setMode] = useState<'view' | 'holder' | 'member' | 'unlink' | 'move'>('view');
  // "Make account holder": the account moves from `moveFrom` (who pays now) to `moveTo`
  const [moveFrom, setMoveFrom] = useState<{ id: string; name: string } | null>(null);
  const [moveTo, setMoveTo] = useState<{ id: string; name: string } | null>(null);
  const [term, setTerm] = useState('');
  const [matches, setMatches] = useState<PatientMatch[]>([]);
  const [chosen, setChosen] = useState<PatientMatch | null>(null);
  const [relationship, setRelationship] = useState<AccountRelationship | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<AccountPerson | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'holder' && mode !== 'member') return;
    const text = term.trim();
    if (text.length < 2) { setMatches([]); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPatients(practiceId, text)
        .then(found => { if (!cancelled) setMatches(found.filter(match => match.id !== patientId)); })
        .catch(() => { if (!cancelled) setMatches([]); });
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [term, mode, practiceId, patientId]);

  const reset = (next: typeof mode) => {
    setMode(next);
    setTerm('');
    setMatches([]);
    setChosen(null);
    setRelationship(null);
    setReason('');
    setError(null);
  };

  const link = async () => {
    if (!chosen) { setError('Choose the patient'); return; }
    if (!relationship) { setError('Choose how they are related'); return; }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'holder') await linkAccountHolder(practiceId, patientId, chosen.id, relationship);
      else await linkAccountHolder(practiceId, chosen.id, patientId, relationship);
      toast.success(mode === 'holder' ? `${chosen.name} now pays for ${patientName}` : `${patientName} now pays for ${chosen.name}`);
      reset('view');
      onChanged();
    } catch (linkError) {
      setError(linkError instanceof Error ? plainWords(linkError.message) : 'Not linked');
    } finally {
      setBusy(false);
    }
  };

  const startMove = (from: { id: string; name: string }, to: { id: string; name: string }) => {
    reset('move');
    setMoveFrom(from);
    setMoveTo(to);
  };

  const move = async () => {
    if (!moveFrom || !moveTo) return;
    if (!relationship) { setError('Choose how they are related'); return; }
    if (reason.trim().length < 3) { setError('Say why the account moves'); return; }
    setBusy(true);
    setError(null);
    try {
      const result = await moveAccountHolder(practiceId, moveFrom.id, moveTo.id, relationship, reason);
      toast.success(result.already ? `${moveTo.name} already pays for the family` : `${moveTo.name} now pays for the family`);
      reset('view');
      onChanged();
    } catch (moveError) {
      setError(moveError instanceof Error ? plainWords(moveError.message) : 'Not moved');
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!unlinkTarget) return;
    if (reason.trim().length < 3) { setError('Say why the patient leaves the account'); return; }
    setBusy(true);
    setError(null);
    try {
      await unlinkAccountHolder(practiceId, unlinkTarget.id === holder?.id ? patientId : unlinkTarget.id, reason);
      toast.success('Removed from the family account');
      reset('view');
      onChanged();
    } catch (unlinkError) {
      setError(unlinkError instanceof Error ? plainWords(unlinkError.message) : 'Not removed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} busy={busy} size="lg" title={`Family account: ${patientName}`} subtitle="One account holder pays for the family: statements and credit control go to them" icon="solar:users-group-rounded-bold-duotone"
      footer={<PrimaryButton icon="solar:check-circle-bold-duotone" onClick={onClose} disabled={busy}>Done</PrimaryButton>}>
      <div className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}

        {mode === 'view' && (
          <>
            {holder ? (
              <div className="rounded-xl border border-gray-200 p-3 text-sm">
                <p className="text-gray-600">Paid for by</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-gray-900">
                  <Link to={patientFileLink(holder.id)} className="text-cyan-700 hover:underline">{holder.name}</Link>
                  <span className="text-xs font-normal text-gray-500">({RELATIONSHIP_LABELS[holder.relationship].toLowerCase()} of the holder)</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <SecondaryButton className="!px-2.5 !py-1" onClick={() => { reset('unlink'); setUnlinkTarget(holder); }}>Pays for themselves from now on</SecondaryButton>
                  <SecondaryButton className="!px-2.5 !py-1" onClick={() => startMove(holder, { id: patientId, name: patientName })}>Pays for the family from now on</SecondaryButton>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 p-3 text-sm">
                <p className="text-gray-700">{patientName} pays for {members.length > 0 ? 'themselves and:' : 'themselves.'}</p>
                {members.length > 0 && (
                  <ul className="mt-1 space-y-1">
                    {members.map(member => (
                      <li key={member.id} className="flex flex-wrap items-center gap-2">
                        <Link to={patientFileLink(member.id)} className="text-cyan-700 hover:underline">{member.name}</Link>
                        <span className="text-xs text-gray-500">{RELATIONSHIP_LABELS[member.relationship]}</span>
                        <button type="button" className="text-xs text-gray-500 underline hover:text-cyan-700" onClick={() => startMove({ id: patientId, name: patientName }, member)}>Make account holder</button>
                        <button type="button" className="text-xs text-gray-500 underline hover:text-red-700" onClick={() => { reset('unlink'); setUnlinkTarget(member); }}>Remove</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!holder && <SecondaryButton icon="solar:user-plus-bold-duotone" onClick={() => reset('member')}>Add someone {patientName} pays for</SecondaryButton>}
              {!holder && members.length === 0 && <SecondaryButton icon="solar:link-bold-duotone" onClick={() => reset('holder')}>Someone else pays for {patientName}</SecondaryButton>}
            </div>
            {!holder && members.length > 0 && (
              <p className="text-xs text-gray-500">{patientName} pays for others, so they cannot be paid for by someone else (one level only).</p>
            )}
          </>
        )}

        {(mode === 'holder' || mode === 'member') && (
          <div className="space-y-3">
            <Field label={mode === 'holder' ? `Who pays for ${patientName}?` : `Whom does ${patientName} pay for?`} htmlFor="family-search" hint="Search by name, ID number or cell number">
              <input id="family-search" className={inputClass} value={term} onChange={event => { setTerm(event.target.value); setChosen(null); }} autoComplete="off" />
            </Field>
            {matches.length > 0 && !chosen && (
              <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200" aria-label="Patients found">
                {matches.map(match => (
                  <li key={match.id}>
                    <button type="button" onClick={() => setChosen(match)} className="w-full px-3 py-2 text-left text-sm hover:bg-cyan-50 focus:bg-cyan-50 focus:outline-none">
                      <span className="font-medium text-gray-900">{match.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{[match.idNumber, match.cellNumber].filter(Boolean).join(' · ')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {chosen && <p className="text-sm text-gray-800">Chosen: <span className="font-medium">{chosen.name}</span></p>}
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">{mode === 'holder' ? `${patientName} is the account holder's` : `${chosen?.name ?? 'They'} ${chosen ? 'is' : 'are'} ${patientName}'s`}</p>
              <ChoiceGroup value={relationship} onChange={setRelationship} options={RELATIONSHIPS} label="Relationship" />
            </div>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton icon="solar:link-bold-duotone" onClick={() => void link()} busy={busy} disabled={!chosen || !relationship}>Link</PrimaryButton>
              <SecondaryButton onClick={() => reset('view')} disabled={busy}>Back</SecondaryButton>
            </div>
          </div>
        )}

        {mode === 'move' && moveFrom && moveTo && (
          <div className="space-y-3">
            <p className="text-sm text-gray-800">
              {moveTo.name} will pay for the family: {moveFrom.name} and everyone on the account move to them. Invoices stay where they are; only who pays changes.
            </p>
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">{moveFrom.name} is {moveTo.name}&apos;s</p>
              <ChoiceGroup value={relationship} onChange={setRelationship} options={RELATIONSHIPS} label="Relationship" />
            </div>
            <Field label="Why?" htmlFor="family-move-reason">
              <input id="family-move-reason" className={inputClass} value={reason} onChange={event => setReason(event.target.value)} maxLength={200} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton icon="solar:users-group-rounded-bold-duotone" onClick={() => void move()} busy={busy} disabled={!relationship}>Move the account</PrimaryButton>
              <SecondaryButton onClick={() => reset('view')} disabled={busy}>Back</SecondaryButton>
            </div>
          </div>
        )}

        {mode === 'unlink' && unlinkTarget && (
          <div className="space-y-3">
            <p className="text-sm text-gray-800">
              {unlinkTarget.id === holder?.id ? `${patientName} will pay for themselves.` : `${unlinkTarget.name} will pay for themselves.`} Their invoices stay where they are; only who pays changes.
            </p>
            <Field label="Why?" htmlFor="family-unlink-reason">
              <input id="family-unlink-reason" className={inputClass} value={reason} onChange={event => setReason(event.target.value)} maxLength={200} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <PrimaryButton tone="red" icon="solar:link-broken-bold-duotone" onClick={() => void unlink()} busy={busy}>Remove from the account</PrimaryButton>
              <SecondaryButton onClick={() => reset('view')} disabled={busy}>Back</SecondaryButton>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
};
