import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { loadFundNotes, loadPatientFundRef } from '../../services/optometry/optometryService';
import { describeLimit, noteForFund, type FundNote } from '../../utils/optometry/fundNotes';

/**
 * The practice's own optical benefit note for the patient's fund (and option), where spectacles and lenses are
 * chosen. OneHealth keeps no benefit tables: what shows is what the practice wrote. Nothing shows without a note.
 */
const OpticalBenefitNote: React.FC<{ practiceId: string; patientId: string }> = ({ practiceId, patientId }) => {
  const [note, setNote] = useState<{ note: FundNote; fund: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadFundNotes(practiceId), loadPatientFundRef(patientId)])
      .then(([notes, fund]) => {
        if (cancelled) return;
        const match = notes.status === 'ready' ? noteForFund(notes.notes, fund) : null;
        setNote(match ? { note: match, fund: [match.fundReference, match.planOption].filter(Boolean).join(' ') } : null);
      })
      // The note is a help, never a blocker: without it the order is made as usual
      .catch(() => {
        if (!cancelled) setNote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId]);

  if (!note) return null;
  const limit = describeLimit(note.note);
  return (
    <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="note">
      <Icon icon="solar:wallet-money-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium">Optical benefit ({note.fund}): the practice&apos;s note</p>
        <p className="whitespace-pre-line">{note.note.note}</p>
        {limit && <p className="mt-0.5 text-xs text-emerald-800">{limit}</p>}
      </div>
    </div>
  );
};

export default OpticalBenefitNote;
